import { NextRequest, NextResponse } from "next/server";
import { extractErrorMessage, getBackendUrl } from "../utils";
import { isMockAuthEnabled } from "@/app/lib/mockAuth";

export async function POST(req: NextRequest) {
  try {
    const { token, password, confirmPassword } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Invalid reset token", code: "INVALID_RESET_TOKEN" },
        { status: 400 }
      );
    }

    if (
      typeof password !== "string" ||
      typeof confirmPassword !== "string" ||
      password.length < 8
    ) {
      return NextResponse.json(
        { error: "Weak password", code: "WEAK_PASSWORD" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Password mismatch", code: "PASSWORD_MISMATCH" },
        { status: 400 }
      );
    }

    if (isMockAuthEnabled()) {
      return NextResponse.json({});
    }

    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_SERVER_URL is required" },
        { status: 500 }
      );
    }

    const response = await fetch(`${backendUrl}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirmPassword }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const fallback = "Reset password failed";
      return NextResponse.json(
        {
          error: extractErrorMessage(data, fallback),
          code:
            typeof data?.code === "string"
              ? data.code
              : undefined,
        },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(data || { message: "Password reset" });
  } catch (error) {
    console.error("Reset password route error:", error);
    return NextResponse.json(
      { error: "Reset password failed" },
      { status: 500 }
    );
  }
}
