// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentReputation {
    address public owner;
    address public agentGatedContract;

    struct AgentScore {
        uint256 score;
        uint256 totalActions;
        uint256 uniqueContracts;
        uint256 firstActionAt;
        uint256 lastActionAt;
        mapping(address => bool) contractsSeen;
    }

    mapping(address => AgentScore) public scores;
    address[] public allAgents;
    mapping(address => bool) public knownAgents;

    // Contract registry
    address[] public allContracts;
    mapping(address => bool) public registeredContracts;

    event ScoreIncremented(address indexed agent, uint256 newScore, address contractAddress);
    event ScoreReset(address indexed agent);
    event NewContractRegistered(address indexed contractAddress);

    modifier onlyAgentGated() {
        require(msg.sender == agentGatedContract, "Not authorized");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function setAgentGatedContract(address _agentGated) external {
        require(msg.sender == owner, "Not owner");
        agentGatedContract = _agentGated;
    }

    function recordAction(address agent, address contractAddress) external onlyAgentGated {
        AgentScore storage s = scores[agent];

        if (s.firstActionAt == 0) {
            s.firstActionAt = block.timestamp;
            allAgents.push(agent);
            knownAgents[agent] = true;
        }

        s.score++;
        s.totalActions++;
        s.lastActionAt = block.timestamp;

        if (!s.contractsSeen[contractAddress]) {
            s.contractsSeen[contractAddress] = true;
            s.uniqueContracts++;
        }

        if (!registeredContracts[contractAddress]) {
            registeredContracts[contractAddress] = true;
            allContracts.push(contractAddress);
            emit NewContractRegistered(contractAddress);
        }

        emit ScoreIncremented(agent, s.score, contractAddress);
    }

    function resetScore(address agent) external {
        require(msg.sender == owner, "Not owner");
        AgentScore storage s = scores[agent];
        s.score = 0;
        s.totalActions = 0;
        s.uniqueContracts = 0;
        s.firstActionAt = 0;
        s.lastActionAt = 0;
        emit ScoreReset(agent);
    }

    function getScore(address agent) external view returns (uint256) {
        return scores[agent].score;
    }

    function getAgentInfo(address agent) external view returns (
        uint256 score,
        uint256 totalActions,
        uint256 uniqueContracts,
        uint256 firstActionAt,
        uint256 lastActionAt
    ) {
        AgentScore storage s = scores[agent];
        return (s.score, s.totalActions, s.uniqueContracts, s.firstActionAt, s.lastActionAt);
    }

    function getAllAgents() external view returns (address[] memory) {
        return allAgents;
    }

    function getAllContracts() external view returns (address[] memory) {
        return allContracts;
    }
}
