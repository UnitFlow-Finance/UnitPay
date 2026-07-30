import { QRCodeSVG } from "qrcode.react";
import { encodeUnitPayQr } from "@/lib/platform/qr";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const qrValue = encodeUnitPayQr({
    kind: "circle-wallet-id",
    value: id,
    route: `/wallet/send?recipient=${encodeURIComponent(id)}`,
    objectType: "user",
    objectId: id,
  });

  return (
    <main className="px-4 sm:px-6 py-6 sm:py-8 max-w-md mx-auto w-full space-y-6">
      <PageHeader title="UnitPay Profile" backHref="/wallet" />
      <Card className="space-y-4 text-center">
        <div className="mx-auto bg-white p-4 rounded-xl w-fit">
          <QRCodeSVG value={qrValue} size={200} />
        </div>
        <div>
          <p className="text-xs text-muted">Circle Wallet ID</p>
          <p className="text-sm font-mono break-all">{id}</p>
        </div>
        <LinkButton href={`/wallet/send?recipient=${encodeURIComponent(id)}`} fullWidth>
          Send payment
        </LinkButton>
      </Card>
    </main>
  );
}
