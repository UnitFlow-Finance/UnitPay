import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

/** Polls a single transaction's status by id. */
export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken, id } = await request.json();
    if (!userToken || !id) {
      return NextResponse.json({ error: "Missing userToken or id" }, { status: 400 });
    }

    const response = await circleClient.getTransaction({ userToken, id });
    return NextResponse.json({ transaction: response.data?.transaction });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
