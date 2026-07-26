// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UnitPayTransfer
 * @notice On-chain P2P USDC transfer logic for UnitPay, deployed on Arc
 *         Testnet. Provides batched transfers and indexable events so an
 *         off-chain indexer can build transaction history without relying
 *         solely on standard ERC-20 Transfer events (which don't carry
 *         UnitPay-specific metadata like memos).
 *
 * @dev Custody of end-user funds is NOT handled by this contract — end
 *      users hold USDC directly in their Circle User-Controlled Wallets and
 *      call `transfer`/`batchTransfer` themselves (or Circle's Wallets API
 *      submits the transaction on the user's signed behalf). This contract
 *      is a thin, stateless routing/eventing layer, matching the product
 *      decision to delegate custody entirely to Circle rather than
 *      re-implement it (see Section 2.3 of the build spec).
 *
 *      TESTNET ONLY. Every USDC address this contract is deployed against
 *      must be a testnet USDC contract (see lib/chains/config.ts in the
 *      Next.js app for the verified list). Do not deploy against a mainnet
 *      USDC address.
 */
contract UnitPayTransfer is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The USDC token this instance is wired to transfer.
    IERC20 public immutable usdc;

    /// @notice Upper bound on recipients per `batchTransfer` call, so a
    ///         caller cannot construct a batch that always exceeds the
    ///         block gas limit (self-inflicted DoS guard, not a fund-safety
    ///         issue — a caller can only ever grief their own transaction).
    uint256 public constant MAX_BATCH_SIZE = 200;

    /// @notice Upper bound on memo length, to keep per-transfer storage/
    ///         calldata costs bounded and predictable.
    uint256 public constant MAX_MEMO_LENGTH = 280;

    event UnitPayTransferSent(
        address indexed from,
        address indexed to,
        uint256 amount,
        string memo,
        uint256 timestamp
    );

    event UnitPayBatchTransferSent(
        address indexed from,
        uint256 recipientCount,
        uint256 totalAmount,
        uint256 timestamp
    );

    error EmptyBatch();
    error ArrayLengthMismatch();
    error BatchTooLarge();
    error ZeroAddress();
    error ZeroAddressRecipient();
    error SelfAddressRecipient();
    error ZeroAmount();
    error MemoTooLong();

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    /**
     * @notice Transfers `amount` of USDC from the caller to `to`, emitting
     *         an indexable event with an optional human-readable memo.
     * @dev Caller must have approved this contract for at least `amount`.
     */
    function transfer(address to, uint256 amount, string calldata memo) external nonReentrant {
        if (to == address(0)) revert ZeroAddressRecipient();
        // No sweep/rescue function exists, so USDC sent to this contract's
        // own address would be permanently unrecoverable — reject it
        // up front rather than let a copy-paste or integration bug lock
        // funds forever.
        if (to == address(this)) revert SelfAddressRecipient();
        if (amount == 0) revert ZeroAmount();
        if (bytes(memo).length > MAX_MEMO_LENGTH) revert MemoTooLong();

        usdc.safeTransferFrom(msg.sender, to, amount);

        emit UnitPayTransferSent(msg.sender, to, amount, memo, block.timestamp);
    }

    /**
     * @notice Sends USDC to multiple recipients in a single transaction.
     * @param recipients Destination addresses.
     * @param amounts    Amount (in USDC base units) for each recipient, same
     *                    length and order as `recipients`.
     */
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external nonReentrant {
        uint256 len = recipients.length;
        if (len == 0) revert EmptyBatch();
        if (len != amounts.length) revert ArrayLengthMismatch();
        if (len > MAX_BATCH_SIZE) revert BatchTooLarge();

        uint256 total = 0;
        for (uint256 i = 0; i < len; ++i) {
            address to = recipients[i];
            uint256 amount = amounts[i];
            if (to == address(0)) revert ZeroAddressRecipient();
            if (to == address(this)) revert SelfAddressRecipient();
            if (amount == 0) revert ZeroAmount();

            usdc.safeTransferFrom(msg.sender, to, amount);
            total += amount;

            emit UnitPayTransferSent(msg.sender, to, amount, "", block.timestamp);
        }

        emit UnitPayBatchTransferSent(msg.sender, len, total, block.timestamp);
    }
}
