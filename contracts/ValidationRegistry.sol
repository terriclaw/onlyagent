// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IIdentityRegistry {
    function isAuthorizedOrOwner(address spender, uint256 agentId) external view returns (bool);
}

contract ValidationRegistry {
    address private immutable _identityRegistry;

    struct Validation {
        address validatorAddress;
        uint256 agentId;
        uint8 response;
        bytes32 responseHash;
        string tag;
        uint256 lastUpdate;
        bool exists;
    }

    mapping(bytes32 => Validation) private _validations;
    mapping(uint256 => bytes32[]) private _agentValidations;
    mapping(address => bytes32[]) private _validatorRequests;

    event ValidationRequest(
        address indexed validatorAddress,
        uint256 indexed agentId,
        string requestURI,
        bytes32 indexed requestHash
    );

    event ValidationResponse(
        address indexed validatorAddress,
        uint256 indexed agentId,
        bytes32 indexed requestHash,
        uint8 response,
        string responseURI,
        bytes32 responseHash,
        string tag
    );

    constructor(address identityRegistry_) {
        require(identityRegistry_ != address(0), "bad identity");
        _identityRegistry = identityRegistry_;
    }

    function getIdentityRegistry() external view returns (address identityRegistry) {
        return _identityRegistry;
    }

    function validationRequest(
        address validatorAddress,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external {
        require(validatorAddress != address(0), "bad validator");
        require(requestHash != bytes32(0), "bad request hash");
        require(
            IIdentityRegistry(_identityRegistry).isAuthorizedOrOwner(msg.sender, agentId),
            "not owner/operator"
        );
        require(!_validations[requestHash].exists, "request exists");

        _validations[requestHash] = Validation({
            validatorAddress: validatorAddress,
            agentId: agentId,
            response: 0,
            responseHash: bytes32(0),
            tag: "",
            lastUpdate: block.timestamp,
            exists: true
        });

        _agentValidations[agentId].push(requestHash);
        _validatorRequests[validatorAddress].push(requestHash);

        emit ValidationRequest(validatorAddress, agentId, requestURI, requestHash);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external {
        require(response <= 100, "bad response");

        Validation storage v = _validations[requestHash];
        require(v.exists, "unknown request");
        require(msg.sender == v.validatorAddress, "not validator");

        v.response = response;
        v.responseHash = responseHash;
        v.tag = tag;
        v.lastUpdate = block.timestamp;

        emit ValidationResponse(
            v.validatorAddress,
            v.agentId,
            requestHash,
            response,
            responseURI,
            responseHash,
            tag
        );
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        returns (
            address validatorAddress,
            uint256 agentId,
            uint8 response,
            bytes32 responseHash,
            string memory tag,
            uint256 lastUpdate
        )
    {
        Validation storage v = _validations[requestHash];
        require(v.exists, "unknown request");
        return (
            v.validatorAddress,
            v.agentId,
            v.response,
            v.responseHash,
            v.tag,
            v.lastUpdate
        );
    }

    function getSummary(
        uint256 agentId,
        address[] calldata validatorAddresses,
        string calldata tag
    ) external view returns (uint64 count, uint8 averageResponse) {
        bytes32[] storage reqs = _agentValidations[agentId];
        bytes32 tagHash = keccak256(bytes(tag));

        uint256 sum;
        for (uint256 i = 0; i < reqs.length; i++) {
            Validation storage v = _validations[reqs[i]];

            bool validatorMatch = validatorAddresses.length == 0;
            for (uint256 j = 0; j < validatorAddresses.length; j++) {
                if (v.validatorAddress == validatorAddresses[j]) {
                    validatorMatch = true;
                    break;
                }
            }
            if (!validatorMatch) continue;

            if (bytes(tag).length > 0 && keccak256(bytes(v.tag)) != tagHash) continue;

            sum += v.response;
            count++;
        }

        if (count > 0) {
            averageResponse = uint8(sum / count);
        }
    }

    function getAgentValidations(uint256 agentId) external view returns (bytes32[] memory requestHashes) {
        return _agentValidations[agentId];
    }

    function getValidatorRequests(address validatorAddress) external view returns (bytes32[] memory requestHashes) {
        return _validatorRequests[validatorAddress];
    }
}
