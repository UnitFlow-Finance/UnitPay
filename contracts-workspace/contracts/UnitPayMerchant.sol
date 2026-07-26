// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title UnitPayMerchant
 * @notice Minimal on-chain merchant registry + settlement routing (v1.5).
 *         A merchant registers a settlement address once; payers then call
 *         `pay` with the merchant's id, and funds route directly to the
 *         registered settlement address while emitting an indexable event
 *         the merchant dashboard can read to build a per-chain ledger.
 *
 * @dev This is deliberately minimal — no fee splitting, no multi-currency
 *      support, no KYC/compliance hooks (explicitly out of scope for this
 *      testnet build, see Section 1 "Explicitly cut from the original
 *      spec"). The Next.js app's /merchant dashboard currently reads
 *      directly from Circle Wallets transaction history rather than this
 *      contract's events (no indexer service is deployed in this demo) —
 *      wiring an indexer to `Payment` events here is the natural next step
 *      once this contract is deployed and in active use.
 *
 *      TESTNET ONLY — see UnitPayTransfer.sol for the same caveat.
 */
contract UnitPayMerchant is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Merchant {
        address owner;
        address settlementAddress;
        bool active;
    }

    IERC20 public immutable usdc;
    uint256 public nextMerchantId;
    mapping(uint256 => Merchant) public merchants;

    /// @notice Upper bound on memo length, to keep per-payment calldata/log
    ///         costs bounded and predictable.
    uint256 public constant MAX_MEMO_LENGTH = 280;

    event MerchantRegistered(
        uint256 indexed merchantId,
        address indexed owner,
        address settlementAddress
    );
    event MerchantSettlementUpdated(uint256 indexed merchantId, address newSettlementAddress);
    event MerchantDeactivated(uint256 indexed merchantId);
    event Payment(
        uint256 indexed merchantId,
        address indexed payer,
        address settlementAddress,
        uint256 amount,
        string memo
    );

    error MerchantNotFound();
    error NotMerchantOwner();
    error MerchantInactive();
    error ZeroAddress();
    error SelfAddressSettlement();
    error ZeroAmount();
    error MemoTooLong();

    constructor(address usdcAddress) {
        if (usdcAddress == address(0)) revert ZeroAddress();
        usdc = IERC20(usdcAddress);
    }

    function registerMerchant(address settlementAddress) external returns (uint256 merchantId) {
        if (settlementAddress == address(0)) revert ZeroAddress();
        // No sweep/rescue function exists, so USDC settled to this
        // contract's own address would be permanently unrecoverable.
        if (settlementAddress == address(this)) revert SelfAddressSettlement();

        merchantId = nextMerchantId++;
        merchants[merchantId] = Merchant({
            owner: msg.sender,
            settlementAddress: settlementAddress,
            active: true
        });

        emit MerchantRegistered(merchantId, msg.sender, settlementAddress);
    }

    function updateSettlementAddress(uint256 merchantId, address newSettlementAddress) external {
        Merchant storage m = merchants[merchantId];
        if (m.owner == address(0)) revert MerchantNotFound();
        if (msg.sender != m.owner) revert NotMerchantOwner();
        if (newSettlementAddress == address(0)) revert ZeroAddress();
        if (newSettlementAddress == address(this)) revert SelfAddressSettlement();

        m.settlementAddress = newSettlementAddress;
        emit MerchantSettlementUpdated(merchantId, newSettlementAddress);
    }

    function deactivate(uint256 merchantId) external {
        Merchant storage m = merchants[merchantId];
        if (m.owner == address(0)) revert MerchantNotFound();
        if (msg.sender != m.owner) revert NotMerchantOwner();

        m.active = false;
        emit MerchantDeactivated(merchantId);
    }

    /**
     * @notice Pays a registered, active merchant. Caller must have approved
     *         this contract for at least `amount` beforehand.
     */
    function pay(uint256 merchantId, uint256 amount, string calldata memo) external nonReentrant {
        Merchant storage m = merchants[merchantId];
        if (m.owner == address(0)) revert MerchantNotFound();
        if (!m.active) revert MerchantInactive();
        if (amount == 0) revert ZeroAmount();
        if (bytes(memo).length > MAX_MEMO_LENGTH) revert MemoTooLong();

        usdc.safeTransferFrom(msg.sender, m.settlementAddress, amount);

        emit Payment(merchantId, msg.sender, m.settlementAddress, amount, memo);
    }
}
