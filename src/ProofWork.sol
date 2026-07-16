// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title ProofWork
/// @notice Tamper-evident, timestamped attestation log for AI coding agent actions.
contract ProofWork {
    error AlreadyRegistered();
    error NotController();
    error NotPendingController();
    error ZeroAddress();

    struct Agent {
        address controller;
        address pendingController;
        bool registered;
    }

    mapping(bytes32 agentId => Agent) private s_agents;
    mapping(bytes32 agentId => uint256) private s_attestationCount;

    event AgentRegistered(bytes32 indexed agentId, address indexed controller);
    event ControllerTransferStarted(
        bytes32 indexed agentId, address indexed currentController, address indexed pendingController
    );
    event ControllerTransferAccepted(
        bytes32 indexed agentId, address indexed previousController, address indexed newController
    );
    event Attested(
        bytes32 indexed agentId,
        bytes32 indexed actionHash,
        string actionType,
        uint256 sequenceNumber,
        uint256 timestamp
    );

    modifier onlyController(bytes32 agentId) {
        if (s_agents[agentId].controller != msg.sender) revert NotController();
        _;
    }

    function registerAgent(bytes32 agentId) external {
        if (s_agents[agentId].registered) revert AlreadyRegistered();
        s_agents[agentId] = Agent({controller: msg.sender, pendingController: address(0), registered: true});
        emit AgentRegistered(agentId, msg.sender);
    }

    function attest(bytes32 agentId, bytes32 actionHash, string calldata actionType) external onlyController(agentId) {
        uint256 seq = ++s_attestationCount[agentId];
        emit Attested(agentId, actionHash, actionType, seq, block.timestamp);
    }

    function transferController(bytes32 agentId, address newController) external onlyController(agentId) {
        if (newController == address(0)) revert ZeroAddress();
        s_agents[agentId].pendingController = newController;
        emit ControllerTransferStarted(agentId, msg.sender, newController);
    }

    function acceptController(bytes32 agentId) external {
        Agent storage agent = s_agents[agentId];
        if (msg.sender != agent.pendingController) revert NotPendingController();
        address previous = agent.controller;
        agent.controller = msg.sender;
        agent.pendingController = address(0);
        emit ControllerTransferAccepted(agentId, previous, msg.sender);
    }

    function getAttestationCount(bytes32 agentId) external view returns (uint256) {
        return s_attestationCount[agentId];
    }

    function getController(bytes32 agentId) external view returns (address) {
        return s_agents[agentId].controller;
    }

    function getPendingController(bytes32 agentId) external view returns (address) {
        return s_agents[agentId].pendingController;
    }

    function isRegistered(bytes32 agentId) external view returns (bool) {
        return s_agents[agentId].registered;
    }
}
