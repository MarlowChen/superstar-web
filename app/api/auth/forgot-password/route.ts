import { NextRequest, NextResponse } from "next/server";
import { extractErrorMessage, getBackendUrl } from "../utils";
import { isMockAuthEnabled } from "@/app/lib/mockAuth";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
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

    const response = await fetch(`${backendUrl}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { error: extractErrorMessage(data, "Forgot password failed") },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json(data || { message: "Reset email sent" });
  } catch (error) {
    console.error("Forgot password route error:", error);
    return NextResponse.json(
      { error: "Forgot password failed" },
      { status: 500 }
    );
  }
}
