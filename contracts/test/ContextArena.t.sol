// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ContextArena} from "../src/ContextArena.sol";

contract ContextArenaTest is Test {
    ContextArena arena;
    address owner = address(0xA11CE);
    address agent0 = address(0xB0B);
    address agent1 = address(0xC0C);
    address bettor = address(0xD0D);

    function setUp() public {
        vm.prank(owner);
        arena = new ContextArena();
        vm.deal(owner, 10000 ether);
        vm.deal(agent0, 10 ether);
        vm.deal(agent1, 10 ether);
        vm.deal(bettor, 100 ether);

        vm.prank(owner);
        arena.registerAgent("Degen Dan", agent0);
        vm.prank(owner);
        arena.registerAgent("Professor", agent1);
    }

    function test_full_round() public {
        // owner is gameMaster by default
        vm.prank(owner);
        uint256 rid = arena.startRound(600, 420);

        // agent0 buys 50 MON worth of CTX at price 1.0
        vm.prank(agent0);
        arena.agentBuy(0, 50 ether);

        // price doubles
        vm.prank(owner);
        arena.pushPrice(2 ether);

        // agent1 buys 100 MON worth at price 2.0 -> 50 CTX
        vm.prank(agent1);
        arena.agentBuy(1, 100 ether);

        // bettor bets 10 MON on agent0 (the winner-to-be)
        vm.prank(bettor);
        arena.placeBet{value: 10 ether}(0);

        // another bettor bets 10 on agent1
        address bettor2 = address(0xE0E);
        vm.deal(bettor2, 100 ether);
        vm.prank(bettor2);
        arena.placeBet{value: 10 ether}(1);

        // portfolio check at price 2.0:
        // agent0: 50 cash + 50 CTX * 2 = 150 | agent1: 0 cash + 50 CTX * 2 = 100
        assertEq(arena.portfolioValue(rid, 0), 150 ether);
        assertEq(arena.portfolioValue(rid, 1), 100 ether);

        vm.warp(block.timestamp + 601);
        arena.settleRound(rid);

        (,,,,,, bool settled, bool refundMode, uint256 winner,,) = arena.rounds(rid);
        assertTrue(settled);
        assertFalse(refundMode);
        assertEq(winner, 0);

        // bettor claims: 10/10 of 20 pool = 20
        uint256 before = bettor.balance;
        vm.prank(bettor);
        arena.claim(rid);
        assertEq(bettor.balance - before, 20 ether);
    }

    function test_betting_closed_after_window() public {
        vm.prank(owner);
        arena.startRound(600, 420);
        vm.warp(block.timestamp + 421);
        vm.prank(bettor);
        vm.expectRevert("betting closed");
        arena.placeBet{value: 1 ether}(0);
    }

    function test_refund_mode() public {
        vm.prank(owner);
        uint256 rid = arena.startRound(600, 420);
        // bet only on agent1, but agent0 wins (does nothing, keeps 100 cash; agent1 buys at top then price crashes)
        vm.prank(agent1);
        arena.agentBuy(1, 100 ether);
        vm.prank(owner);
        arena.pushPrice(0.5 ether);
        vm.prank(bettor);
        arena.placeBet{value: 5 ether}(1);

        vm.warp(block.timestamp + 601);
        arena.settleRound(rid);
        (,,,,,, bool settled, bool refundMode,,,) = arena.rounds(rid);
        assertTrue(settled && refundMode);

        uint256 before = bettor.balance;
        vm.prank(bettor);
        arena.claim(rid);
        assertEq(bettor.balance - before, 5 ether);
    }
}
