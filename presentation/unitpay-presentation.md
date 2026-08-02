# UnitPay Presentation Deck

## Slide 1: UnitPay

**Headline**
UnitPay: cross-chain stablecoin payments for wallets, merchants, groups, cards, and public links.

**On-slide points**
- Testnet payment app built with Circle User-Controlled Wallets and Gateway
- Native wallet, payment links, escrow, UnitPackets, Pods, P2P, QR, and virtual cards
- Cross-chain Gateway UX without manual bridging

**Speaker notes**
UnitPay is a working demo of a modern stablecoin payment experience. It combines a consumer wallet, merchant tooling, public payment links, escrow contracts, Gateway unified balance, UnitPackets, collaborative Escrow Pods, a P2P marketplace, QR flows, and virtual card management into one application. The core idea is simple: users should be able to move, request, pool, trade, and settle USDC without thinking about chain complexity.

---

## Slide 2: The Problem

**Headline**
Crypto payments are still too fragmented for everyday use.

**On-slide points**
- Users hold funds across multiple chains and wallets
- Payment links often force onboarding before payment
- Group payments, escrow, cards, and P2P are usually separate tools
- Manual bridging adds friction, time, and failure points

**Speaker notes**
Today, paying with stablecoins often means asking which chain, which wallet, which bridge, which token contract, and which workflow tool. That is too much friction for a normal payment flow. UnitPay focuses on reducing these decisions by combining wallet-native payments with Gateway-backed cross-chain movement, public links, P2P, Pods, QR, and card-style spending controls.

---

## Slide 3: Product Overview

**Headline**
One app for sending, requesting, pooling, and securing USDC payments.

**On-slide points**
- Wallet dashboard for balances, sends, receives, and activity
- Payment links for single-receiver and split payments
- Gateway unified balance for cross-chain USDC
- Escrow, UnitPackets, Escrow Pods, P2P, QR, and virtual cards for richer workflows

**Speaker notes**
The application is organized around real payment jobs. A user can hold funds, send USDC, request payment, accept payments from links, lock funds in escrow, create claimable UnitPackets, create collaborative funding Pods, scan QR codes, trade through P2P, manage virtual cards, and view transaction history. These are not separate prototypes; they are integrated into the same wallet surface.

---

## Slide 4: Onboarding And Authentication

**Headline**
Fast wallet setup with session-aware public links.

**On-slide points**
- Circle User-Controlled Wallet creation through hosted PIN challenge
- Recovery-code login and trusted browser sessions
- Wallet backup verification before onboarding is complete
- Public links detect active sessions and avoid unnecessary login loops
- One active account per browser session
- Logo and `/` route resolve to onboarding as the application home

**Speaker notes**
The onboarding flow creates a Circle user-controlled wallet and stores the local session so returning users are not repeatedly forced through login. Wallet backup is required before onboarding is considered complete. Public links such as payment links, escrow links, UnitPacket links, and Pod links can be opened by anyone, but actions that require a wallet guide the visitor through login or onboarding only when needed.

---

## Slide 5: Wallet Dashboard

**Headline**
The wallet dashboard is the command center.

**On-slide points**
- Balance card, transaction history, and refresh controls
- Quick actions: send, receive, faucet, request, Gateway, P2P, QR, cards, escrow, UnitPacket, Pods
- Gateway, P2P, cards, QR, and Escrow Pods promoted from the dashboard
- Settings expose wallet ID, address, recovery code, and logout
- Mobile-friendly layout for primary actions

**Speaker notes**
The dashboard gives the user direct access to the core UnitPay flows. Pods, P2P, QR, cards, and Gateway are visible from the home wallet experience rather than hidden in navigation. The dashboard also emphasizes mobile usability so core actions remain reachable on smaller screens.

---

## Slide 6: Gateway Unified Balance

**Headline**
Spend USDC from a unified cross-chain balance.

**On-slide points**
- Reads Gateway balances across supported EVM testnets using configured RPCs first
- Deposit flow locks USDC into Gateway
- Dashboard shows total balance plus chain-level breakdowns
- Send flow supports two modes:
  - Unified balance auto-allocation
  - Specific chain source selection
- Gateway burn intent, attestation, and mint complete cross-chain delivery

**Speaker notes**
The Gateway screen shows one total USDC balance while preserving detail per chain. Read calls prefer custom RPC URLs per chain and fall back to public RPCs when needed. When sending, users can choose the simple unified balance mode, where UnitPay allocates across source chains automatically, or choose a specific source chain for exact control. This keeps the chain-abstracted UX while still supporting advanced users who care where funds are drawn from.

---

## Slide 7: Payment Links

**Headline**
Payment links work for UnitPay users and external wallet payers.

**On-slide points**
- Encoded payment requests with share-card previews
- Single receiver requests and multi-receiver split requests
- UnitPay wallet payer path uses the existing authenticated wallet flow
- External wallet payer path uses Gateway `depositFor`
- External payer can connect a browser wallet and pay from a supported EVM chain
- Optional collaborative funding Pod attached to a payment link

**Speaker notes**
Payment links are designed to reduce friction. If the payer has a UnitPay wallet, they can pay through their normal UnitPay flow. If they do not want to create an account, they can connect an external EVM wallet and deposit USDC directly into the payee's Gateway account using the Unified Balance Kit `depositFor` flow. Payment links can also attach to collaborative Pods so multiple contributors can fund one payment objective.

---

## Slide 8: Split Payments

**Headline**
One payment can settle to multiple receivers.

**On-slide points**
- Request creator can define multiple receivers and amounts
- Payment link encodes the split payload
- Payer approves total amount once
- `UnitPayTransfer.batchTransfer` distributes funds atomically

**Speaker notes**
Split payment links support use cases like bill splitting, marketplace payouts, team payments, or multi-party service settlement. Instead of multiple manual transfers, the payer approves the total once and the contract distributes to all receivers in a single transaction.

---

## Slide 9: Escrow

**Headline**
On-chain escrow for service work and trust-minimized payments.

**On-slide points**
- Payer locks USDC for a payee
- Release, refund, dispute, and timeout-resolution flows
- Optional arbiter for dispute resolution
- Terms encrypted client-side and shared through URL fragment
- On-chain terms commitment proves integrity without exposing private terms

**Speaker notes**
The escrow feature is built for work agreements, bounties, and milestone-style payments. Funds are locked on-chain. The task terms are encrypted in the browser, and only a hash commitment is stored on-chain. That means parties can verify they are looking at the correct terms without publishing private details.

---

## Slide 10: UnitPacket

**Headline**
UnitPacket turns USDC into claimable packets.

**On-slide points**
- Creator locks a total amount of USDC
- Claims can be equal split or randomized split
- Claim limits and expiry are enforced on-chain
- Unclaimed funds can be reclaimed after expiry
- Generated claim link is displayed and copyable immediately

**Speaker notes**
UnitPacket is a shareable, claim-based distribution feature. A creator locks USDC and shares a link. Recipients can claim until the packet is exhausted or expired. This supports giveaways, community rewards, promotions, or casual group distribution.

---

## Slide 11: Escrow Pods

**Headline**
Escrow Pods let groups pool funds toward a shared goal.

**On-slide points**
- Create public or private pods
- Public pods appear in discovery
- Private pods work through invite links and optional wallet whitelist
- Track target amount, status, contributors, and contribution history
- Contributions transfer USDC to the pod treasury address
- Shared Pod links open directly into the collaborative payment view

**Speaker notes**
Escrow Pods are for collaborative funding: donations, shared expenses, group purchases, community campaigns, and crowdfunding. A Pod has a creator, description, target amount, status, visibility, and contribution history. Public Pods are indexed for discovery and private Pods can be shared only by invite link and optionally restricted by wallet address.

---

## Slide 12: P2P Marketplace

**Headline**
P2P turns merchant liquidity into customer-friendly buy and sell flows.

**On-slide points**
- Merchant dashboard for buy/sell offers, liquidity, status, edits, and deletes
- Customer view translates merchant offers into Buy USDC and Sell USDC actions
- Arc Testnet on-chain flow uses real wallet funds and escrowed liquidity
- Fiat or asset amount input with live conversion preview
- Saved payout details, payment-method matching, encrypted chat, and attention indicators

**Speaker notes**
The P2P marketplace is modeled after major exchange flows but adapted to UnitPay's on-chain architecture. Merchants manage liquidity and offers, while customers see the flow in their own language: buy USDC or sell USDC. Offer pages support fiat and asset amount entry and show the converted value before the trade is started. Payment details are saved separately and attached only after a trade begins.

---

## Slide 13: P2P Merchant And Customer UX

**Headline**
The same offer is shown differently depending on who is acting.

**On-slide points**
- Merchant "sell offer" appears to customers as "Buy USDC"
- Merchant "buy offer" appears to customers as "Sell USDC"
- Offers auto-disable when escrowed liquidity is exhausted
- Merchant cards show name, status, rating context, and payment methods
- Filters support asset, fiat, method, limits, status, and sort options

**Speaker notes**
The P2P UI resolves a key product issue: merchant inventory language and customer action language are opposite. UnitPay separates those views. A merchant who wants to sell USDC creates a sell offer, but the customer sees it as a buy opportunity. A merchant who wants to buy USDC creates a buy offer, and the customer sees it as a sell opportunity.

---

## Slide 14: Virtual Cards

**Headline**
Virtual cards make Gateway balance spendable through controlled card surfaces.

**On-slide points**
- Clickable card list with detailed card pages
- Network, status, last four, balance, limits, currency, expiry, and transactions
- Freeze/unfreeze, fund, withdraw, replace/delete where supported
- Masked copy controls avoid copying unusable masked values
- Provider abstraction for Mastercard, Visa, and AI-agent spending policies

**Speaker notes**
The virtual card module now behaves like a card-management product, not just a static list. Each card opens into a detailed page with status, balance, limits, dates, and transaction history. The architecture is intentionally provider-based so additional card providers and AI-agent spending policies can be integrated later.

---

## Slide 15: QR And Share Cards

**Headline**
QR and rich previews make every public object easier to share.

**On-slide points**
- QR codes for receive, requests, links, Pods, UnitPackets, escrows, P2P, merchants, and profiles
- Universal scanner available across wallet and payment surfaces
- Uploaded QR image decoding in the same places scanning is supported
- Circle Wallet ID preferred over raw addresses where possible
- OpenGraph/Twitter cards for public UnitPay objects

**Speaker notes**
QR is now a platform-level feature. Users can scan from payment surfaces, upload QR images where scanning is available, and share public objects with richer previews. UnitPay prefers Circle Wallet IDs where possible and keeps raw addresses available for advanced details.

---

## Slide 16: Merchant Mode

**Headline**
Merchant tools are built on the same wallet rails.

**On-slide points**
- Merchant dashboard uses wallet transaction history
- Payment request links can be generated by any UnitPay wallet
- Supports direct settlement to wallet or Gateway balance paths
- No separate merchant custody system required
- P2P merchant profiles show active offers and payment methods

**Speaker notes**
The merchant view demonstrates how a merchant can use the same UnitPay wallet infrastructure to receive payments, review activity, generate request links, and participate in P2P. Merchant profiles expose reputation context, payment methods, and active offers while keeping custody tied to the user's wallet.

---

## Slide 17: Smart Contracts

**Headline**
Contracts provide the on-chain enforcement layer.

**On-slide points**
- `UnitPayTransfer`: direct and batch transfers
- `UnitPayPaymentRequest`: on-chain payment request lifecycle
- `UnitPayMerchant`: merchant registration and settlement routing
- `UnitPayEscrow`: lock, release, refund, dispute, timeout
- `UnitPayPacket`: claimable packet distribution
- P2P marketplace contracts for offers, escrow, lifecycle, and reputation records
- Metadata registry direction for public-object persistence

**Speaker notes**
The app includes a Hardhat contracts workspace with Solidity contracts deployed to Arc Testnet. The contracts cover transfer, payment request, merchant, escrow, packet, and P2P workflows. Frontend features use Circle Wallet challenges to approve and execute the relevant contract calls. Public object storage is designed around registry-backed persistence instead of local filesystem writes.

---

## Slide 18: Chain And Token Coverage

**Headline**
Built for Circle-supported testnet assets.

**On-slide points**
- Arc Testnet is the primary chain
- Supported EVM testnets include Ethereum Sepolia, Base Sepolia, Avalanche Fuji, Arbitrum Sepolia, OP Sepolia, Polygon Amoy, and others
- Solana Devnet is documented with wallet compatibility warnings
- Chain config is centralized in `lib/chains/config.ts`
- Contract addresses are read from chain config, not ad hoc environment overrides
- Unit conversion utilities prevent decimal mistakes
- USDC, EURC, CIRBTC, and custom token configuration are modeled

**Speaker notes**
The app is testnet-only and intentionally avoids mainnet configuration. Chain details, USDC addresses, Gateway domains, RPC URLs, contract addresses, and faucet links are centralized. Unit conversion is handled through tested utilities to avoid mistakes between native gas decimals and token decimals.

---

## Slide 19: Architecture

**Headline**
Next.js app, Circle APIs, Gateway, Arc Testnet contracts, and registry-backed metadata.

**On-slide points**
- Next.js App Router frontend and API routes
- Circle User-Controlled Wallets for wallet sessions and challenges
- Circle Gateway / Unified Balance Kit for cross-chain balance and deposit/spend flows
- Viem adapter for external browser wallet payments
- Contract reads via viem and writes through Circle challenge APIs
- Modular services for Pods, P2P, cards, QR, Gateway, and public share cards

**Speaker notes**
UnitPay is a Next.js application with server API routes for Circle Wallet operations and client pages for wallet UX. Circle provides the user-controlled wallet challenge flow. Gateway provides unified balance and cross-chain stablecoin capabilities. The external wallet payment path uses the Circle Viem adapter with the Unified Balance Kit. Feature modules are split across wallet, Gateway, Pods, P2P, cards, QR, and public share services.

---

## Slide 20: Security And Guardrails

**Headline**
The demo is intentionally testnet-only and conservative.

**On-slide points**
- No mainnet addresses or mainnet RPCs
- No fiat rails, card processing, banking, or KYC
- Circle API key required for wallet routes
- Public links are viewable without auth, but actions require wallet/session where needed
- Escrow terms are encrypted before sharing
- P2P chat uses encrypted message payloads
- Custom RPCs reduce public endpoint rate-limit exposure

**Speaker notes**
The project is clearly scoped as a testnet-only demo. It does not include live fiat rails, mainnet settings, production card issuing, banking, or KYC. Public links are safe to view without authentication, but sensitive actions require a valid wallet session or an external wallet signature. Escrow terms and P2P chat use client-side protection patterns to reduce unnecessary disclosure.

---

## Slide 21: Demo Flow

**Headline**
A complete demo can show the full payment lifecycle.

**On-slide points**
1. Create or restore a UnitPay wallet
2. Deposit USDC into Gateway
3. Generate a payment link
4. Pay with UnitPay wallet or external wallet
5. Create an escrow or UnitPacket
6. Create a Pod and contribute
7. Start a P2P trade and show saved payout details
8. Open a virtual card and QR scanner

**Speaker notes**
The strongest demo path starts with onboarding, then shows wallet balance and Gateway. From there, generate a payment request and demonstrate both payer options: UnitPay wallet and external wallet. Then show richer workflows: escrow for protected payments, UnitPacket for claimable distribution, Pods for collaborative funding, P2P for merchant liquidity, virtual cards for controlled spending, and QR for quick routing.

---

## Slide 22: Why It Matters

**Headline**
UnitPay makes stablecoin payments feel like product workflows, not chain operations.

**On-slide points**
- Reduces chain and bridge friction
- Supports both onboarded users and external wallet payers
- Combines personal, merchant, escrow, packet, group, card, QR, and P2P use cases
- Uses Circle infrastructure and on-chain contracts where each fits best

**Speaker notes**
The value of UnitPay is not just sending USDC. It is packaging stablecoin movement into workflows people recognize: invoices, links, escrow, group pools, giveaways, merchant payments, P2P trades, QR flows, and card-style spending. Gateway removes much of the chain complexity, while contracts enforce the workflows that need on-chain guarantees.

---

## Slide 23: Current Status

**Headline**
Working testnet app with verified build and tests.

**On-slide points**
- Next.js production build passes
- Lint passes
- Unit tests cover payment encoding, Gateway allocation, burn intents, escrow terms, units, chains, Pods, registry signing, and related utilities
- Contracts workspace includes Hardhat tests
- P2P, virtual cards, QR, share cards, and mobile UX updates are integrated into the demo surface
- Ready for demo and iteration

**Speaker notes**
The current implementation has a working build and test coverage across critical utilities. The frontend, API routes, Gateway helpers, model tests, and contracts are organized for continued development. The next step is production hardening, production card issuing integration, compliance review, durable indexing, and mainnet readiness only when the product requirements and compliance model are defined.

---

## Slide 24: Closing

**Headline**
UnitPay is a cross-chain USDC payment operating system.

**On-slide points**
- Wallet
- Links
- Gateway
- Escrow
- Packets
- Pods
- P2P
- QR
- Cards
- Merchant flows

**Speaker notes**
UnitPay brings together the core payment primitives needed for a practical stablecoin product. It gives users direct wallet control, lets payers use external wallets when they do not want to onboard, and expands beyond simple transfers into escrow, claimable packets, collaborative Pods, P2P trading, QR-based routing, virtual card controls, and merchant workflows.
