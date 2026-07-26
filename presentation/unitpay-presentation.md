# UnitPay Presentation Deck

## Slide 1: UnitPay

**Headline**
UnitPay: programmable USDC payments for wallets, merchants, groups, and public links.

**On-slide points**
- Testnet payment app built with Circle User-Controlled Wallets and Gateway
- Native wallet, payment links, escrow, packets, pods, and merchant flows
- Cross-chain USDC UX without manual bridging

**Speaker notes**
UnitPay is a working demo of a modern USDC payment experience. It combines a consumer wallet, merchant tooling, public payment links, escrow contracts, Gateway unified balance, UnitPackets, and collaborative Escrow Pods into one application. The core idea is simple: users should be able to move, request, pool, and settle USDC without thinking about chain complexity.

---

## Slide 2: The Problem

**Headline**
Crypto payments are still too fragmented for everyday use.

**On-slide points**
- Users hold funds across multiple chains and wallets
- Payment links often force onboarding before payment
- Group payments, escrow, and merchant settlement are usually separate tools
- Manual bridging adds friction, time, and failure points

**Speaker notes**
Today, paying with stablecoins often means asking which chain, which wallet, which bridge, and which token contract. That is too much friction for a normal payment flow. UnitPay focuses on reducing these decisions by combining wallet-native payments with Gateway-backed cross-chain movement and public links that can support both UnitPay users and external wallet payers.

---

## Slide 3: Product Overview

**Headline**
One app for sending, requesting, pooling, and securing USDC payments.

**On-slide points**
- Wallet dashboard for balances, sends, receives, and activity
- Payment links for single-receiver and split payments
- Gateway unified balance for cross-chain USDC
- Escrow, UnitPackets, and Escrow Pods for richer payment workflows

**Speaker notes**
The application is organized around real payment jobs. A user can hold funds, send USDC, request payment, accept payments from links, lock funds in escrow, create claimable UnitPackets, create collaborative funding pods, and view merchant-oriented transaction history. These are not separate prototypes; they are integrated into the same wallet surface.

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

**Speaker notes**
The onboarding flow creates a Circle user-controlled wallet and stores the local session so returning users are not repeatedly forced through login. Wallet backup is required before onboarding is considered complete. Public links such as payment links, escrow links, and UnitPacket links can be opened by anyone, but actions that require a wallet guide the visitor through login or onboarding only when needed.

---

## Slide 5: Wallet Dashboard

**Headline**
The wallet dashboard is the command center.

**On-slide points**
- Balance card, transaction history, and refresh controls
- Quick actions: send, receive, faucet, request, merchant, escrow, UnitPacket, Pods
- Gateway and Escrow Pods promoted as dashboard panels
- Settings expose wallet ID, address, recovery code, and logout

**Speaker notes**
The dashboard gives the user direct access to the core UnitPay flows. Pods were added as a first-class dashboard action and supporting panel, so collaborative funding is visible from the home wallet experience rather than hidden in navigation.

---

## Slide 6: Gateway Unified Balance

**Headline**
Spend USDC from a unified cross-chain balance.

**On-slide points**
- Reads Gateway balances across supported EVM testnets
- Deposit flow locks USDC into Gateway
- Send flow supports two modes:
  - Unified balance auto-allocation
  - Specific chain source selection
- Gateway burn intent, attestation, and mint complete cross-chain delivery

**Speaker notes**
The Gateway screen shows one total USDC balance while preserving detail per chain. When sending, users can choose the simple unified balance mode, where UnitPay allocates across source chains automatically, or choose a specific source chain for exact control. This keeps the chain-abstracted UX while still supporting advanced users who care where funds are drawn from.

---

## Slide 7: Payment Links

**Headline**
Payment links work for UnitPay users and external wallet payers.

**On-slide points**
- Stateless encoded payment requests, no database required
- Single receiver requests and multi-receiver split requests
- UnitPay wallet payer path uses the existing authenticated wallet flow
- External wallet payer path uses Gateway `depositFor`
- External payer can connect a browser wallet and pay from a supported EVM chain

**Speaker notes**
Payment links are designed to reduce friction. If the payer has a UnitPay wallet, they can pay through their normal UnitPay flow. If they do not want to create an account, they can connect an external EVM wallet and deposit USDC directly into the payee's Gateway account using the Unified Balance Kit `depositFor` flow. The payee receives value into their Gateway balance without requiring manual bridging from the payer.

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

**Speaker notes**
Escrow Pods are for collaborative funding: donations, shared expenses, group purchases, community campaigns, and crowdfunding. A pod has a creator, description, target amount, status, visibility, and contribution history. Public pods can be discovered. Private pods can be shared only by invite link and optionally restricted by wallet address.

---

## Slide 12: Merchant Mode

**Headline**
Merchant tools are built on the same wallet rails.

**On-slide points**
- Merchant dashboard uses wallet transaction history
- Payment request links can be generated by any UnitPay wallet
- Supports direct settlement to wallet or Gateway balance paths
- No separate merchant custody system required

**Speaker notes**
The merchant view is intentionally lightweight. It demonstrates how a merchant can use the same UnitPay wallet infrastructure to receive payments, review activity, and generate request links. The same payment link foundation can be extended into richer merchant checkout and settlement experiences.

---

## Slide 13: Smart Contracts

**Headline**
Contracts provide the on-chain enforcement layer.

**On-slide points**
- `UnitPayTransfer`: direct and batch transfers
- `UnitPayPaymentRequest`: on-chain payment request lifecycle
- `UnitPayMerchant`: merchant registration and settlement routing
- `UnitPayEscrow`: lock, release, refund, dispute, timeout
- `UnitPayPacket`: claimable packet distribution

**Speaker notes**
The app includes a Hardhat contracts workspace with Solidity contracts deployed to Arc Testnet. The contracts cover transfer, payment request, merchant, escrow, and packet workflows. Frontend features use Circle Wallet challenges to approve and execute the relevant contract calls.

---

## Slide 14: Chain And Token Coverage

**Headline**
Built for Circle-supported testnet USDC.

**On-slide points**
- Arc Testnet is the primary chain
- Supported EVM testnets include Ethereum Sepolia, Base Sepolia, Avalanche Fuji, Arbitrum Sepolia, OP Sepolia, Polygon Amoy, and others
- Solana Devnet is documented with wallet compatibility warnings
- Chain config is centralized in `lib/chains/config.ts`
- Unit conversion utilities prevent decimal mistakes

**Speaker notes**
The app is testnet-only and intentionally avoids mainnet configuration. Chain details, USDC addresses, Gateway domains, RPC URLs, and faucet links are centralized. Unit conversion is handled through tested utilities to avoid mistakes between native gas decimals and USDC decimals.

---

## Slide 15: Architecture

**Headline**
Next.js app, Circle APIs, Gateway, and Arc Testnet contracts.

**On-slide points**
- Next.js App Router frontend and API routes
- Circle User-Controlled Wallets for wallet sessions and challenges
- Circle Gateway / Unified Balance Kit for cross-chain balance and deposit/spend flows
- Viem adapter for external browser wallet payments
- Contract reads via viem and writes through Circle challenge APIs

**Speaker notes**
UnitPay is a Next.js application with server API routes for Circle Wallet operations and client pages for wallet UX. Circle provides the user-controlled wallet challenge flow. Gateway provides unified balance and cross-chain USDC capabilities. The external wallet payment path uses the Circle Viem adapter with the Unified Balance Kit.

---

## Slide 16: Security And Guardrails

**Headline**
The demo is intentionally testnet-only and conservative.

**On-slide points**
- No mainnet addresses or mainnet RPCs
- No fiat rails, card processing, banking, or KYC
- Circle API key required for wallet routes
- Public links are viewable without auth, but actions require wallet/session where needed
- Escrow terms are encrypted before sharing

**Speaker notes**
The project is clearly scoped as a testnet-only demo. It does not include fiat rails or mainnet settings. Public links are safe to view without authentication, but sensitive actions require a valid wallet session or an external wallet signature. Escrow terms use client-side encryption to avoid publishing private agreement details.

---

## Slide 17: Demo Flow

**Headline**
A complete demo can show the full payment lifecycle.

**On-slide points**
1. Create or restore a UnitPay wallet
2. Deposit USDC into Gateway
3. Generate a payment link
4. Pay with UnitPay wallet or external wallet
5. Create an escrow or UnitPacket
6. Create a Pod and contribute

**Speaker notes**
The strongest demo path starts with onboarding, then shows wallet balance and Gateway. From there, generate a payment request and demonstrate both payer options: UnitPay wallet and external wallet. Then show richer workflows: escrow for protected payments, UnitPacket for claimable distribution, and Pods for collaborative funding.

---

## Slide 18: Why It Matters

**Headline**
UnitPay makes stablecoin payments feel like product workflows, not chain operations.

**On-slide points**
- Reduces chain and bridge friction
- Supports both onboarded users and external wallet payers
- Combines personal, merchant, escrow, packet, and group payment use cases
- Uses Circle infrastructure and on-chain contracts where each fits best

**Speaker notes**
The value of UnitPay is not just sending USDC. It is packaging stablecoin movement into workflows people recognize: invoices, links, escrow, group pools, giveaways, and merchant payments. Gateway removes much of the chain complexity, while contracts enforce the workflows that need on-chain guarantees.

---

## Slide 19: Current Status

**Headline**
Working testnet app with verified build and tests.

**On-slide points**
- Next.js production build passes
- Lint passes
- Unit tests cover payment encoding, Gateway allocation, burn intents, escrow terms, units, chains, and Pods
- Contracts workspace includes Hardhat tests
- Ready for demo and iteration

**Speaker notes**
The current implementation has a working build and test coverage across critical utilities. The frontend, API routes, Gateway helpers, local model tests, and contracts are organized for continued development. The next step is production hardening, persistent backend storage, and mainnet readiness only when the product requirements and compliance model are defined.

---

## Slide 20: Closing

**Headline**
UnitPay is a cross-chain USDC payment operating system.

**On-slide points**
- Wallet
- Links
- Gateway
- Escrow
- Packets
- Pods
- Merchant flows

**Speaker notes**
UnitPay brings together the core payment primitives needed for a practical stablecoin product. It gives users direct wallet control, lets payers use external wallets when they do not want to onboard, and expands beyond simple transfers into escrow, claimable packets, collaborative pods, and merchant workflows.
