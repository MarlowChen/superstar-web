import { NextRequest, NextResponse } from "next/server";
import { extractAuthPayload, extractErrorMessage, getBackendUrl } from "../utils";
import {
  getMockUser,
  isMockAuthEnabled,
  MOCK_AUTH_TOKEN,
} from "@/app/lib/mockAuth";

function getCookieOptions(exp?: number) {
  const now = Math.floor(Date.now() / 1000);
  const maxAge = exp ? Math.max(exp - now, 0) : undefined;

  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(maxAge ? { maxAge } : {}),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { email, password, callbackUrl } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (isMockAuthEnabled()) {
      const result = NextResponse.json({ user: getMockUser(email) });
      const cookieOptions = getCookieOptions();

      result.cookies.set("payload-token", MOCK_AUTH_TOKEN, cookieOptions);
      result.cookies.set("auth-token", MOCK_AUTH_TOKEN, cookieOptions);

      return result;
    }

    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SERVER_URL is required" },
        { status: 500 }
      );
    }

    const response = await fetch(
      `${backendUrl}/auth/password-login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password, callbackUrl }),
      }
    );

    const data = await response.json().catch(() => null);

    if (response.status === 503) {
      return NextResponse.json(
        { error: "Backend unavailable", backendStatus: 503 },
        { status: 503 }
      );
    }

    const authPayload = extractAuthPayload(data);

    if (!response.ok || !authPayload.token || !authPayload.user) {
      return NextResponse.json(
        {
          error: extractErrorMessage(data, "Login failed"),
        },
        { status: response.status || 500 }
      );
    }

    const result = NextResponse.json({ user: authPayload.user });
    const cookieOptions = getCookieOptions(authPayload.exp);

    result.cookies.set("payload-token", authPayload.token, cookieOptions);
    result.cookies.set("auth-token", authPayload.token, cookieOptions);

    return result;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
