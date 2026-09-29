// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {ContextArena} from "../src/ContextArena.sol";

/// @notice Deploy with:
/// forge script script/Deploy.s.sol:DeployScript --rpc-url monad_testnet --legacy --broadcast
contract DeployScript is Script {
    function run() external returns (ContextArena arena) {
        vm.startBroadcast();
        arena = new ContextArena();
        vm.stopBroadcast();
    }
}
