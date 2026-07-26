# UnitPay contracts

Solidity contracts for UnitPay, targeting **Arc Testnet only**. Separate
Hardhat project, kept out of the Next.js app's build/dependency tree — see
the root [`README.md`](../README.md) for how this fits into the rest of
UnitPay.

## Contracts

- `UnitPayTransfer.sol` — P2P transfer + batch transfer with indexable events.
- `UnitPayPaymentRequest.sol` — on-chain, verifiable payment requests.
- `UnitPayMerchant.sol` — merchant registry + settlement routing.
- `UnitPayEscrow.sol` — USDC escrow (lock / release / refund) with an
  optional arbiter for dispute resolution. Stores only a keccak256
  commitment hash of the task terms; the terms themselves are AES-encrypted
  client-side and never touch chain storage (see `lib/escrow/terms.ts` in
  the Next.js app).
- `UnitPayPacket.sol` — "Unit Packet" USDC giveaway: a creator locks a
  total split across up to 200 claims, either equal or on-chain
  pseudo-random per-claim amounts (classic red-packet algorithm). Unclaimed
  funds return to the creator after expiry.

All five share the same shape: an `immutable usdc` token address set once
in the constructor, no other mutable state written there, `ReentrancyGuard`
on every function that makes an external call, and `SafeERC20` for all
token transfers.

## Security review

Manual review + `solhint` pass. Summary of what was checked and the result:

| Area | Finding |
|---|---|
| Reentrancy | All state-mutating external-call functions (`transfer`, `batchTransfer`, `fulfill`, `pay`, `createEscrow`/`release`/`refund`, `createPacket`/`claim`/`reclaim`) are `nonReentrant`; state is updated before the external `safeTransfer`/`safeTransferFrom` call (checks-effects-interactions) in every case. |
| Access control | Owner-gated functions (`cancel`, `updateSettlementAddress`, `deactivate`, `dispute`, escrow `release`/`refund` role checks) check `msg.sender` against the stored owner/party before mutating state. No `onlyOwner`-style contract-wide admin exists by design — each resource (request, merchant, escrow, packet) is owned/governed by whoever created or is party to it. |
| Integer overflow/underflow | Solidity 0.8.20 has built-in overflow checks. Manual arithmetic on fixed-width types (`uint64(block.timestamp) + expiresIn` in `UnitPayPaymentRequest`/`UnitPayEscrow`/`UnitPayPacket`) is bounded by a `MAX_EXPIRES_IN` cap (365 days) on every contract that uses it, so it cannot approach the `uint64` ceiling. |
| Zero-address / zero-amount inputs | Every constructor reverts on a zero `usdc` address. All value-moving functions revert on a zero amount and zero recipient/settlement/payee address; `UnitPayEscrow.createEscrow` additionally rejects `payee == msg.sender`. |
| Unbounded loops / DoS | `batchTransfer`'s loop is bounded by `MAX_BATCH_SIZE` (200); `UnitPayPacket.createPacket` bounds `maxClaims` to `MAX_CLAIMS_PER_PACKET` (200). Neither can be constructed to exceed the block gas limit, and both can only ever grief the caller's own transaction — funds and other users are not at risk either way. |
| Unbounded strings | Every `memo`/description string parameter is capped (`MAX_MEMO_LENGTH = 280` bytes) to keep calldata/log costs bounded and predictable. |
| Front-running | `fulfill`/`pay`/`claim` are open to any caller who supplies the required USDC or meets the claim conditions — this is intentional. There is no economically exploitable ordering dependency for `fulfill`/`pay` (the requester/merchant always receives the exact recorded `amount`). For `UnitPayPacket.claim`, ordering *does* affect a claimer's random-mode share (earlier claims draw from a larger remaining pool) — this is the intended, documented behavior of a first-come-first-served giveaway, not a vulnerability. |
| On-chain pseudo-randomness (`UnitPayPacket`) | `_computeShare`'s random draw mixes `blockhash(block.number - 1)`, `block.prevrandao`, `msg.sender`, `packetId`, and the running claim count. This is influenceable by the block producer and is explicitly documented in-contract as unsuitable for anything security-critical — acceptable here because the amounts at stake are giveaway-scale and there's no way to bias a split in one's own favor without controlling both the claiming address and block production. |
| Encrypted terms commitment (`UnitPayEscrow`) | `termsHash` is an opaque `bytes32` accepted as-is and never verified on-chain — by design, since the contract has no way to check a keccak256 preimage without the plaintext. Both parties are expected to verify the hash off-chain (the Next.js client does this automatically against the decrypted terms — see `lib/escrow/terms.ts`). A malicious payer could in principle pass a hash that doesn't match what they show the payee off-chain; this is a UX/trust concern between the two parties, not a fund-safety issue, since the escrowed amount is still enforced on-chain regardless of what the hash claims to commit to. |
| Zero-value packets | `UnitPayPacket.createPacket` requires `totalAmount >= maxClaims` so every claim resolves to at least 1 base unit; `remainingAmount` is decremented exactly by each claim's computed share, and the last claim always receives the exact remainder, so a packet always empties to precisely zero with no dust left permanently locked. |
| EVM target compatibility | `evmVersion` explicitly pinned to `paris` in `hardhat.config.js` so Solidity never emits `PUSH0` (default from solc 0.8.24+), which may not be supported by Arc Testnet's EVM implementation. |
| Proxy upgradeability | Verified via a dedicated test (`test/UpgradeableProxy.test.js`) that deploying `UnitPayTransfer` behind `TransparentUpgradeableProxy` works correctly — the `immutable usdc` value is read correctly through the proxy since immutables are inlined into implementation bytecode, not proxy storage. `UnitPayEscrow`/`UnitPayPacket` are deployed unproxied (see [Deployment](#deployment-arc-testnet) below) — same reasoning applies (no mutable constructor state), a proxy simply wasn't needed for their deploy path. |
| Test coverage | 97 Hardhat tests across all five contracts (26 for `UnitPayPacket` alone, covering equal/random split math, expiry, and reclaim) plus the proxy-deployment pattern, covering every function, every custom error/revert path, and the events emitted on each state transition. |

Not performed (out of scope for a testnet demo, but worth doing before any
mainnet-adjacent use): a fuzzing pass (e.g. Foundry/Echidna), a third-party
audit, and a Slither static-analysis pass (`slither-analyzer` was not
available in this build environment).

## Development

```bash
npm install
npm run compile
npm test
```

## Deployment (Arc Testnet)

Two deploy paths exist, both writing to the shared
`deployments.arcTestnet.json`:

### Path 1: standalone Hardhat deploy (requires a funded private key)

```bash
cp .env.example .env   # fill in PRIVATE_KEY — a funded Arc Testnet key
npm run deploy:arcTestnet
```

`scripts/deploy.js` deploys a shared `ProxyAdmin` plus `UnitPayTransfer`,
`UnitPayPaymentRequest`, and `UnitPayMerchant` behind their own
`TransparentUpgradeableProxy`, and refuses to run against any network
other than `arcTestnet`.

### Path 2: Circle Smart Contract Platform SDK (no local private key needed)

Used for `UnitPayEscrow` and `UnitPayPacket`, deployed after the fact when
no funded Arc Testnet private key was available locally. Deploys via a
Circle Developer-Controlled Wallet instead of a local signer — Circle
custodies the deployer key, funded directly through its wallet address.

```bash
cp .env.example .env.local   # fill in CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET,
                              # CIRCLE_DEPLOYER_WALLET_ID (a funded
                              # Developer-Controlled wallet on Arc Testnet)
npm run deploy:escrow:circle
npm run deploy:packet:circle
```

`scripts/deploy-circle.js <ContractName> [constructorArgs...]` is generic
(works for any contract in `contracts/`) and idempotent — it first checks
for an existing `COMPLETE` deployment under the same contract name before
deploying again, since Circle requires contract names to be globally
unique per account. Resulting `contractAddress`/`txHash` are polled via
`getContract` until the deployment status is `COMPLETE`.

### Live deployment

Deployed and verified end-to-end (proxy `usdc()` reads confirmed on-chain,
plus a real `UnitPayTransfer.transfer()` call confirmed in a mined block):

| Contract | Address | Deploy method |
|---|---|---|
| `ProxyAdmin` | `0x160A317b07ed419124a7f02C7A27D6299F6FDEC9` | Hardhat (proxy) |
| `UnitPayTransfer` | `0xA666E45cb863C1eB541E5EB5918af61BaEF30faC` | Hardhat (proxy) |
| `UnitPayPaymentRequest` | `0x449236Dff7C99462C9148eBDCf69e51750C8f28f` | Hardhat (proxy) |
| `UnitPayMerchant` | `0xf9b9f1D39BFCA9F8d1386f69EC1978740F310666` | Hardhat (proxy) |
| `UnitPayEscrow` | `0xeDb41960251D3d377372b877752b67C0A8Ca851A` | Hardhat (unproxied, redeployed post-audit) |
| `UnitPayPacket` | `0xd35E1ef94a7B70D04A798537d3bcE9677DC638d4` | Hardhat (unproxied, redeployed post-audit) |

Network: Arc Testnet (chain ID `5042002`). USDC token address used:
`0x3600000000000000000000000000000000000000` (Arc's native-gas USDC,
which also exposes the standard ERC-20 interface — confirmed via
`decimals()`/`symbol()`/`name()`/`balanceOf()` before deployment).
