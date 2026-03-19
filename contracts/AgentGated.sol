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

abstract contract AgentGated {
    using ECDSA for bytes32;
    using Strings for uint256;

    address public owner;
    IERC8004 public immutable erc8004Registry;
    IAgentReputation public immutable reputation;

    mapping(address => bool) public trustedTEEProviders;
    mapping(bytes32 => bool) public usedNonces;

    uint256 public proofValidityWindow = 2 minutes;

    event AgentVerified(address indexed agent, address indexed contractAddress, uint256 timestamp);
    event TEEProviderAdded(address indexed provider);
    event TEEProviderRemoved(address indexed provider);

    constructor(
        address _erc8004Registry,
        address _reputation,
        address[] memory _teeProviders
    ) {
        owner = msg.sender;
        erc8004Registry = IERC8004(_erc8004Registry);
        reputation = IAgentReputation(_reputation);
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

    /// @dev Produces 64-char lowercase hex with no 0x prefix.
    ///      MUST match the exact format Venice uses in its signed text field.
    ///      Verify by checking sigPayload.text in agent.js before deploying.
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

    /// @dev Reconstruct Venice's signed text: "{promptHash}:{responseHash}"
    ///      where each hash is 64 lowercase hex chars (no 0x prefix).
    function _veniceSignedText(bytes32 promptHash, bytes32 responseHash)
        internal pure returns (bytes memory)
    {
        return bytes(string(abi.encodePacked(
            _hexStringNoPrefix(promptHash),
            ":",
            _hexStringNoPrefix(responseHash)
        )));
    }

    modifier onlyAgent(
        bytes32 promptHash,
        bytes32 responseHash,
        uint256 timestamp,
        bytes memory teeSignature
    ) {
        // 1. ERC-8004 agent identity
        require(
            erc8004Registry.balanceOf(msg.sender) > 0,
            "OnlyAgent: not a registered agent"
        );

        // 2. Freshness
        require(timestamp <= block.timestamp, "OnlyAgent: proof from future");
        require(
            block.timestamp <= timestamp + proofValidityWindow,
            "OnlyAgent: proof expired"
        );

        // 3. Replay protection — binds Venice proof to this specific action context
        bytes32 replayKey = keccak256(abi.encodePacked(
            promptHash,
            responseHash,
            msg.sender,
            address(this),
            timestamp,
            block.chainid
        ));
        require(!usedNonces[replayKey], "OnlyAgent: proof already used");
        usedNonces[replayKey] = true;

        // 4. Verify Venice personal_sign(promptHash:responseHash) directly
        bytes memory veniceText = _veniceSignedText(promptHash, responseHash);
        bytes32 ethSignedHash = keccak256(abi.encodePacked(
            "\x19Ethereum Signed Message:\n",
            Strings.toString(veniceText.length),
            veniceText
        ));
        address signer = ECDSA.recover(ethSignedHash, teeSignature);
        require(trustedTEEProviders[signer], "OnlyAgent: untrusted TEE provider");

        // 5. Reputation
        reputation.recordAction(msg.sender, address(this));
        emit AgentVerified(msg.sender, address(this), block.timestamp);

        _;
    }
}
