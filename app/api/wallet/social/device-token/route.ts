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
    const { deviceId } = await request.json();
    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    const response = await circleClient.createDeviceTokenForSocialLogin({
      deviceId: String(deviceId),
    });
    const data = response.data;
    if (!data?.deviceToken || !data.deviceEncryptionKey) {
      return NextResponse.json(
        { error: "Circle did not return a social login device token." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      deviceToken: data.deviceToken,
      deviceEncryptionKey: data.deviceEncryptionKey,
    });
  } catch (error) {
    return circleErrorResponse(error);
  }
}
