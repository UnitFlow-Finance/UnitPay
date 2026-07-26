// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UnitPayPacket
 * @notice "Unit Packet" — a WeChat-hongbao-style USDC giveaway. A creator
 *         locks a total amount split across `maxClaims` shares; each
 *         address can claim exactly one share, either an equal cut or a
 *         randomized cut (classic red-packet algorithm below). Any
 *         unclaimed remainder returns to the creator after expiry.
 *
 * @dev Split amounts are computed entirely on-chain at claim time — never
 *      client-side — so a claimer's browser cannot influence or predict
 *      their own share ahead of the transaction. The randomness source
 *      (`blockhash`/`block.prevrandao` mixed with the claimer address and
 *      claim index) is the standard "good enough for non-adversarial-value
 *      giveaways" approach: it is technically influenceable by the block
 *      producer, but there's no economically meaningful way to bias a
 *      giveaway split in one's own favor without controlling both the
 *      claiming address AND block production, and the amounts at stake in
 *      this product don't justify a VRF/oracle. Do not reuse this pattern
 *      for anything security-critical.
 *
 *      TESTNET ONLY — see UnitPayTransfer.sol for the same caveat.
 */
contract UnitPayPacket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum SplitMode {
        Equal,
        Random
    }

    struct Packet {
        address creator;
        uint256 totalAmount;
        uint256 remainingAmount;
        uint32 maxClaims;
        uint32 claimsMade;
        SplitMode splitMode;
        uint64 createdAt;
        uint64 expiresAt;
        bool reclaimed;
    }

    IERC20 public immutable usdc;
    uint256 public nextPacketId;
    mapping(uint256 => Packet) public packets;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    /// @notice Bounds on how many shares a single packet may be split into.
    uint32 public constant MAX_CLAIMS_PER_PACKET = 200;
    /// @notice Bounds on how long before a packet's unclaimed remainder can be reclaimed.
    uint64 public constant MIN_EXPIRES_IN = 10 minutes;
    uint64 public constant MAX_EXPIRES_IN = 365 days;

    event PacketCreated(
        uint256 indexed packetId,
        address indexed creator,
        uint256 totalAmount,
        uint32 maxClaims,
        SplitMode splitMode,
        uint64 expiresAt
    );
    event PacketClaimed(
        uint256 indexed packetId,
        address indexed claimer,
        uint256 amount,
        uint32 claimsMade
    );
    event PacketReclaimed(uint256 indexed packetId, uint256 amount);

    error PacketNotFound();
    error ZeroClaims();
    error TooManyClaims();
    error ZeroAmount();
    error AmountTooSmall();
    error ExpiryOutOfRange();
    error PacketExpired();
    error PacketNotExpired();
    error FullyClaimed();
    error AlreadyClaimed();
    error NotCreator();
    error NothingToReclaim();
    error ZeroAddress();
    error ContractsCannotClaim();

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    /**
     * @notice Locks `totalAmount` of USDC, split across `maxClaims` shares.
     * @param maxClaims   Number of shares (claimers). 1-200.
     * @param totalAmount USDC amount to lock, in base units. Must be at
     *                    least `maxClaims` (so every share is >= 1 unit).
     * @param splitMode   Equal: every share is `totalAmount / maxClaims`
     *                    (the final claim also picks up any remainder from
     *                    integer division). Random: WeChat-style random
     *                    cut of what's left each time (see `_computeShare`).
     * @param expiresIn   Seconds from now after which the creator may
     *                    reclaim any unclaimed remainder. 10 minutes - 365
     *                    days.
     * @dev Caller must have approved this contract for at least `totalAmount`.
     */
    function createPacket(
        uint32 maxClaims,
        uint256 totalAmount,
        SplitMode splitMode,
        uint64 expiresIn
    ) external nonReentrant returns (uint256 packetId) {
        if (maxClaims == 0) revert ZeroClaims();
        if (maxClaims > MAX_CLAIMS_PER_PACKET) revert TooManyClaims();
        if (totalAmount == 0) revert ZeroAmount();
        if (totalAmount < maxClaims) revert AmountTooSmall();
        if (expiresIn < MIN_EXPIRES_IN || expiresIn > MAX_EXPIRES_IN) revert ExpiryOutOfRange();

        packetId = nextPacketId++;
        uint64 expiresAt = uint64(block.timestamp) + expiresIn;

        packets[packetId] = Packet({
            creator: msg.sender,
            totalAmount: totalAmount,
            remainingAmount: totalAmount,
            maxClaims: maxClaims,
            claimsMade: 0,
            splitMode: splitMode,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            reclaimed: false
        });

        usdc.safeTransferFrom(msg.sender, address(this), totalAmount);

        emit PacketCreated(packetId, msg.sender, totalAmount, maxClaims, splitMode, expiresAt);
    }

    /**
     * @notice Claims one share of the packet for the caller. Each address
     *         may claim at most once per packet.
     * @return amount The USDC amount (base units) transferred to the caller.
     */
    function claim(uint256 packetId) external nonReentrant returns (uint256 amount) {
        // Random-mode shares are drawn from block-level entropy (see
        // _computeShare) — a contract could otherwise claim through a
        // wrapper that reverts on an unfavorable draw and retries in a
        // later block ("rerolling") until it wins a large share, at the
        // expense of other claimers. A plain EOA has no way to preview a
        // draw and revert before it lands, since the entropy isn't known
        // until execution; requiring the claimer to be the transaction's
        // origin closes that wrapper-contract path. This does not affect
        // this app's own users: Circle User-Controlled Wallets on Arc
        // Testnet are EOAs (see app/api/wallet/initialize/route.ts), so
        // msg.sender == tx.origin holds for every legitimate claim.
        if (msg.sender != tx.origin) revert ContractsCannotClaim();

        Packet storage p = _requireExists(packetId);

        if (block.timestamp > p.expiresAt) revert PacketExpired();
        if (p.claimsMade >= p.maxClaims) revert FullyClaimed();
        if (hasClaimed[packetId][msg.sender]) revert AlreadyClaimed();

        amount = _computeShare(p, packetId);

        hasClaimed[packetId][msg.sender] = true;
        p.claimsMade += 1;
        p.remainingAmount -= amount;

        usdc.safeTransfer(msg.sender, amount);

        emit PacketClaimed(packetId, msg.sender, amount, p.claimsMade);
    }

    /**
     * @notice Returns any unclaimed remainder to the creator once the
     *         packet has expired. Callable by anyone, but funds always go
     *         to the original creator.
     */
    function reclaim(uint256 packetId) external nonReentrant {
        Packet storage p = _requireExists(packetId);

        if (block.timestamp <= p.expiresAt) revert PacketNotExpired();
        if (p.remainingAmount == 0) revert NothingToReclaim();

        uint256 amount = p.remainingAmount;
        p.remainingAmount = 0;
        p.reclaimed = true;

        usdc.safeTransfer(p.creator, amount);

        emit PacketReclaimed(packetId, amount);
    }

    function remainingClaims(uint256 packetId) external view returns (uint32) {
        Packet storage p = _requireExists(packetId);
        return p.maxClaims - p.claimsMade;
    }

    function isExpired(uint256 packetId) external view returns (bool) {
        Packet storage p = _requireExists(packetId);
        return block.timestamp > p.expiresAt;
    }

    /**
     * @dev Computes this claim's share and mixes in enough per-claim
     *      entropy (previous blockhash, prevrandao, claimer address, and
     *      the running claim count) that no two claims on the same packet
     *      draw the same "random" value even within the same block.
     *
     *      Equal mode: fixed `totalAmount / maxClaims`, except the very
     *      last claim also receives whatever's left in `remainingAmount`
     *      (absorbing integer-division remainder) so the packet always
     *      empties exactly to zero.
     *
     *      Random mode: standard red-packet algorithm — draw a uniform
     *      amount in [1, 2x the average of what's left], which keeps the
     *      expected value fair across claimers while reserving at least 1
     *      base unit for each claim still to come.
     */
    function _computeShare(Packet storage p, uint256 packetId) private view returns (uint256) {
        uint32 remaining = p.maxClaims - p.claimsMade;
        bool isLastClaim = remaining == 1;

        if (p.splitMode == SplitMode.Equal) {
            if (isLastClaim) return p.remainingAmount;
            return p.totalAmount / p.maxClaims;
        }

        if (isLastClaim) return p.remainingAmount;

        uint256 reserveForOthers = uint256(remaining) - 1;
        uint256 maxDraw = (p.remainingAmount / remaining) * 2;
        if (maxDraw == 0) maxDraw = 1;

        uint256 entropy = uint256(
            keccak256(
                abi.encodePacked(
                    blockhash(block.number - 1),
                    block.prevrandao,
                    msg.sender,
                    packetId,
                    p.claimsMade
                )
            )
        );
        uint256 draw = (entropy % maxDraw) + 1;

        uint256 maxAllowed = p.remainingAmount - reserveForOthers;
        if (draw > maxAllowed) draw = maxAllowed;
        return draw;
    }

    function _requireExists(uint256 packetId) internal view returns (Packet storage p) {
        p = packets[packetId];
        if (p.creator == address(0)) revert PacketNotFound();
    }
}
