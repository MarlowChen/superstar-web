import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "payload-token";

function buildCookieOptions(exp?: number) {
  const maxAge = exp ? Math.max(exp - Math.floor(Date.now() / 1000), 0) : undefined;

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
    const { email, password, confirmPassword, name, username } =
      await req.json();

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Email, password and confirmPassword are required" },
        { status: 400 }
      );
    }

    const registerResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/auth/register`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          confirmPassword,
          name: name || undefined,
          username: username || undefined,
        }),
      }
    );

    const registerData = await registerResponse.json().catch(() => null);

    if (!registerResponse.ok) {
      return NextResponse.json(
        {
          error:
            registerData?.errors?.[0]?.message ||
            registerData?.error ||
            registerData?.message ||
            "Register failed",
        },
        { status: registerResponse.status || 500 }
      );
    }

    if (!registerData?.token || !registerData?.user) {
      return NextResponse.json(
        {
          error:
            registerData?.errors?.[0]?.message ||
            registerData?.error ||
            registerData?.message ||
            "Register succeeded but login failed",
        },
        { status: registerResponse.status || 500 }
      );
    }

    const result = NextResponse.json({ user: registerData.user });
    result.cookies.set(COOKIE_NAME, registerData.token, buildCookieOptions(registerData.exp));
    result.cookies.set("auth-token", registerData.token, buildCookieOptions(registerData.exp));

    return result;
  } catch (error) {
    console.error("Register route error:", error);
    return NextResponse.json({ error: "Register failed" }, { status: 500 });
  }
}
