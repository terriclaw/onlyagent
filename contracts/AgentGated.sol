// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

interface IERC8004 {
    function balanceOf(address owner) external view returns (uint256);
}

interface IAgentReputation {
    function recordAction(address agent, address contractAddress) external;
    function getAgentInfo(address agent) external view returns (
        uint256 score,
        uint256 totalActions,
        uint256 uniqueContracts,
        uint256 firstActionAt,
        uint256 lastActionAt
    );
}

interface IValidationRegistry {
    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external;

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external;
}

abstract contract AgentGated {
    using ECDSA for bytes32;
    using Strings for uint256;

    address public owner;
    IERC8004 public immutable erc8004Registry;
    IAgentReputation public immutable reputation;
    IValidationRegistry public immutable validationRegistry;

    mapping(address => bool) public trustedTEEProviders;
    mapping(bytes32 => bool) public usedNonces;
    mapping(address => uint256) public agentIds;

    uint256 public proofValidityWindow = 2 minutes;

    event AgentVerified(address indexed agent, address indexed contractAddress, uint256 timestamp);
    event TEEProviderAdded(address indexed provider);
    event TEEProviderRemoved(address indexed provider);
    event AgentIdSet(address indexed agent, uint256 indexed agentId);

    constructor(
        address _erc8004Registry,
        address _reputation,
        address _validationRegistry,
        address[] memory _teeProviders
    ) {
        owner = msg.sender;
        erc8004Registry = IERC8004(_erc8004Registry);
        reputation = IAgentReputation(_reputation);
        validationRegistry = IValidationRegistry(_validationRegistry);

        for (uint256 i = 0; i < _teeProviders.length; i++) {
            trustedTEEProviders[_teeProviders[i]] = true;
            emit TEEProviderAdded(_teeProviders[i]);
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "OnlyAgent: not owner");
        _;
    }

    function addTEEProvider(address provider) external onlyOwner {
        trustedTEEProviders[provider] = true;
        emit TEEProviderAdded(provider);
    }

    function removeTEEProvider(address provider) external onlyOwner {
        trustedTEEProviders[provider] = false;
        emit TEEProviderRemoved(provider);
    }

    function setAgentId(address agent, uint256 agentId) external onlyOwner {
        require(agent != address(0), "OnlyAgent: bad agent");
        require(agentId > 0, "OnlyAgent: bad agentId");
        agentIds[agent] = agentId;
        emit AgentIdSet(agent, agentId);
    }

    function _hexStringNoPrefix(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory out = new bytes(64);
        bytes memory data = abi.encodePacked(value);
        for (uint256 i = 0; i < 32; i++) {
            out[i * 2]     = alphabet[uint8(data[i] >> 4)];
            out[i * 2 + 1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(out);
    }

    function _veniceSignedText(bytes32 promptHash, bytes32 responseHash)
        internal pure returns (bytes memory)
    {
        return bytes(string(abi.encodePacked(
            _hexStringNoPrefix(promptHash),
            ":",
            _hexStringNoPrefix(responseHash)
        )));
    }

    function _validationRequestHash(
        bytes32 promptHash,
        bytes32 responseHash,
        address agent,
        uint256 timestamp
    ) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                promptHash,
                responseHash,
                agent,
                address(this),
                timestamp,
                block.chainid
            )
        );
    }

    modifier onlyAgent(
        bytes32 promptHash,
        bytes32 responseHash,
        uint256 timestamp,
        bytes memory teeSignature
    ) {
        require(
            erc8004Registry.balanceOf(msg.sender) > 0,
            "OnlyAgent: not a registered agent"
        );

        require(timestamp <= block.timestamp, "OnlyAgent: proof from future");
        require(
            block.timestamp <= timestamp + proofValidityWindow,
            "OnlyAgent: proof expired"
        );

        bytes32 requestHash = _validationRequestHash(
            promptHash,
            responseHash,
            msg.sender,
            timestamp
        );

        require(!usedNonces[requestHash], "OnlyAgent: proof already used");
        usedNonces[requestHash] = true;

        // Venice signs EXACTLY: "{promptHash}:{responseHash}"
        // 64 hex chars + ":" + 64 hex chars (no 0x prefix)
        // Total length = 129 bytes
        // EIP-191 prefix length MUST match this exact encoding
        // If Venice changes format, verification will fail
        bytes memory veniceText = _veniceSignedText(promptHash, responseHash);
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n",
            Strings.toString(veniceText.length),
            veniceText
        ));

        address signer = ECDSA.recover(ethSignedHash, teeSignature);
        require(trustedTEEProviders[signer], "OnlyAgent: untrusted TEE provider");

        uint256 agentId = agentIds[msg.sender];
        require(agentId > 0, "OnlyAgent: agentId not set");

        validationRegistry.validationRequest(address(this), agentId, "", requestHash);

        reputation.recordAction(msg.sender, address(this));
        emit AgentVerified(msg.sender, address(this), block.timestamp);

        _;
    }
}
