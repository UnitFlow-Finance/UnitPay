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
    const { userToken, refreshToken, deviceId } = await request.json();
    if (!userToken || !refreshToken || !deviceId) {
      return NextResponse.json(
        { error: "Missing required field(s): userToken, refreshToken, deviceId" },
        { status: 400 },
      );
    }

    const response = await circleClient.refreshUserToken({
      userToken: String(userToken),
      refreshToken: String(refreshToken),
      deviceId: String(deviceId),
    });
    const data = response.data;
    if (!data?.userToken || !data.encryptionKey) {
      return NextResponse.json(
        { error: "Circle did not return a refreshed social login session." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      userToken: data.userToken,
      encryptionKey: data.encryptionKey,
      refreshToken: data.refreshToken ?? refreshToken,
    });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
