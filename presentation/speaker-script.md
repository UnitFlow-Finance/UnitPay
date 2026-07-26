# UnitPay Speaker Script

## Opening

UnitPay is a testnet USDC payments app built around Circle User-Controlled Wallets and Gateway. The product goal is to make stablecoin payments feel like normal payment workflows rather than chain operations. Instead of asking users to understand bridging, token contracts, or which chain funds are on, UnitPay provides wallet, link, escrow, packet, pod, and merchant flows in one app.

## Core Pitch

The problem is fragmentation. Users may hold USDC on different chains, payment links often force account creation, and collaborative payment workflows usually require multiple disconnected tools. UnitPay addresses this by combining a native UnitPay wallet with Gateway unified balance and public-link flows that can also accept external wallet payments.

The wallet dashboard is the command center. Users can send, receive, request, access Gateway, create escrow, create UnitPackets, manage Pods, and review activity. The dashboard also surfaces Escrow Pods directly because group funding is one of the key new workflows.

## Gateway Flow

Gateway is central to the cross-chain experience. UnitPay reads a unified USDC balance across supported EVM testnets. When users send from Gateway, they now have two options. Unified balance mode automatically allocates funds across chains. Specific chain mode lets the user choose exactly which source chain to spend from. This keeps the simple UX while preserving advanced control.

## Payment Links

Payment links support two payer paths. If the payer has a UnitPay wallet, they can pay using the existing wallet flow. If they do not want to create a UnitPay wallet, they can connect a browser wallet and pay externally. The external wallet path uses the Circle Unified Balance Kit deposit-for flow, so the payer deposits USDC from a supported EVM chain directly into the payment link owner's Gateway balance.

This matters because payment links should not require every payer to onboard first. UnitPay can receive from both native app users and external wallet users.

## Rich Payment Workflows

Escrow adds trust-minimized payment protection. A payer locks USDC for a payee, with release, refund, dispute, and timeout-resolution flows. Terms are encrypted client-side and shared through the URL fragment, while only a commitment hash is stored on-chain.

UnitPacket enables claimable USDC distribution. A creator locks a total amount and shares a claim link. The packet can be equal split or randomized split, with on-chain enforcement and reclaim after expiry.

Escrow Pods add collaborative funding. Pods can be public or private. Public pods appear in discovery. Private pods work through invite links and optional wallet whitelists. Pods track target amount, status, contributors, and contribution history.

## Merchant And Contracts

The merchant view shows that these same rails can support business payment workflows. A merchant can generate request links and review wallet transaction history without requiring separate custody infrastructure.

The contracts workspace includes `UnitPayTransfer`, `UnitPayPaymentRequest`, `UnitPayMerchant`, `UnitPayEscrow`, and `UnitPayPacket`. These contracts provide the on-chain enforcement layer for transfers, batch payments, requests, merchant settlement, escrow, and claimable packets.

## Close

UnitPay is best understood as a cross-chain USDC payment operating system. It combines wallet custody, public links, Gateway, escrow, packets, pods, and merchant workflows. The product reduces chain friction while preserving user control and on-chain guarantees where they matter.
