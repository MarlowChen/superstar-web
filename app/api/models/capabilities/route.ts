import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isMockAuthEnabled,
  MOCK_MODEL_CAPABILITIES,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";

export async function GET(req: NextRequest) {
  if (isMockAuthEnabled()) {
    return NextResponse.json(MOCK_MODEL_CAPABILITIES);
  }

  const cookieStore = cookies();
  const token = pickUsableAuthToken(
    cookieStore.get("payload-token")?.value,
    cookieStore.get("auth-token")?.value
  );

  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SERVER_URL is required" },
      { status: 500 }
    );
  }

  const targetUrl = new URL("/models/capabilities", backendUrl);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers({ Accept: "application/json" });
  if (token) {
    headers.set("Authorization", `JWT ${token}`);
    headers.set("Cookie", `payload-token=${token}; auth-token=${token}`);
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("[api/models/capabilities] backend proxy failed", error);
    return NextResponse.json(
      {
        error: "Backend proxy failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 }
    );
  }
}
