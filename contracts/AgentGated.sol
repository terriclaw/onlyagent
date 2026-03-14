// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
        for (uint i = 0; i < _teeProviders.length; i++) {
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

        require(
            block.timestamp <= timestamp + proofValidityWindow,
            "OnlyAgent: proof expired"
        );

        bytes32 commitment = keccak256(
            abi.encodePacked(
                promptHash,
                responseHash,
                msg.sender,
                address(this),
                timestamp
            )
        );

        require(!usedNonces[commitment], "OnlyAgent: proof already used");
        usedNonces[commitment] = true;

        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", commitment)
        );

        address signer = recoverSigner(ethSignedHash, teeSignature);
        require(signer != address(0), "OnlyAgent: invalid signature");
        require(trustedTEEProviders[signer], "OnlyAgent: untrusted TEE provider");

        reputation.recordAction(msg.sender, address(this));

        emit AgentVerified(msg.sender, address(this), block.timestamp);

        _;
    }

    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        return ecrecover(hash, v, r, s);
    }
}
