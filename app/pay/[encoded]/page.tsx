"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { chainKeyForBlockchain } from "@/lib/chains/lookup";
import { DEFAULT_SELECTOR_CHAINS, getChain } from "@/lib/chains/config";
import { useCircleSdk } from "@/lib/circle/sdkContext";
import { allocateSourceChains } from "@/lib/gateway/allocate";
import {
  connectExternalEvmWallet,
  depositForGatewayAccount,
  type ConnectedExternalWallet,
} from "@/lib/gateway/externalWalletClient";
import { sendGatewayUsdcLeg } from "@/lib/gateway/transferClient";
import {
  decodePaymentRequest,
  isMultiReceiverRequest,
  receiversForRequest,
  type PaymentRequestPayload,
} from "@/lib/paymentRequest";
import { useGatewayBalance } from "@/lib/useGatewayBalance";
import { useWallet } from "@/lib/useWallet";
import { walletForChainKey } from "@/lib/wallet/selectors";
import { Logo } from "@/components/Logo";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Step = "review" | "working" | "done" | "error";
type ExternalStep = "idle" | "connecting" | "paying" | "done" | "error";

export default function FulfillPaymentRequestPage({
  params,
}: {
  params: Promise<{ encoded: string }>;
}) {
  const { encoded } = use(params);
  const router = useRouter();
  const { primaryWallet, wallets, loading: walletLoading } = useWallet();
  const gateway = useGatewayBalance(wallets);
  const { executeChallenge } = useCircleSdk();
  const [step, setStep] = useState<Step>("review");
  const [error, setError] = useState<string | null>(null);
  const [externalWallet, setExternalWallet] = useState<ConnectedExternalWallet | null>(null);
  const [externalSourceChainKey, setExternalSourceChainKey] = useState<string>(
    DEFAULT_SELECTOR_CHAINS[0],
  );
  const [externalStep, setExternalStep] = useState<ExternalStep>("idle");
  const [externalMessage, setExternalMessage] = useState<string | null>(null);

  let request: PaymentRequestPayload;
  try {
    // `encoded` is already a URL-safe base64 string (see lib/paymentRequest.ts),
    // so no extra decodeURIComponent step is needed here.
    request = decodePaymentRequest(encoded);
  } catch {
    return (
      <main className="min-h-full flex items-center justify-center px-6">
        <p className="text-error text-sm text-center">
          This payment request link is invalid or corrupted.
        </p>
      </main>
    );
  }

  const chain = getChain(chainKeyForBlockchain(request.blockchain));
  const isMultiReceiver = isMultiReceiverRequest(request);
  const receivers = receiversForRequest(request);
  const canUseGateway = !isMultiReceiver && chain.family === "evm";
  const evmChainKeys = DEFAULT_SELECTOR_CHAINS.filter((key) => getChain(key).family === "evm");

  async function handleConnectExternalWallet() {
    setExternalStep("connecting");
    setExternalMessage("Connecting wallet...");
    try {
      const wallet = await connectExternalEvmWallet();
      setExternalWallet(wallet);
      setExternalStep("idle");
      setExternalMessage(null);
    } catch (err) {
      setExternalStep("error");
      setExternalMessage((err as Error).message ?? String(err));
    }
  }

  async function handleExternalPay() {
    setExternalStep("paying");
    setExternalMessage("Depositing from connected wallet into the payee's Gateway balance...");
    try {
      const wallet = externalWallet ?? (await connectExternalEvmWallet());
      setExternalWallet(wallet);
      await depositForGatewayAccount({
        wallet,
        sourceChainKey: externalSourceChainKey,
        depositAccount: request.requesterAddress,
        amount: request.amount,
      });
      setExternalStep("done");
      setExternalMessage("Payment deposited into the payee's Gateway balance.");
    } catch (err) {
      setExternalStep("error");
      setExternalMessage((err as Error).message ?? String(err));
    }
  }

  async function handlePay() {
    if (!primaryWallet) return;
    setStep("working");
    setError(null);
    try {
      const userToken = window.localStorage.getItem("unitpay.userToken");
      if (!userToken) throw new Error("Session expired — please reload.");

      if (isMultiReceiver) {
        const arcWallet = walletForChainKey(wallets, "arcTestnet");
        if (!arcWallet) throw new Error("Create an Arc Testnet wallet before paying this link.");
        // Multi-receiver: one approve() covering the total, then a single
        // batchTransfer() fans it out to every receiver atomically — see
        // UnitPayTransfer.sol and /api/wallet/batch-approve|batch-transfer.
        const { challengeId: approveChallengeId } = await apiPost<{ challengeId: string }>(
          "/api/wallet/batch-approve",
          { userToken, walletId: arcWallet.id, totalAmount: request.amount },
        );
        if (!approveChallengeId) throw new Error("No challenge returned from server.");
        await executeChallenge(approveChallengeId);

        const { challengeId: transferChallengeId } = await apiPost<{ challengeId: string }>(
          "/api/wallet/batch-transfer",
          { userToken, walletId: arcWallet.id, receivers },
        );
        if (!transferChallengeId) throw new Error("No challenge returned from server.");
        await executeChallenge(transferChallengeId);
      } else if (canUseGateway) {
        const legs = allocateSourceChains(
          gateway.perChain.map((b) => ({ chainKey: b.chainKey, balance: b.balance })),
          request.amount,
          chain.key,
        );

        for (const leg of legs) {
          const sourceChain = getChain(leg.chainKey);
          const sourceWallet =
            wallets.find((wallet) => wallet.blockchain === sourceChain.circleBlockchain) ??
            (sourceChain.circleBlockchain === "EVM-TESTNET"
              ? wallets.find((wallet) => wallet.blockchain === "EVM-TESTNET")
              : null);
          const destinationWallet =
            wallets.find((wallet) => wallet.blockchain === chain.circleBlockchain) ??
            (chain.circleBlockchain === "EVM-TESTNET"
              ? wallets.find((wallet) => wallet.blockchain === "EVM-TESTNET")
              : null);
          if (!sourceWallet || !destinationWallet) {
            throw new Error("Enable wallets for the payment source and destination chains first.");
          }
          await sendGatewayUsdcLeg({
            userToken,
            sourceWalletId: sourceWallet.id,
            destinationWalletId: destinationWallet.id,
            sourceChainKey: leg.chainKey,
            destinationChainKey: chain.key,
            sourceAddress: sourceWallet.address,
            recipientAddress: request.requesterAddress,
            amount: leg.amount,
            executeChallenge,
          });
        }
      } else {
        const paymentWallet = walletForChainKey(wallets, chain.key);
        if (!paymentWallet) {
          throw new Error(`Create a ${chain.label} wallet before paying on this chain.`);
        }
        const { challengeId } = await apiPost<{ challengeId: string }>("/api/wallet/transfer", {
          userToken,
          walletId: paymentWallet.id,
          destinationAddress: request.requesterAddress,
          amount: request.amount,
          tokenAddress: chain.usdcIsNativeGas ? "" : chain.usdcAddress,
          blockchain: request.blockchain,
        });

        if (!challengeId) throw new Error("No challenge returned from server.");
        await executeChallenge(challengeId);
      }

      setStep("done");
    } catch (err) {
      setError((err as Error).message ?? String(err));
      setStep("error");
    }
  }

  return (
    <main className="min-h-full flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-sm sm:max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <Logo size={40} withWordmark={false} />
          <h1 className="text-lg sm:text-xl font-semibold">Payment request</h1>
        </div>

        {step === "review" && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Amount</span>
                <span className="font-medium">{request.amount} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted">Network</span>
                <span className="font-medium">{chain.label}</span>
              </div>
              {!isMultiReceiver && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">To</span>
                  <span className="font-mono text-xs">
                    {request.requesterAddress.slice(0, 10)}…{request.requesterAddress.slice(-6)}
                  </span>
                </div>
              )}
              {request.memo && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Memo</span>
                  <span>{request.memo}</span>
                </div>
              )}
            </Card>

            {isMultiReceiver && (
              <Card className="space-y-2">
                <p className="text-xs text-muted uppercase tracking-wide">
                  Splits {receivers.length} ways in one transaction
                </p>
                {receivers.map((r, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="font-mono text-xs text-muted">
                      {r.label ? `${r.label} · ` : ""}
                      {r.address.slice(0, 8)}…{r.address.slice(-6)}
                    </span>
                    <span className="font-medium">{r.amount} USDC</span>
                  </div>
                ))}
              </Card>
            )}

            <Card className="space-y-3">
              <p className="text-sm font-medium">Pay with UnitPay wallet</p>
              {walletLoading ? (
                <p className="text-sm text-muted text-center">Checking session...</p>
              ) : !primaryWallet ? (
                <p className="text-sm text-muted text-center">
                  Use your UnitPay wallet,{" "}
                  <Link
                    href={`/onboarding/wallet?next=${encodeURIComponent(`/pay/${encoded}`)}`}
                    className="text-accent underline"
                  >
                    create one
                  </Link>
                  {" "}or{" "}
                  <Link
                    href={`/onboarding/login?next=${encodeURIComponent(`/pay/${encoded}`)}`}
                    className="text-accent underline"
                  >
                    log in
                  </Link>
                  .
                </p>
              ) : (
                <div className="space-y-2">
                  {canUseGateway && (
                    <p className="text-xs text-muted text-center">
                      Pays from your Gateway unified USDC balance and delivers on {chain.label}.
                    </p>
                  )}
                  {canUseGateway && gateway.error && (
                    <p className="text-xs text-error text-center">{gateway.error}</p>
                  )}
                  <Button
                    onClick={handlePay}
                    disabled={canUseGateway && gateway.loading}
                    size="lg"
                    fullWidth
                  >
                    {canUseGateway && gateway.loading
                      ? "Checking Gateway balance..."
                      : `Pay ${request.amount} USDC`}
                  </Button>
                </div>
              )}
            </Card>

            {canUseGateway && (
              <Card className="space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Pay with external wallet</p>
                  <p className="text-xs text-muted">
                    Connect a browser wallet and pay USDC from any supported EVM chain. The
                    deposit credits the payee&apos;s Gateway balance directly.
                  </p>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-sm text-muted">Pay from chain</span>
                  <select
                    value={externalSourceChainKey}
                    onChange={(e) => setExternalSourceChainKey(e.target.value)}
                    className="w-full rounded-xl bg-background border border-border px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary"
                  >
                    {evmChainKeys.map((key) => (
                      <option key={key} value={key}>
                        {getChain(key).label}
                      </option>
                    ))}
                  </select>
                </label>

                {externalWallet && (
                  <p className="text-xs text-muted font-mono break-all">
                    Connected: {externalWallet.address}
                  </p>
                )}

                {!externalWallet ? (
                  <Button
                    onClick={handleConnectExternalWallet}
                    disabled={externalStep === "connecting"}
                    variant="secondary"
                    fullWidth
                  >
                    {externalStep === "connecting" ? "Connecting..." : "Connect wallet"}
                  </Button>
                ) : null}
                <Button
                  onClick={handleExternalPay}
                  disabled={externalStep === "connecting" || externalStep === "paying"}
                  size="lg"
                  fullWidth
                >
                  {externalStep === "paying"
                    ? "Depositing..."
                    : `Pay ${request.amount} USDC externally`}
                </Button>
                {externalMessage && (
                  <p
                    className={`text-xs ${
                      externalStep === "error" ? "text-error" : "text-muted"
                    }`}
                  >
                    {externalMessage}
                  </p>
                )}
              </Card>
            )}
          </div>
        )}

        {step === "working" && (
          <p className="text-muted text-sm text-center py-8">
            Approve this payment with your PIN in the popup...
          </p>
        )}

        {step === "done" && (
          <div className="space-y-4 text-center py-6">
            <p className="text-success font-medium">Payment sent</p>
            <Button onClick={() => router.push("/wallet")} size="lg" fullWidth>
              Back to wallet
            </Button>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4 text-center py-6">
            <p className="text-error font-medium">Payment failed</p>
            <p className="text-muted text-sm">{error}</p>
            <Button onClick={() => setStep("review")} variant="secondary" size="lg" fullWidth>
              Try again
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
