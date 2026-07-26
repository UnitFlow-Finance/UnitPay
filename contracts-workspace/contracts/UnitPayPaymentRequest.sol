// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UnitPayPaymentRequest
 * @notice On-chain payment-request registry (v1.5). Lets a requester create
 *         a request for a fixed USDC amount, which any payer can fulfill by
 *         calling `fulfill`. Requests can expire and be cancelled by their
 *         creator before fulfillment.
 *
 * @dev The current Next.js app's `/wallet/request` flow uses a stateless,
 *      client-side-encoded link instead of this contract (no backend
 *      database in this demo — see lib/paymentRequest.ts). This contract
 *      exists as the on-chain-verifiable alternative described in the
 *      product spec (Phase 3) and is ready to wire in as a second request
 *      mode ("verifiable request") once deployed; the two are not mutually
 *      exclusive.
 *
 *      TESTNET ONLY — see UnitPayTransfer.sol for the same caveat.
 */
contract UnitPayPaymentRequest is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum RequestStatus {
        Open,
        Fulfilled,
        Cancelled
    }

    struct PaymentRequest {
        address requester;
        uint256 amount;
        uint64 expiresAt; // 0 = never expires
        RequestStatus status;
        string memo;
    }

    IERC20 public immutable usdc;
    uint256 public nextRequestId;
    mapping(uint256 => PaymentRequest) public requests;

    /// @notice Upper bound on memo length, to keep per-request storage costs
    ///         bounded and predictable.
    uint256 public constant MAX_MEMO_LENGTH = 280;

    /// @notice Upper bound on `expiresIn`, so a caller cannot pass a value
    ///         large enough to overflow the uint64 `expiresAt` timestamp.
    uint64 public constant MAX_EXPIRES_IN = 365 days;

    event PaymentRequestCreated(
        uint256 indexed requestId,
        address indexed requester,
        uint256 amount,
        uint64 expiresAt,
        string memo
    );
    event PaymentRequestFulfilled(
        uint256 indexed requestId,
        address indexed payer,
        address indexed requester,
        uint256 amount
    );
    event PaymentRequestCancelled(uint256 indexed requestId, address indexed requester);

    error RequestNotFound();
    error RequestNotOpen();
    error RequestExpired();
    error NotRequester();
    error ZeroAmount();
    error ZeroAddress();
    error MemoTooLong();
    error ExpiryTooFar();

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    /**
     * @param amount    USDC amount requested, in base units.
     * @param expiresIn Seconds from now until the request expires; 0 means
     *                  the request never expires. Capped at
     *                  `MAX_EXPIRES_IN` (365 days).
     * @param memo      Optional human-readable description, capped at
     *                  `MAX_MEMO_LENGTH` bytes.
     */
    function createRequest(
        uint256 amount,
        uint64 expiresIn,
        string calldata memo
    ) external returns (uint256 requestId) {
        if (amount == 0) revert ZeroAmount();
        if (expiresIn > MAX_EXPIRES_IN) revert ExpiryTooFar();
        if (bytes(memo).length > MAX_MEMO_LENGTH) revert MemoTooLong();

        requestId = nextRequestId++;
        uint64 expiresAt = expiresIn == 0 ? 0 : uint64(block.timestamp) + expiresIn;

        requests[requestId] = PaymentRequest({
            requester: msg.sender,
            amount: amount,
            expiresAt: expiresAt,
            status: RequestStatus.Open,
            memo: memo
        });

        emit PaymentRequestCreated(requestId, msg.sender, amount, expiresAt, memo);
    }

    /**
     * @notice Fulfills an open, non-expired request by transferring the
     *         requested USDC amount from the caller to the requester.
     * @dev Caller must have approved this contract for at least the
     *      request's amount.
     */
    function fulfill(uint256 requestId) external nonReentrant {
        PaymentRequest storage req = requests[requestId];
        if (req.requester == address(0)) revert RequestNotFound();
        if (req.status != RequestStatus.Open) revert RequestNotOpen();
        if (req.expiresAt != 0 && block.timestamp > req.expiresAt) revert RequestExpired();

        req.status = RequestStatus.Fulfilled;

        usdc.safeTransferFrom(msg.sender, req.requester, req.amount);

        emit PaymentRequestFulfilled(requestId, msg.sender, req.requester, req.amount);
    }

    /// @notice Cancels an open request. Only callable by the original requester.
    function cancel(uint256 requestId) external {
        PaymentRequest storage req = requests[requestId];
        if (req.requester == address(0)) revert RequestNotFound();
        if (msg.sender != req.requester) revert NotRequester();
        if (req.status != RequestStatus.Open) revert RequestNotOpen();

        req.status = RequestStatus.Cancelled;

        emit PaymentRequestCancelled(requestId, msg.sender);
    }

    function isExpired(uint256 requestId) external view returns (bool) {
        PaymentRequest storage req = requests[requestId];
        if (req.requester == address(0)) revert RequestNotFound();
        return req.expiresAt != 0 && block.timestamp > req.expiresAt;
    }
}
