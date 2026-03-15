// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// MockERC8004 — used for Status Network Sepolia testnet deployment
// The real ERC-8004 registry is not deployed on Status Sepolia.
// This mock returns 1 for every address so the onlyAgent modifier passes.
contract MockERC8004 {
    function balanceOf(address) external pure returns (uint256) {
        return 1;
    }
}
