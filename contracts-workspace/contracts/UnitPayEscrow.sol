// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UnitPayEscrow
 * @notice Simple USDC escrow for freelance/bounty-style work: a payer locks
 *         funds for a payee, and either releases them on completion or
 *         gets refunded. An arbiter (chosen by the payer at creation time)
 *         can step in and resolve a dispute if payer and payee disagree.
 *
 * @dev Task terms themselves never touch chain storage in plaintext. The
 *      product's client (see lib/escrow/terms.ts in the Next.js app)
 *      AES-encrypts the terms and embeds the ciphertext + key in the
 *      shareable escrow link (same "no database" pattern as
 *      lib/paymentRequest.ts); only a keccak256 commitment hash of the
 *      plaintext terms is stored here, so both parties can verify they're
 *      looking at the same terms without anyone else being able to read
 *      them from chain data alone.
 *
 *      TESTNET ONLY — see UnitPayTransfer.sol for the same caveat.
 */
contract UnitPayEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status {
        Funded,
        Released,
        Refunded,
        Disputed
    }

    struct Escrow {
        address payer;
        address payee;
        address arbiter;
        uint256 amount;
        bytes32 termsHash;
        uint64 createdAt;
        uint64 expiresAt; // 0 = never expires
        uint64 disputedAt; // 0 until dispute() is called
        Status status;
    }

    IERC20 public immutable usdc;
    uint256 public nextEscrowId;
    mapping(uint256 => Escrow) public escrows;

    /// @notice Upper bound on `expiresIn`, mirroring UnitPayPaymentRequest's
    ///         overflow guard on the uint64 `expiresAt` timestamp.
    uint64 public constant MAX_EXPIRES_IN = 365 days;

    /// @notice Once a dispute has stood unresolved for this long, anyone may
    ///         call `resolveTimedOutDispute` to refund the payer, so an
    ///         unresponsive or unreachable arbiter can never permanently
    ///         lock funds. Defaults to a refund (the conservative outcome)
    ///         rather than releasing to the payee, since only the payer's
    ///         funds are at stake either way and "money returns to its
    ///         source" is the safer default absent an actual ruling.
    uint64 public constant DISPUTE_TIMEOUT = 30 days;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed payee,
        address arbiter,
        uint256 amount,
        bytes32 termsHash,
        uint64 expiresAt
    );
    event EscrowReleased(uint256 indexed escrowId, address indexed releasedBy);
    event EscrowRefunded(uint256 indexed escrowId, address indexed refundedBy);
    event EscrowDisputed(uint256 indexed escrowId, address indexed raisedBy);
    event EscrowDisputeResolved(uint256 indexed escrowId, bool releasedToPayee);

    error EscrowNotFound();
    error NotPayer();
    error NotArbiter();
    error NotPayeeOrExpiredPayer();
    error NotPartyToEscrow();
    error NotFunded();
    error NotDisputed();
    error ZeroAddress();
    error ZeroAmount();
    error SamePayerAndPayee();
    error ArbiterMustBeIndependent();
    error SelfAddressPayee();
    error ExpiryTooFar();
    error DisputeNotTimedOut();

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    /**
     * @notice Locks `amount` of USDC from the caller (the payer) for
     *         `payee`, with `arbiter` empowered to resolve a dispute.
     * @param payee      Address that receives funds on release.
     * @param arbiter    Address that can resolve a dispute. Set to
     *                   address(0) to opt out of dispute resolution
     *                   entirely (payer/payee must then agree directly).
     * @param amount     USDC amount to lock, in base units.
     * @param termsHash  keccak256 commitment hash of the (client-side
     *                   encrypted) task terms. Not verified on-chain — it
     *                   exists purely so both parties can confirm, off-
     *                   chain, that they hold the same terms.
     * @param expiresIn  Seconds from now after which the payer may reclaim
     *                   funds even without the payee's or arbiter's
     *                   cooperation (0 = never expires). Capped at
     *                   `MAX_EXPIRES_IN`.
     * @dev Caller must have approved this contract for at least `amount`.
     */
    function createEscrow(
        address payee,
        address arbiter,
        uint256 amount,
        bytes32 termsHash,
        uint64 expiresIn
    ) external nonReentrant returns (uint256 escrowId) {
        if (payee == address(0)) revert ZeroAddress();
        if (payee == address(this)) revert SelfAddressPayee();
        if (payee == msg.sender) revert SamePayerAndPayee();
        // An arbiter who is also a party to the escrow could unilaterally
        // rule in their own favor after calling dispute() themselves — the
        // arbiter must be a genuinely independent third party (or unset).
        if (arbiter == msg.sender || arbiter == payee) revert ArbiterMustBeIndependent();
        if (amount == 0) revert ZeroAmount();
        if (expiresIn > MAX_EXPIRES_IN) revert ExpiryTooFar();

        escrowId = nextEscrowId++;
        uint64 expiresAt = expiresIn == 0 ? 0 : uint64(block.timestamp) + expiresIn;

        escrows[escrowId] = Escrow({
            payer: msg.sender,
            payee: payee,
            arbiter: arbiter,
            amount: amount,
            termsHash: termsHash,
            createdAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            disputedAt: 0,
            status: Status.Funded
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        emit EscrowCreated(escrowId, msg.sender, payee, arbiter, amount, termsHash, expiresAt);
    }

    /**
     * @notice Releases locked funds to the payee. Callable by the payer
     *         (task accepted as complete) or, once disputed, the arbiter.
     */
    function release(uint256 escrowId) external nonReentrant {
        Escrow storage e = _requireExists(escrowId);

        if (e.status == Status.Funded) {
            if (msg.sender != e.payer) revert NotPayer();
        } else if (e.status == Status.Disputed) {
            if (msg.sender != e.arbiter) revert NotArbiter();
        } else {
            revert NotFunded();
        }

        e.status = Status.Released;
        usdc.safeTransfer(e.payee, e.amount);

        emit EscrowReleased(escrowId, msg.sender);
        if (msg.sender == e.arbiter) {
            emit EscrowDisputeResolved(escrowId, true);
        }
    }

    /**
     * @notice Refunds locked funds back to the payer. Callable by the
     *         payee (task withdrawn/declined) at any time, by the payer
     *         once the escrow has expired, or by the arbiter once
     *         disputed.
     */
    function refund(uint256 escrowId) external nonReentrant {
        Escrow storage e = _requireExists(escrowId);

        if (e.status == Status.Funded) {
            bool payerAfterExpiry = msg.sender == e.payer && e.expiresAt != 0 &&
                block.timestamp > e.expiresAt;
            if (msg.sender != e.payee && !payerAfterExpiry) revert NotPayeeOrExpiredPayer();
        } else if (e.status == Status.Disputed) {
            if (msg.sender != e.arbiter) revert NotArbiter();
        } else {
            revert NotFunded();
        }

        e.status = Status.Refunded;
        usdc.safeTransfer(e.payer, e.amount);

        emit EscrowRefunded(escrowId, msg.sender);
        if (msg.sender == e.arbiter) {
            emit EscrowDisputeResolved(escrowId, false);
        }
    }

    /**
     * @notice Flags an escrow as disputed, freezing it until the arbiter
     *         calls `release` or `refund`. Callable by either the payer or
     *         the payee; requires an arbiter to have been set.
     */
    function dispute(uint256 escrowId) external {
        Escrow storage e = _requireExists(escrowId);
        if (e.status != Status.Funded) revert NotFunded();
        if (msg.sender != e.payer && msg.sender != e.payee) revert NotPartyToEscrow();
        if (e.arbiter == address(0)) revert ZeroAddress();

        e.status = Status.Disputed;
        e.disputedAt = uint64(block.timestamp);
        emit EscrowDisputed(escrowId, msg.sender);
    }

    /**
     * @notice Refunds the payer if a dispute has stood unresolved for at
     *         least `DISPUTE_TIMEOUT`. Callable by anyone, but funds always
     *         go to the original payer — this exists purely so an
     *         unresponsive, unreachable, or malicious-by-inaction arbiter
     *         can never permanently lock funds in a disputed escrow.
     */
    function resolveTimedOutDispute(uint256 escrowId) external nonReentrant {
        Escrow storage e = _requireExists(escrowId);
        if (e.status != Status.Disputed) revert NotDisputed();
        if (block.timestamp < e.disputedAt + DISPUTE_TIMEOUT) revert DisputeNotTimedOut();

        e.status = Status.Refunded;
        usdc.safeTransfer(e.payer, e.amount);

        emit EscrowRefunded(escrowId, msg.sender);
        emit EscrowDisputeResolved(escrowId, false);
    }

    function isExpired(uint256 escrowId) external view returns (bool) {
        Escrow storage e = _requireExists(escrowId);
        return e.expiresAt != 0 && block.timestamp > e.expiresAt;
    }

    function _requireExists(uint256 escrowId) internal view returns (Escrow storage e) {
        e = escrows[escrowId];
        if (e.payer == address(0)) revert EscrowNotFound();
    }
}
