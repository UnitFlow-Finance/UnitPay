# UnitPay

> ⚠️ **TESTNET-ONLY DEMO. NO FIAT RAILS.** This app moves testnet USDC
> between testnet wallets on testnet chains. There is no on/off-ramp, no KYC,
> no real money anywhere in this codebase. Do not point any config at
> mainnet — see [Guardrails](#guardrails) below.

UnitPay is a demo wallet + payments app built on Circle's [User-Controlled
Wallets](https://developers.circle.com/w3s/user-controlled-wallets) and
[Gateway](https://developers.circle.com/gateway) products, targeting **Arc
Testnet** as its primary chain (USDC is the native gas asset on Arc — see
[`lib/units.ts`](lib/units.ts)) with cross-chain transfers to a handful of
other Circle-supported EVM testnets and Solana Devnet.

## Branding

Brand tokens (logo, colors, fonts) are sourced from
[`UnitFlow-Finance/docs`](https://github.com/UnitFlow-Finance/docs) — see
[`lib/branding.ts`](lib/branding.ts) for provenance notes and
[`app/globals.css`](app/globals.css) for the applied CSS variables.

## What's here

- **Onboarding** (`app/onboarding`) — PIN-based wallet creation via Circle's
  Web SDK (`@circle-fin/w3s-pw-web-sdk`), no email/password backend of our
  own; Circle owns the user identity + key material.
- **Recovery-code login** (`app/wallet/login`) — a user's Circle `userId` is
  shown once at signup as a device-independent recovery code; entering it
  plus the PIN restores a session from any device without relying on
  browser storage.
- **Wallet dashboard** (`app/wallet`) — balances, send/receive, transaction
  history, and a "Get testnet USDC" faucet flow.
- **Unified balance / cross-chain transfer** (`app/wallet/unified`) — reads
  a single aggregated balance across all supported chains via Circle's
  [`@circle-fin/unified-balance-kit`](https://developers.circle.com/gateway),
  then auto-allocates a send across whichever source chains have the funds
  (destination-first, then highest-balance-first) using Gateway's
  burn-intent + attestation + mint flow per leg (see
  [`lib/gateway`](lib/gateway)) — no manual "from chain X to chain Y"
  picker.
- **Solana Devnet** (`app/wallet/unified/solana`) — included with an
  explicit, prominent warning that Gateway transfers there currently require
  a **Solflare** wallet (arbitrary-message signing support); most other
  Solana wallets will reject the required signature.
- **Payment requests** (`app/wallet/request`, `app/pay/[encoded]`) —
  stateless, link-encoded payment requests (no backend database). Supports
  both a single receiver (v1) and a multi-receiver "split payment" (v2),
  where one payer action fans a lump payment out to several addresses
  atomically via `UnitPayTransfer.batchTransfer` — see
  [`lib/paymentRequest.ts`](lib/paymentRequest.ts).
- **Escrow** (`app/wallet/escrow`) — on-chain USDC escrow for freelance/
  bounty work: lock funds for a payee, release/refund, and an optional
  arbiter to resolve disputes. Task terms are AES-256-GCM encrypted
  client-side and shared only via the URL fragment (never sent to any
  server); only a keccak256 commitment hash of the terms lives on-chain, so
  both parties can verify they're looking at the same terms without anyone
  else being able to read them. "My escrows" is read directly from
  paginated on-chain event logs — no database. See
  [`lib/escrow/terms.ts`](lib/escrow/terms.ts) and
  [`lib/escrow/contract.ts`](lib/escrow/contract.ts).
- **Unit Packet** (`app/wallet/packet`) — a WeChat-hongbao-style USDC
  giveaway: lock a total amount split across N claims, either an equal cut
  or a randomized cut per claim. All split math (including the
  pseudo-random draws) runs on-chain at claim time — never in the browser —
  so a claimer can't influence or predict their own share ahead of the
  transaction. Unclaimed funds return to the creator after expiry. See
  [`lib/packet/contract.ts`](lib/packet/contract.ts).
- **Merchant dashboard** (`app/merchant`) — reduced-depth v1.5 view over
  Circle Wallets transaction history for a merchant's own wallet.
- **On-chain contracts** (`contracts-workspace/`) — Solidity contracts
  (`UnitPayTransfer`, `UnitPayPaymentRequest`, `UnitPayMerchant`,
  `UnitPayEscrow`, `UnitPayPacket`), deployed to Arc Testnet. See
  [Solidity contracts](#solidity-contracts-arc-testnet) below.

## Guardrails

- No mainnet network, RPC, or contract address appears anywhere in this
  repo. [`lib/chains/config.ts`](lib/chains/config.ts) is the single source
  of truth for chain data and every entry there is a verified **testnet**
  chain, cross-checked against Circle's own docs.
- No fiat on/off-ramp, no card processing, no bank rails — this app only
  ever moves testnet USDC that came from a public faucet.
- `.env.example` documents Circle keys and calls out, in-line, that they
  must be **testnet** keys.

## Getting started

```bash
npm install
cp .env.example .env.local
# fill in CIRCLE_API_KEY (testnet) and NEXT_PUBLIC_CIRCLE_APP_ID — see
# .env.example for where to get these from the Circle Console.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

See [`.env.example`](.env.example) for the full list with explanations.
At minimum you need a **testnet** Circle Developer API key and a User
Controlled Wallets App ID from the [Circle Console](https://console.circle.com).

Registry-backed metadata writes use `UNITPAY_METADATA_REGISTRY_PRIVATE_KEY`
as a deployment secret. Configure it only in the hosting platform's secret
manager, never in a committed env file. The value must be a single 32-byte
hex private key (`0x` + 64 hex characters, or 64 hex characters without the
prefix); do not paste an assignment line such as
`UNITPAY_METADATA_REGISTRY_PRIVATE_KEY=...`, a mnemonic, or JSON key text.

Any on-chain read/write path that would otherwise use a public RPC can be
pointed at a custom provider per chain with
`UNITPAY_RPC_URL_<CHAIN_KEY_IN_SCREAMING_SNAKE_CASE>`, for example
`UNITPAY_RPC_URL_ARC_TESTNET` or `UNITPAY_RPC_URL_BASE_SEPOLIA`. If an
override is not set, UnitPay falls back to the public RPC in
[`lib/chains/config.ts`](lib/chains/config.ts). `UNITPAY_METADATA_RPC_URL`
is still accepted for the metadata registry, but
`UNITPAY_RPC_URL_ARC_TESTNET` is preferred.

### Tests

```bash
npm test          # vitest — unit tests for chain config, unit conversion,
                   # burn-intent construction, source-chain allocation,
                   # payment-request encoding (single + multi-receiver),
                   # and escrow terms encryption/hashing
```

### Lint / build

```bash
npm run lint
npm run build
```

## Solidity contracts (Arc Testnet)

Located in [`contracts-workspace/`](contracts-workspace) as a separate
Hardhat project (kept out of the Next.js app's dependency tree/build).

- `UnitPayTransfer.sol` — P2P transfer + batch transfer with indexable
  events for off-chain history. `batchTransfer` also powers multi-receiver
  payment links (`/wallet/request` split mode).
- `UnitPayPaymentRequest.sol` — on-chain, verifiable payment requests
  (create / fulfill / cancel / expire) as an alternative to the app's
  stateless link-encoded requests.
- `UnitPayMerchant.sol` — minimal merchant registry + settlement routing.
- `UnitPayEscrow.sol` — USDC escrow with lock / release / refund and an
  optional arbiter for dispute resolution. Stores only a keccak256
  commitment hash of the (client-side encrypted) task terms, never the
  terms themselves.
- `UnitPayPacket.sol` — "Unit Packet" USDC giveaway supporting equal or
  on-chain pseudo-random splits across up to 200 claims, with creator
  reclaim after expiry.

`UnitPayTransfer`, `UnitPayPaymentRequest`, and `UnitPayMerchant` are thin,
stateless-beyond-their-own-bookkeeping contracts with no mutable state set
in their constructors (only an `immutable usdc` address), so they can be
deployed either directly or behind an OpenZeppelin
`TransparentUpgradeableProxy` without an `initialize()` step —
`scripts/deploy.js` does the latter. `UnitPayEscrow` and `UnitPayPacket`
were deployed later via Circle's Smart Contract Platform SDK
(`scripts/deploy-circle.js`) instead, since no funded Arc Testnet private
key was available for the standalone Hardhat deploy path at the time —
both deploy paths produce equivalent, unproxied contracts.

```bash
cd contracts-workspace
npm install
npm test                    # Hardhat + Chai — 97 tests across all 5
                             # contracts plus a proxy-deployment smoke test
npm run compile
```

**Deployed to Arc Testnet** (chain ID `5042002`), with a security review
pass (reentrancy, access control, overflow, DoS bounds, zero-address
checks) applied to every contract before deployment — see
[`contracts-workspace/README.md`](contracts-workspace/README.md) for the
full findings table and live contract addresses.

Network config in `hardhat.config.js` intentionally has **no mainnet
entry** — Arc mainnet does not publicly exist yet, and this project never
targets any other chain's mainnet either
