import { NextResponse } from "next/server";
import { addContribution, getPod } from "@/lib/pods/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pod = await getPod(id);
  return NextResponse.json(
    { contributions: pod?.contributions ?? [] },
    { status: pod ? 200 : 404 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    if (!body?.contributorAddress || !body?.amount) {
      return NextResponse.json(
        { error: "Missing contributorAddress or amount" },
        { status: 400 },
      );
    }
    const pod = await addContribution({
      podId: id,
      contributorAddress: String(body.contributorAddress),
      amount: String(body.amount),
      txHash: body.txHash ? String(body.txHash) : undefined,
    });
    return NextResponse.json({ pod }, { status: pod ? 201 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
