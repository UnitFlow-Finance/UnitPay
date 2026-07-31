// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title UnitPayP2PMarketplace
 * @notice On-chain escrow and lifecycle registry for UnitPay P2P trades.
 *         Fiat payment instructions, evidence, and UI-rich merchant metadata
 *         stay off-chain in UnitPay's metadata registry, while asset custody
 *         and final settlement remain enforceable on-chain.
 */
contract UnitPayP2PMarketplace is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OfferSide {
        Buy,
        Sell
    }

    enum OfferStatus {
        Active,
        Paused,
        Cancelled
    }

    enum TradeStatus {
        Locked,
        Paid,
        Released,
        Cancelled,
        Disputed,
        Refunded
    }

    struct Offer {
        address merchant;
        IERC20 asset;
        OfferSide side;
        uint256 price;
        uint256 minAmount;
        uint256 maxAmount;
        uint256 availableAmount;
        uint64 paymentWindow;
        bytes32 metadataHash;
        OfferStatus status;
    }

    struct Trade {
        uint256 offerId;
        address buyer;
        address seller;
        IERC20 asset;
        uint256 amount;
        uint256 fiatAmount;
        uint64 createdAt;
        uint64 paymentDeadline;
        bytes32 evidenceHash;
        TradeStatus status;
    }

    uint256 public nextOfferId;
    uint256 public nextTradeId;
    address public arbitrator;

    mapping(uint256 => Offer) public offers;
    mapping(uint256 => Trade) public trades;
    mapping(address => uint256) public completedTrades;
    mapping(address => uint256) public disputedTrades;

    event OfferCreated(uint256 indexed offerId, address indexed merchant, address indexed asset, OfferSide side);
    event OfferUpdated(uint256 indexed offerId, OfferStatus status, uint256 availableAmount);
    event TradeStarted(uint256 indexed tradeId, uint256 indexed offerId, address indexed buyer, address seller, uint256 amount);
    event TradePaid(uint256 indexed tradeId, bytes32 evidenceHash);
    event TradeReleased(uint256 indexed tradeId);
    event TradeCancelled(uint256 indexed tradeId);
    event TradeDisputed(uint256 indexed tradeId, bytes32 evidenceHash);
    event TradeResolved(uint256 indexed tradeId, bool releasedToBuyer);
    event ArbitratorUpdated(address indexed arbitrator);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidRange();
    error OfferNotActive();
    error TradeNotLocked();
    error TradeNotPaidOrDisputed();
    error Unauthorized();
    error DeadlinePassed();
    error DeadlineNotPassed();

    constructor(address initialArbitrator) {
        if (initialArbitrator == address(0)) revert ZeroAddress();
        arbitrator = initialArbitrator;
        emit ArbitratorUpdated(initialArbitrator);
    }

    function setArbitrator(address newArbitrator) external onlyOwner {
        if (newArbitrator == address(0)) revert ZeroAddress();
        arbitrator = newArbitrator;
        emit ArbitratorUpdated(newArbitrator);
    }

    function createOffer(
        IERC20 asset,
        OfferSide side,
        uint256 price,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 availableAmount,
        uint64 paymentWindow,
        bytes32 metadataHash
    ) external returns (uint256 offerId) {
        if (address(asset) == address(0)) revert ZeroAddress();
        if (price == 0 || minAmount == 0 || maxAmount == 0 || availableAmount == 0) revert ZeroAmount();
        if (minAmount > maxAmount || availableAmount < minAmount) revert InvalidRange();

        offerId = nextOfferId++;
        offers[offerId] = Offer({
            merchant: msg.sender,
            asset: asset,
            side: side,
            price: price,
            minAmount: minAmount,
            maxAmount: maxAmount,
            availableAmount: availableAmount,
            paymentWindow: paymentWindow == 0 ? uint64(15 minutes) : paymentWindow,
            metadataHash: metadataHash,
            status: OfferStatus.Active
        });

        if (side == OfferSide.Sell) {
            asset.safeTransferFrom(msg.sender, address(this), availableAmount);
        }

        emit OfferCreated(offerId, msg.sender, address(asset), side);
    }

    function updateOffer(
        uint256 offerId,
        uint256 price,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 availableAmount,
        OfferStatus status,
        bytes32 metadataHash
    ) external {
        Offer storage offer = offers[offerId];
        if (offer.merchant != msg.sender) revert Unauthorized();
        if (price == 0 || minAmount == 0 || maxAmount == 0) revert ZeroAmount();
        if (minAmount > maxAmount) revert InvalidRange();

        offer.price = price;
        offer.minAmount = minAmount;
        offer.maxAmount = maxAmount;
        if (offer.side == OfferSide.Sell && availableAmount > offer.availableAmount) {
            offer.asset.safeTransferFrom(msg.sender, address(this), availableAmount - offer.availableAmount);
        } else if (offer.side == OfferSide.Sell && availableAmount < offer.availableAmount) {
            offer.asset.safeTransfer(msg.sender, offer.availableAmount - availableAmount);
        }
        offer.availableAmount = availableAmount;
        offer.status = status;
        offer.metadataHash = metadataHash;

        emit OfferUpdated(offerId, status, availableAmount);
    }

    function startTrade(uint256 offerId, uint256 amount) external nonReentrant returns (uint256 tradeId) {
        Offer storage offer = offers[offerId];
        if (offer.status != OfferStatus.Active) revert OfferNotActive();
        if (amount < offer.minAmount || amount > offer.maxAmount || amount > offer.availableAmount) revert InvalidRange();

        offer.availableAmount -= amount;
        uint256 fiatAmount = amount * offer.price;
        address buyer = offer.side == OfferSide.Sell ? msg.sender : offer.merchant;
        address seller = offer.side == OfferSide.Sell ? offer.merchant : msg.sender;

        if (offer.side == OfferSide.Buy) {
            offer.asset.safeTransferFrom(seller, address(this), amount);
        }

        tradeId = nextTradeId++;
        trades[tradeId] = Trade({
            offerId: offerId,
            buyer: buyer,
            seller: seller,
            asset: offer.asset,
            amount: amount,
            fiatAmount: fiatAmount,
            createdAt: uint64(block.timestamp),
            paymentDeadline: uint64(block.timestamp) + offer.paymentWindow,
            evidenceHash: bytes32(0),
            status: TradeStatus.Locked
        });

        emit TradeStarted(tradeId, offerId, buyer, seller, amount);
    }

    function markPaid(uint256 tradeId, bytes32 evidenceHash) external {
        Trade storage trade = trades[tradeId];
        if (msg.sender != trade.buyer) revert Unauthorized();
        if (trade.status != TradeStatus.Locked) revert TradeNotLocked();
        if (block.timestamp > trade.paymentDeadline) revert DeadlinePassed();
        trade.status = TradeStatus.Paid;
        trade.evidenceHash = evidenceHash;
        emit TradePaid(tradeId, evidenceHash);
    }

    function release(uint256 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (msg.sender != trade.seller) revert Unauthorized();
        if (trade.status != TradeStatus.Paid && trade.status != TradeStatus.Disputed) revert TradeNotPaidOrDisputed();
        trade.status = TradeStatus.Released;
        completedTrades[trade.seller] += 1;
        trade.asset.safeTransfer(trade.buyer, trade.amount);
        emit TradeReleased(tradeId);
    }

    function cancelExpired(uint256 tradeId) external nonReentrant {
        Trade storage trade = trades[tradeId];
        if (trade.status != TradeStatus.Locked) revert TradeNotLocked();
        if (block.timestamp <= trade.paymentDeadline) revert DeadlineNotPassed();
        trade.status = TradeStatus.Cancelled;
        trade.asset.safeTransfer(trade.seller, trade.amount);
        emit TradeCancelled(tradeId);
    }

    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = offers[offerId];
        if (offer.merchant != msg.sender) revert Unauthorized();
        if (offer.status == OfferStatus.Cancelled) revert OfferNotActive();
        uint256 refundAmount = offer.side == OfferSide.Sell ? offer.availableAmount : 0;
        offer.availableAmount = 0;
        offer.status = OfferStatus.Cancelled;
        if (refundAmount > 0) {
            offer.asset.safeTransfer(msg.sender, refundAmount);
        }
        emit OfferUpdated(offerId, OfferStatus.Cancelled, 0);
    }

    function openDispute(uint256 tradeId, bytes32 evidenceHash) external {
        Trade storage trade = trades[tradeId];
        if (msg.sender != trade.buyer && msg.sender != trade.seller) revert Unauthorized();
        if (trade.status != TradeStatus.Paid && trade.status != TradeStatus.Locked) revert TradeNotPaidOrDisputed();
        trade.status = TradeStatus.Disputed;
        trade.evidenceHash = evidenceHash;
        disputedTrades[trade.buyer] += 1;
        disputedTrades[trade.seller] += 1;
        emit TradeDisputed(tradeId, evidenceHash);
    }

    function resolveDispute(uint256 tradeId, bool releaseToBuyer) external nonReentrant {
        if (msg.sender != arbitrator) revert Unauthorized();
        Trade storage trade = trades[tradeId];
        if (trade.status != TradeStatus.Disputed) revert TradeNotPaidOrDisputed();
        if (releaseToBuyer) {
            trade.status = TradeStatus.Released;
            completedTrades[trade.seller] += 1;
            trade.asset.safeTransfer(trade.buyer, trade.amount);
        } else {
            trade.status = TradeStatus.Refunded;
            trade.asset.safeTransfer(trade.seller, trade.amount);
        }
        emit TradeResolved(tradeId, releaseToBuyer);
    }
}
