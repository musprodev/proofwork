// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ProofWork} from "../src/ProofWork.sol";

contract ProofWorkTest is Test {
    ProofWork public proofWork;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    bytes32 public constant AGENT_ID = keccak256("openswarm-build-agent");

    function setUp() public {
        proofWork = new ProofWork();
    }

    function test_RegisterAgent_Succeeds() public {
        vm.prank(alice);
        proofWork.registerAgent(AGENT_ID);
        assertEq(proofWork.getController(AGENT_ID), alice);
        assertTrue(proofWork.isRegistered(AGENT_ID));
    }

    function test_RegisterAgent_RevertsOnDoubleRegister() public {
        vm.prank(alice);
        proofWork.registerAgent(AGENT_ID);
        vm.prank(bob);
        vm.expectRevert(ProofWork.AlreadyRegistered.selector);
        proofWork.registerAgent(AGENT_ID);
    }

    function test_Attest_Succeeds() public {
        vm.prank(alice);
        proofWork.registerAgent(AGENT_ID);
        vm.prank(alice);
        proofWork.attest(AGENT_ID, keccak256("diff-1"), "commit");
        assertEq(proofWork.getAttestationCount(AGENT_ID), 1);
    }

    function test_Attest_RevertsIfNotController() public {
        vm.prank(alice);
        proofWork.registerAgent(AGENT_ID);
        vm.prank(bob);
        vm.expectRevert(ProofWork.NotController.selector);
        proofWork.attest(AGENT_ID, keccak256("diff-1"), "commit");
    }

    function test_ControllerTransfer_FullFlow() public {
        vm.prank(alice);
        proofWork.registerAgent(AGENT_ID);
        vm.prank(alice);
        proofWork.transferController(AGENT_ID, bob);
        vm.prank(bob);
        proofWork.acceptController(AGENT_ID);
        assertEq(proofWork.getController(AGENT_ID), bob);
    }

    function test_AcceptController_RevertsIfNotPending() public {
        vm.prank(alice);
        proofWork.registerAgent(AGENT_ID);
        vm.prank(bob);
        vm.expectRevert(ProofWork.NotPendingController.selector);
        proofWork.acceptController(AGENT_ID);
    }

    function testFuzz_Attest_CountMatchesCalls(uint8 numAttestations) public {
        vm.assume(numAttestations > 0);
        vm.startPrank(alice);
        proofWork.registerAgent(AGENT_ID);
        for (uint256 i = 0; i < numAttestations; i++) {
            proofWork.attest(AGENT_ID, keccak256(abi.encode(i)), "commit");
        }
        vm.stopPrank();
        assertEq(proofWork.getAttestationCount(AGENT_ID), numAttestations);
    }

    // ── Edge-case tests ──────────────────────────────────────────────

    function test_RegisterAgent_ZeroAgentId() public {
        // bytes32(0) is a valid agentId — no reason to prohibit it
        vm.prank(alice);
        proofWork.registerAgent(bytes32(0));
        assertTrue(proofWork.isRegistered(bytes32(0)));
        assertEq(proofWork.getController(bytes32(0)), alice);
    }

    function test_Attest_RevertsOnUnregisteredAgent() public {
        // Nobody registered this agentId, so controller is address(0).
        // Any msg.sender != address(0) should revert NotController.
        bytes32 unknownAgent = keccak256("never-registered");
        vm.prank(alice);
        vm.expectRevert(ProofWork.NotController.selector);
        proofWork.attest(unknownAgent, keccak256("payload"), "commit");
    }

    function test_TransferController_RevertsOnZeroAddress() public {
        vm.prank(alice);
        proofWork.registerAgent(AGENT_ID);
        vm.prank(alice);
        vm.expectRevert(ProofWork.ZeroAddress.selector);
        proofWork.transferController(AGENT_ID, address(0));
    }

    function test_TransferController_ToSelf() public {
        // Transferring to yourself is allowed — pendingController is set,
        // and you still need to call acceptController to complete it.
        vm.startPrank(alice);
        proofWork.registerAgent(AGENT_ID);
        proofWork.transferController(AGENT_ID, alice);
        assertEq(proofWork.getPendingController(AGENT_ID), alice);
        proofWork.acceptController(AGENT_ID);
        assertEq(proofWork.getController(AGENT_ID), alice);
        assertEq(proofWork.getPendingController(AGENT_ID), address(0));
        vm.stopPrank();
    }

    function test_Attest_EmitsCorrectEvent() public {
        vm.startPrank(alice);
        proofWork.registerAgent(AGENT_ID);

        bytes32 hash1 = keccak256("action-1");
        vm.expectEmit(true, true, false, true);
        emit ProofWork.Attested(AGENT_ID, hash1, "file_write", 1, block.timestamp);
        proofWork.attest(AGENT_ID, hash1, "file_write");

        // Second attestation must have sequenceNumber = 2
        bytes32 hash2 = keccak256("action-2");
        vm.expectEmit(true, true, false, true);
        emit ProofWork.Attested(AGENT_ID, hash2, "commit", 2, block.timestamp);
        proofWork.attest(AGENT_ID, hash2, "commit");

        vm.stopPrank();
    }
}
