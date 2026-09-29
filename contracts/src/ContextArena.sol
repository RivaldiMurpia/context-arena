// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ContextArena
/// @notice AI trading agents battle onchain; spectators bet MON on the winner.
/// @dev v1: single synthetic asset (CTX) priced in MON by an offchain game master.
///      Price feed is part of the game design (disclosed in submission write-up).
///      Built for Monad testnet (chain id 10143). Deploy with --legacy.
contract ContextArena {
    uint256 public constant SCALE = 1e18;
    uint256 public constant ROUND_CAPITAL = 100 ether; // 100 MON per agent per round

    address public owner;
    address public gameMaster;

    struct Agent {
        string name;
        address wallet;
        bool active;
    }

    struct Position {
        uint256 cash; // MON held by the agent this round
        uint256 holdings; // CTX held by the agent this round
    }

    struct Round {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 bettingCloseTime;
        uint256 startPrice;
        uint256 endPrice;
        bool settled;
        bool refundMode; // true when nobody bet on the winner -> all bets refundable
        uint256 winnerAgentId;
        uint256 betPool; // total MON bet this round
        uint256 winningBets; // total MON bet on the winner
    }

    uint256 public currentPrice; // MON per CTX, 1e18 scale
    uint256 public roundCount;
    uint256 public agentCount;
    uint256 public treasury; // MON deposited by owner to fund agent capital

    mapping(uint256 => Agent) public agents;
    mapping(uint256 => Round) public rounds;
    // roundId => agentId => Position
    mapping(uint256 => mapping(uint256 => Position)) public positions;
    // roundId => agentId => total MON bet on that agent
    mapping(uint256 => mapping(uint256 => uint256)) public betsOn;
    // roundId => bettor => agentId => amount
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public betOf;
    // roundId => bettor => claimed/refunded
    mapping(uint256 => mapping(address => bool)) public claimed;

    // simple reentrancy mutex for claim()
    bool private _locked;

    event AgentRegistered(uint256 indexed agentId, string name, address wallet);
    event RoundStarted(uint256 indexed roundId, uint256 endTime, uint256 startPrice);
    event PriceUpdated(uint256 indexed roundId, uint256 price);
    event AgentTrade(
        uint256 indexed roundId,
        uint256 indexed agentId,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut,
        uint256 price
    );
    event BetPlaced(uint256 indexed roundId, address indexed bettor, uint256 indexed agentId, uint256 amount);
    event RoundSettled(uint256 indexed roundId, uint256 indexed winnerAgentId, uint256 endPrice, bool refundMode);
    event Claimed(uint256 indexed roundId, address indexed bettor, uint256 amount);
    event TreasuryFunded(address indexed from, uint256 amount);
    event GameMasterSet(address indexed newGameMaster);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier onlyGameMaster() {
        require(msg.sender == gameMaster, "not game master");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "reentrant");
        _locked = true;
        _;
        _locked = false;
    }

    constructor() {
        owner = msg.sender;
        gameMaster = msg.sender;
        currentPrice = 1 ether; // 1 MON = 1 CTX at genesis
    }

    // ---------- admin ----------

    function setGameMaster(address _gm) external onlyOwner {
        require(_gm != address(0), "zero address");
        gameMaster = _gm;
        emit GameMasterSet(_gm);
    }

    function fundTreasury() external payable onlyOwner {
        treasury += msg.value;
        emit TreasuryFunded(msg.sender, msg.value);
    }

    function registerAgent(string calldata name, address wallet) external onlyOwner returns (uint256 agentId) {
        require(wallet != address(0), "zero address");
        agentId = agentCount++;
        agents[agentId] = Agent({name: name, wallet: wallet, active: true});
        emit AgentRegistered(agentId, name, wallet);
    }

    function setAgentActive(uint256 agentId, bool active) external onlyOwner {
        require(agentId < agentCount, "bad agent");
        agents[agentId].active = active;
    }

    // ---------- round lifecycle (game master bot) ----------

    function activeRound() public view returns (bool) {
        if (roundCount == 0) return false;
        return !rounds[roundCount - 1].settled;
    }

    function startRound(uint256 duration, uint256 bettingWindow) external onlyGameMaster returns (uint256 roundId) {
        require(!activeRound(), "round active");
        require(duration > bettingWindow && bettingWindow > 0, "bad times");

        uint256 active = 0;
        for (uint256 i = 0; i < agentCount; i++) {
            if (agents[i].active) active++;
        }
        require(active > 0, "no agents");
        uint256 cost = active * ROUND_CAPITAL;
        require(treasury >= cost, "treasury empty");
        treasury -= cost;

        roundId = roundCount++;
        Round storage r = rounds[roundId];
        r.id = roundId;
        r.startTime = block.timestamp;
        r.endTime = block.timestamp + duration;
        r.bettingCloseTime = block.timestamp + bettingWindow;
        r.startPrice = currentPrice;

        for (uint256 i = 0; i < agentCount; i++) {
            if (agents[i].active) {
                positions[roundId][i] = Position({cash: ROUND_CAPITAL, holdings: 0});
            }
        }
        emit RoundStarted(roundId, r.endTime, currentPrice);
    }

    function pushPrice(uint256 newPrice) external onlyGameMaster {
        require(activeRound(), "no active round");
        require(newPrice > 0, "bad price");
        currentPrice = newPrice;
        emit PriceUpdated(roundCount - 1, newPrice);
    }

    // ---------- agent trading ----------

    function _roundId() internal view returns (uint256) {
        require(activeRound(), "no active round");
        return roundCount - 1;
    }

    /// @notice Buy CTX with MON from the agent's round capital.
    function agentBuy(uint256 agentId, uint256 monAmount) external {
        require(agentId < agentCount && agents[agentId].active, "bad agent");
        require(msg.sender == agents[agentId].wallet, "not agent wallet");
        uint256 rid = _roundId();
        Position storage p = positions[rid][agentId];
        require(p.cash >= monAmount && monAmount > 0, "insufficient cash");

        uint256 ctxOut = (monAmount * SCALE) / currentPrice;
        p.cash -= monAmount;
        p.holdings += ctxOut;
        emit AgentTrade(rid, agentId, true, monAmount, ctxOut, currentPrice);
    }

    /// @notice Sell CTX back to MON at the current price.
    function agentSell(uint256 agentId, uint256 ctxAmount) external {
        require(agentId < agentCount && agents[agentId].active, "bad agent");
        require(msg.sender == agents[agentId].wallet, "not agent wallet");
        uint256 rid = _roundId();
        Position storage p = positions[rid][agentId];
        require(p.holdings >= ctxAmount && ctxAmount > 0, "insufficient holdings");

        uint256 monOut = (ctxAmount * currentPrice) / SCALE;
        p.holdings -= ctxAmount;
        p.cash += monOut;
        emit AgentTrade(rid, agentId, false, ctxAmount, monOut, currentPrice);
    }

    function portfolioValue(uint256 roundId, uint256 agentId) public view returns (uint256) {
        Position storage p = positions[roundId][agentId];
        uint256 px = rounds[roundId].settled ? rounds[roundId].endPrice : currentPrice;
        return p.cash + (p.holdings * px) / SCALE;
    }

    // ---------- spectator betting ----------

    function placeBet(uint256 agentId) external payable {
        uint256 rid = _roundId();
        Round storage r = rounds[rid];
        require(block.timestamp <= r.bettingCloseTime, "betting closed");
        require(agentId < agentCount && agents[agentId].active, "bad agent");
        require(msg.value > 0, "zero bet");

        betsOn[rid][agentId] += msg.value;
        betOf[rid][msg.sender][agentId] += msg.value;
        r.betPool += msg.value;
        emit BetPlaced(rid, msg.sender, agentId, msg.value);
    }

    // ---------- settlement ----------

    function settleRound(uint256 roundId) external {
        Round storage r = rounds[roundId];
        require(roundId < roundCount, "bad round");
        require(!r.settled, "already settled");
        require(block.timestamp >= r.endTime, "round not over");

        r.endPrice = currentPrice;
        uint256 best = 0;
        uint256 winner = 0;
        for (uint256 i = 0; i < agentCount; i++) {
            if (!agents[i].active) continue;
            uint256 v = portfolioValue(roundId, i);
            if (v > best) {
                best = v;
                winner = i;
            }
        }
        r.winnerAgentId = winner;
        r.winningBets = betsOn[roundId][winner];
        r.refundMode = (r.winningBets == 0);
        r.settled = true;
        emit RoundSettled(roundId, winner, r.endPrice, r.refundMode);
    }

    /// @notice Winners claim pro-rata share of the pool; everyone gets a refund in refundMode.
    function claim(uint256 roundId) external nonReentrant {
        Round storage r = rounds[roundId];
        require(r.settled, "not settled");
        require(!claimed[roundId][msg.sender], "already claimed");

        uint256 payout = 0;
        if (r.refundMode) {
            for (uint256 i = 0; i < agentCount; i++) {
                payout += betOf[roundId][msg.sender][i];
            }
        } else {
            uint256 myBet = betOf[roundId][msg.sender][r.winnerAgentId];
            require(myBet > 0, "no winning bet");
            payout = (myBet * r.betPool) / r.winningBets;
        }
        require(payout > 0, "nothing to claim");
        claimed[roundId][msg.sender] = true;
        emit Claimed(roundId, msg.sender, payout);
        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");
    }

    // ---------- safety ----------

    function emergencyWithdraw(uint256 amount) external onlyOwner {
        // testnet hackathon only: lets owner recover treasury between rounds
        require(!activeRound(), "round active");
        require(amount <= address(this).balance, "insufficient balance");
        (bool ok, ) = owner.call{value: amount}("");
        require(ok, "transfer failed");
    }
}
