# UnitPay Video Script

## Opening

UnitPay is a testnet stablecoin payments platform built around Circle User-Controlled Wallets, Circle Gateway, and on-chain payment workflows.

The goal is simple: make USDC payments feel like product flows, not chain operations. A user should be able to send, receive, pay a link, pool funds with friends, trade P2P, manage virtual cards, or scan a QR code without needing to think about bridges, contract addresses, or where liquidity is sitting.

## The Problem

Stablecoin payments are powerful, but the experience is still fragmented.

People hold funds across different chains. Payment links often force every payer to create an account. Group payments and escrow usually happen in separate tools. P2P trading can be confusing because a merchant's "buy" and a customer's "sell" are opposite sides of the same trade. And on mobile, even small UX issues can make a payment flow feel unreliable.

UnitPay brings these pieces into one dashboard and uses Gateway plus smart contracts where they make sense.

## Wallet And Onboarding

The app starts with onboarding. UnitPay uses Circle User-Controlled Wallets, hosted PIN challenges, wallet backup checks, and session-aware login behavior.

If a visitor opens a public payment link, escrow link, UnitPacket, or Pod, UnitPay checks whether there is already an active session. If the user is already signed in, they go straight to the payment experience. If not, they are guided through onboarding or login only when it is required.

The UnitPay logo and home route now consistently take users back to onboarding, which acts as the app's home page instead of sending logged-in users directly into the wallet.

## Dashboard

The wallet dashboard is the command center.

From here, users can view balances, open transaction details, send money, receive money, request payment, use Gateway, access P2P, manage Pods, create escrow, create UnitPackets, manage virtual cards, and open the universal QR scanner.

The home page has been tightened for mobile so the main actions remain usable on smaller screens.

## Unified Gateway Balance

Gateway is the cross-chain layer.

UnitPay displays a unified Gateway balance instead of treating Arc Testnet as the only balance. Users can inspect chain-level Gateway balances, personal wallet balances, and combined totals. The app also keeps chain-specific control where needed, so users can spend from the unified balance or choose a particular source chain.

Read calls are configured to prefer custom RPC URLs per chain, with public RPCs only as fallback. That reduces rate-limit problems while keeping the app portable.

## Payment Links

Payment links support two payer paths.

First, a UnitPay user can pay from their normal wallet or Gateway balance. Second, a payer who does not want to create a UnitPay wallet can connect an external EVM wallet and pay from a supported chain.

That external wallet path uses the Gateway deposit-for flow, so the payer deposits from their own wallet and the value lands in the payment link owner's Gateway balance. This gives the payee a clean receiving experience while keeping the payer flow lightweight.

Payment links can also connect to collaborative Pods. That means one payment request can become a shared funding flow: create a link, enable collaborative funding, invite contributors, track progress, and complete the payment once the target is reached.

## Escrow Pods

Escrow Pods are shared payment pools.

A Pod can be public or private. Public Pods are indexed into discovery and should appear immediately after creation. Private Pods are accessible through invite links and can optionally restrict contributors by wallet address.

Each Pod tracks its creator, description, target amount, status, contributors, funding progress, and contribution history. This supports group purchases, donations, shared expenses, crowdfunding, and collaborative payment-link funding.

## UnitPacket And Escrow

UnitPacket turns USDC into shareable claim links. A creator locks a total amount, chooses equal or randomized claims, and shares the generated link. The link is shown immediately after creation and can be copied for distribution.

Escrow handles trust-minimized payments. Funds can be locked, released, refunded, or resolved based on the escrow flow. Terms can be protected client-side while the on-chain workflow enforces the funds movement.

## P2P Marketplace

The P2P section is now a full marketplace flow.

Merchants can create buy and sell offers, edit offers, disable or delete them, add liquidity, link saved payout details, configure payment methods, and track active trades.

For the customer, the marketplace is shown in the natural user language: if the customer wants to buy USDC, they see merchant sell offers. If the customer wants to sell USDC, they see merchant buy offers. This resolves the common confusion between merchant-side inventory language and customer-side action language.

Offer pages support fiat or asset amount entry. A user can type an amount in USD, NGN, GHS, or another supported fiat currency, or type the USDC amount directly. The UI shows the converted value under the input without changing how the final on-chain amount is parsed.

P2P payment methods include bank transfer, mobile money, cash, digital wallets, local payment providers, card transfer, gift cards, bill payment, and regional rails like ACH, SEPA, and UPI.

Customers can save payout details separately from the trade. When a customer sells USDC, UnitPay selects a default payout detail that matches the merchant's accepted method, and the customer can switch it before starting the trade. This keeps sensitive payment details out of offer pages and only reveals the correct details after a trade has started.

Trades include status tracking, encrypted chat, proof and instruction surfaces, and notification indicators when a trade requires attention.

On Arc Testnet, P2P uses real wallet funds in the trade flow. Seller-side token movement is locked on-chain, and offer liquidity determines how much can be traded. If escrowed liquidity is exhausted, the offer is disabled so another user cannot start a trade against unavailable funds.

## Virtual Cards

The virtual cards module has been expanded from a list into a management experience.

Each card is clickable and opens a detail page. Users can see nickname, network, status, last four digits, balance, currency, spending limits, billing information when available, creation date, expiry date, transaction history, and card actions.

Cards can be frozen or unfrozen, funded from Gateway balance, withdrawn from where supported, replaced or deleted where applicable, and copied through controlled masked-detail actions. The copy behavior now avoids leaking masked values as if they were usable credentials.

The card module is designed around a provider abstraction so Mastercard, Visa, and future card providers can be integrated, and the copy and usage language also supports AI-agent spending workflows.

## QR And Share Links

QR is now a platform-level flow.

Users can generate QR codes for receiving, requests, payment links, wallet identifiers, Pods, UnitPackets, escrows, P2P objects, merchant profiles, and public profiles. UnitPay prefers Circle Wallet IDs where possible and keeps raw addresses as an advanced option.

The scanner is available from key payment surfaces. Address inputs can scan QR codes, and uploaded QR images are supported in the same places scanning is supported. The scanner recognizes UnitPay deep links and supported wallet/payment payloads so the user lands on the right screen with minimal friction.

Public objects also generate rich OpenGraph and Twitter preview cards with UnitPay branding, title, subtitle, amount, status, creator context, and QR-ready styling where applicable.

## On-Chain Registry And Serverless Safety

UnitPay moved away from relying on local filesystem storage for public objects in serverless environments. Public objects and metadata are designed around registry-backed persistence so APIs do not fail when a deployment target cannot write to paths like `.unitpay-data`.

This matters for Pods, P2P offers, payment links, and other shared objects that must remain discoverable and consistent after deployment.

## Close

UnitPay is a cross-chain payments operating system for stablecoins.

It combines wallet onboarding, Gateway balances, external wallet payments, payment links, collaborative Pods, UnitPackets, escrow, P2P trading, virtual cards, QR flows, and rich shareable previews into one app.

The product is still intentionally testnet-focused, but the architecture is pointed toward production: modular services, smart-contract-backed payment flows, custom RPC support, session-aware authentication, and a UI built for real users on desktop and mobile.

The headline is this: UnitPay turns stablecoin infrastructure into payment workflows people can actually use.
