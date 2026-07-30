import { NextResponse } from "next/server";
import { importPods } from "@/lib/pods/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body?.pods)) {
      return NextResponse.json({ error: "Missing pods array" }, { status: 400 });
    }
    const pods = await importPods({
      pods: body.pods,
      contributions: Array.isArray(body.contributions) ? body.contributions : [],
    });
    return NextResponse.json({ pods }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
