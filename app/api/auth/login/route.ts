import { NextRequest, NextResponse } from "next/server";

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

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/auth/password-login`,
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

    if (!response.ok || !data?.token || !data?.user) {
      return NextResponse.json(
        {
          error:
            data?.errors?.[0]?.message ||
            data?.error ||
            data?.message ||
            "Login failed",
        },
        { status: response.status || 500 }
      );
    }

    const result = NextResponse.json({ user: data.user });
    const cookieOptions = getCookieOptions(data.exp);

    result.cookies.set("payload-token", data.token, cookieOptions);
    result.cookies.set("auth-token", data.token, cookieOptions);

    return result;
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
