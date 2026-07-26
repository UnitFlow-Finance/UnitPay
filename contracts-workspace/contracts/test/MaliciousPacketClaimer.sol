// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IUnitPayPacketClaim {
    function claim(uint256 packetId) external returns (uint256 amount);
}

/**
 * @title MaliciousPacketClaimer
 * @notice Test-only contract that calls UnitPayPacket.claim() on behalf of
 *         its deployer. Used solely to verify that UnitPayPacket rejects
 *         non-EOA callers (msg.sender != tx.origin), which closes off the
 *         "wrapper contract reverts on an unfavorable random-split draw and
 *         retries in a later block" attack. Never deployed to Arc Testnet.
 */
contract MaliciousPacketClaimer {
    function claimVia(address packet, uint256 packetId) external returns (uint256 amount) {
        return IUnitPayPacketClaim(packet).claim(packetId);
    }

    /**
     * @notice Simulates the "reroll" exploit pattern this contract exists
     *         to test against: claim, then revert the whole transaction if
     *         the draw is below `minAcceptable`. Absent the
     *         `msg.sender == tx.origin` guard in UnitPayPacket.claim, an
     *         attacker could call this repeatedly across blocks (each
     *         attempt using fresh blockhash/prevrandao entropy) until it
     *         lands a favorable share, at zero cost beyond gas on the
     *         reverted attempts and no on-chain trace of the failed tries
     *         (hasClaimed is never persisted on a full revert).
     */
    function greedyClaim(address packet, uint256 packetId, uint256 minAcceptable)
        external
        returns (uint256 amount)
    {
        amount = IUnitPayPacketClaim(packet).claim(packetId);
        require(amount >= minAcceptable, "reroll: draw too low, reverting to retry later");
    }
}
