"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createP2PPayoutDetailRemote,
  deleteP2PPayoutDetailRemote,
  listP2PPayoutDetailsRemote,
  updateP2PPayoutDetailRemote,
} from "@/lib/p2p/client";
import { P2P_PAYMENT_METHODS, type P2PCustomerPayoutDetail } from "@/lib/p2p/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

export default function P2PPaymentMethodsPage() {
  const { primaryWallet } = useWallet();
  const [details, setDetails] = useState<P2PCustomerPayoutDetail[]>([]);
  const [method, setMethod] = useState("Bank Transfer");
  const [label, setLabel] = useState("Primary payout account");
  const [recipientName, setRecipientName] = useState("");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [referenceNote, setReferenceNote] = useState("");
  const [instructions, setInstructions] = useState("");
  const [isDefault, setIsDefault] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    if (!primaryWallet?.id) return;
    setDetails(await listP2PPayoutDetailsRemote(primaryWallet.id));
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWallet?.id]);

  const grouped = useMemo(() => {
    return P2P_PAYMENT_METHODS.map((entry) => ({
      method: entry,
      details: details.filter((detail) => detail.method === entry),
    }));
  }, [details]);

  async function createDetail() {
    if (!primaryWallet?.id) {
      setMessage("Connect a wallet before saving payout details.");
      return;
    }
    if (!accountIdentifier.trim()) {
      setMessage("Add an account, phone, email, or handle.");
      return;
    }
    try {
      await createP2PPayoutDetailRemote({
        ownerCircleWalletId: primaryWallet.id,
        method,
        label,
        recipientName,
        accountIdentifier,
        institutionName,
        referenceNote,
        instructions,
        isDefault,
      });
      setAccountIdentifier("");
      setReferenceNote("");
      setInstructions("");
      setMessage("Payout detail saved.");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message ?? String(error));
    }
  }

  async function setDefault(detail: P2PCustomerPayoutDetail) {
    if (!primaryWallet?.id) return;
    await updateP2PPayoutDetailRemote(detail.id, {
      ownerCircleWalletId: primaryWallet.id,
      method: detail.method,
      isDefault: true,
    });
    await refresh();
  }

  async function deleteDetail(detail: P2PCustomerPayoutDetail) {
    if (!primaryWallet?.id) return;
    await deleteP2PPayoutDetailRemote(detail.id, primaryWallet.id);
    await refresh();
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title="Payout Details" backHref="/p2p" />
      <div className="grid md:grid-cols-5 gap-5">
        <Card className="md:col-span-2 space-y-3 h-fit">
          <div>
            <h2 className="font-semibold">Add payout detail</h2>
            <p className="text-xs text-muted mt-1">
              These are attached when you sell USDC to a merchant. The selected detail must match a payment method the merchant accepts.
            </p>
          </div>
          <Field label="Payment method">
            <Select value={method} onChange={(event) => setMethod(event.target.value)}>
              {P2P_PAYMENT_METHODS.map((entry) => (
                <option key={entry}>{entry}</option>
              ))}
            </Select>
          </Field>
          <Field label="Display label">
            <Input value={label} onChange={(event) => setLabel(event.target.value)} />
          </Field>
          <Field label="Recipient/account name">
            <Input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
          </Field>
          <Field label="Account, phone, email, or handle">
            <Input value={accountIdentifier} onChange={(event) => setAccountIdentifier(event.target.value)} />
          </Field>
          <Field label="Institution/provider">
            <Input value={institutionName} onChange={(event) => setInstitutionName(event.target.value)} />
          </Field>
          <Field label="Payment reference">
            <Input value={referenceNote} onChange={(event) => setReferenceNote(event.target.value)} />
          </Field>
          <Field label="Extra instructions">
            <Textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={3} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
            Make default for this method
          </label>
          <Button fullWidth disabled={!primaryWallet} onClick={createDetail}>
            Save payout detail
          </Button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </Card>

        <section className="md:col-span-3 space-y-4">
          {grouped.map(({ method: groupMethod, details: groupDetails }) => (
            <Card key={groupMethod} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-semibold">{groupMethod}</h2>
                <span className="text-xs text-muted">{groupDetails.length} saved</span>
              </div>
              {groupDetails.length === 0 ? (
                <p className="text-sm text-muted">
                  No payout detail saved for this method. You cannot sell to merchants that only accept this method until one is added.
                </p>
              ) : (
                <div className="space-y-2">
                  {groupDetails.map((detail) => (
                    <div key={detail.id} className="rounded-xl border border-border bg-background p-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{detail.label}</p>
                          <p className="text-xs text-muted">{detail.accountIdentifier}</p>
                        </div>
                        {detail.isDefault && (
                          <span className="text-[11px] font-semibold text-primary bg-primary-light px-2 py-1 rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-2 text-xs text-muted">
                        {detail.recipientName && <span>Recipient: {detail.recipientName}</span>}
                        {detail.institutionName && <span>Provider: {detail.institutionName}</span>}
                        {detail.referenceNote && <span>Reference: {detail.referenceNote}</span>}
                      </div>
                      {detail.instructions && <p className="text-xs text-muted whitespace-pre-wrap">{detail.instructions}</p>}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" disabled={detail.isDefault} onClick={() => setDefault(detail)}>
                          Set default
                        </Button>
                        <Button variant="ghost" onClick={() => deleteDetail(detail)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </section>
      </div>
    </main>
  );
}
