import { NextResponse } from "next/server";
import { createPod, listPods } from "@/lib/pods/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const visibility = url.searchParams.get("visibility") === "public" ? "public" : undefined;
  const pods = await listPods(visibility);
  return NextResponse.json({ pods });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body?.title || !body?.description || !body?.creatorAddress || !body?.treasuryAddress) {
      return NextResponse.json({ error: "Missing required pod fields" }, { status: 400 });
    }
    const pod = await createPod({
      title: String(body.title),
      description: String(body.description),
      creatorAddress: String(body.creatorAddress),
      creatorLabel: body.creatorLabel ? String(body.creatorLabel) : undefined,
      treasuryAddress: String(body.treasuryAddress),
      blockchain: String(body.blockchain),
      visibility: body.visibility === "private" ? "private" : "public",
      whitelist: Array.isArray(body.whitelist) ? body.whitelist.map(String) : [],
      targetAmount: body.targetAmount ? String(body.targetAmount) : undefined,
      paymentLink: body.paymentLink,
    });
    return NextResponse.json({ pod }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
