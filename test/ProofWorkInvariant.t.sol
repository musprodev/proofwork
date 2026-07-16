// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ProofWork} from "../src/ProofWork.sol";

contract ProofWorkHandler is Test {
    ProofWork public proofWork;
    bytes32 public constant AGENT_ID = keccak256("handler-agent");
    uint256 public ghost_attestCalls;

    constructor(ProofWork _proofWork) {
        proofWork = _proofWork;
        proofWork.registerAgent(AGENT_ID);
    }

    function attest(uint256 seed) public {
        proofWork.attest(AGENT_ID, keccak256(abi.encode(seed)), "commit");
        ghost_attestCalls++;
    }
}

contract ProofWorkInvariantTest is StdInvariant, Test {
    ProofWork public proofWork;
    ProofWorkHandler public handler;

    function setUp() public {
        proofWork = new ProofWork();
        handler = new ProofWorkHandler(proofWork);
        targetContract(address(handler));
    }

    function invariant_CountMatchesCalls() public view {
        assertEq(proofWork.getAttestationCount(handler.AGENT_ID()), handler.ghost_attestCalls());
    }
}
