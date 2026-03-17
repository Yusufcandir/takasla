// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MerkleAnchor {
    struct Anchor {
        uint256 timestamp;
        address submitter;
    }

    mapping(bytes32 => Anchor) public anchors;

    event Anchored(bytes32 indexed merkleRoot, uint256 timestamp, address submitter);

    function anchor(bytes32 merkleRoot) external {
        require(anchors[merkleRoot].timestamp == 0, "Already anchored");
        anchors[merkleRoot] = Anchor(block.timestamp, msg.sender);
        emit Anchored(merkleRoot, block.timestamp, msg.sender);
    }

    function getAnchor(bytes32 merkleRoot) external view returns (uint256 timestamp, address submitter) {
        Anchor memory a = anchors[merkleRoot];
        return (a.timestamp, a.submitter);
    }

    function isAnchored(bytes32 merkleRoot) external view returns (bool) {
        return anchors[merkleRoot].timestamp > 0;
    }
}
