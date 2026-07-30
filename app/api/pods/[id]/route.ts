import { NextResponse } from "next/server";
import { getPod, updatePodStatus } from "@/lib/pods/store";
import type { EscrowPodStatus } from "@/lib/pods/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const pod = await getPod(id);
  return NextResponse.json({ pod }, { status: pod ? 200 : 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { status } = await request.json();
    if (!["Open", "Completed", "Closed", "Pending approval"].includes(status)) {
      return NextResponse.json({ error: "Invalid pod status" }, { status: 400 });
    }
    const pod = await updatePodStatus(id, status as EscrowPodStatus);
    return NextResponse.json({ pod }, { status: pod ? 200 : 404 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
