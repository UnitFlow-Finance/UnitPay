"use client";

import { useEffect, useState } from "react";
import { createArbitratorRuleRemote, listArbitratorRulesRemote } from "@/lib/arbitration/client";
import type { ArbitratorAction, ArbitratorRule } from "@/lib/arbitration/types";
import { useWallet } from "@/lib/useWallet";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Input";

export default function ArbitratorBuilderPage() {
  const { primaryWallet } = useWallet();
  const [rules, setRules] = useState<ArbitratorRule[]>([]);
  const [name, setName] = useState("Delivery confirmation release");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("Both parties approve or delivery evidence is uploaded");
  const [action, setAction] = useState<ArbitratorAction>("release");
  const [timeoutHours, setTimeoutHours] = useState("72");
  const [splitPayeePercent, setSplitPayeePercent] = useState("50");
  const [requiresBothApproval, setRequiresBothApproval] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    if (!primaryWallet) return;
    setRules(await listArbitratorRulesRemote(primaryWallet.id));
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryWallet?.id]);

  async function createRule() {
    if (!primaryWallet) return;
    const rule = await createArbitratorRuleRemote({
      ownerCircleWalletId: primaryWallet.id,
      name,
      description,
      trigger,
      action,
      timeoutHours: Number(timeoutHours),
      splitPayeePercent: Number(splitPayeePercent),
      requiresBothApproval,
    });
    setRules((previous) => [rule, ...previous]);
    setMessage("Arbitrator rule created.");
  }

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md md:max-w-5xl mx-auto w-full space-y-6">
      <PageHeader title="AI Arbitrator Builder" backHref="/wallet" />
      <div className="grid md:grid-cols-5 gap-5">
        <Card className="md:col-span-2 space-y-3 h-fit">
          <Field label="Rule name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Description">
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
          </Field>
          <Field label="Trigger">
            <Textarea value={trigger} onChange={(event) => setTrigger(event.target.value)} rows={3} />
          </Field>
          <Field label="Action">
            <Select value={action} onChange={(event) => setAction(event.target.value as ArbitratorAction)}>
              <option value="release">Release funds</option>
              <option value="refund">Refund after timeout</option>
              <option value="require_evidence">Require evidence</option>
              <option value="escalate_manual">Escalate to manual review</option>
              <option value="split">Split funds</option>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Timeout hours">
              <Input value={timeoutHours} onChange={(event) => setTimeoutHours(event.target.value)} inputMode="numeric" />
            </Field>
            <Field label="Payee split %">
              <Input value={splitPayeePercent} onChange={(event) => setSplitPayeePercent(event.target.value)} inputMode="numeric" />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={requiresBothApproval}
              onChange={(event) => setRequiresBothApproval(event.target.checked)}
            />
            Require both parties to approve
          </label>
          <Button onClick={createRule} disabled={!primaryWallet || !name} fullWidth>Create rule</Button>
          {message && <p className="text-xs text-muted">{message}</p>}
        </Card>
        <section className="md:col-span-3 space-y-3">
          {rules.length === 0 ? (
            <Card className="text-sm text-muted">No arbitrator rules yet.</Card>
          ) : (
            rules.map((rule) => (
              <Card key={rule.id} className="space-y-2">
                <div className="flex justify-between gap-3">
                  <p className="font-medium">{rule.name}</p>
                  <span className="text-xs font-medium">{rule.status}</span>
                </div>
                <p className="text-sm text-muted">{rule.trigger}</p>
                <p className="text-xs text-subtle">
                  Action: {rule.action.replaceAll("_", " ")} · Timeout {rule.timeoutHours ?? 0}h
                </p>
              </Card>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
