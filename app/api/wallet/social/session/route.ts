import { NextResponse } from "next/server";
import { circleClient, circleConfigured } from "@/lib/circle/client";
import { circleErrorResponse } from "@/lib/circle/apiError";

export async function POST(request: Request) {
  if (!circleConfigured) {
    return NextResponse.json(
      { error: "Circle API key not configured on server" },
      { status: 500 },
    );
  }

  try {
    const { userToken } = await request.json();
    if (!userToken) {
      return NextResponse.json({ error: "Missing userToken" }, { status: 400 });
    }

    const response = await circleClient.getUserStatus({ userToken: String(userToken) });
    const user = response.data;
    if (!user?.id) {
      return NextResponse.json(
        { error: "Circle did not return a user for this social login session." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      userId: user.id,
      pinStatus: user.pinStatus,
      status: user.status,
      securityQuestionStatus: user.securityQuestionStatus,
    });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
