// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./AgentGated.sol";

contract OnlyAgent is AgentGated {
    event RealAgentProved(
        address indexed agent,
        uint256 newScore,
        uint256 uniqueContracts,
        uint256 timestamp
    );

    constructor(
        address _erc8004Registry,
        address _reputation,
        address _validationRegistry,
        address[] memory _teeProviders
    ) AgentGated(_erc8004Registry, _reputation, _validationRegistry, _teeProviders) {}

    function prove(
        bytes32 promptHash,
        bytes32 responseHash,
        uint256 timestamp,
        bytes memory teeSignature
    )
        external
        onlyAgent(promptHash, responseHash, timestamp, teeSignature)
        returns (string memory)
    {
        bytes32 requestHash = _validationRequestHash(
            promptHash,
            responseHash,
            msg.sender,
            timestamp
        );

        validationRegistry.validationResponse(
            requestHash,
            100,
            "",
            bytes32(0),
            "tee-attestation"
        );

        (
            uint256 score,
            ,
            uint256 uniqueContracts,
            ,

        ) = reputation.getAgentInfo(msg.sender);

        emit RealAgentProved(
            msg.sender,
            score,
            uniqueContracts,
            block.timestamp
        );

        return "onlyAgent:verified";
    }
}
