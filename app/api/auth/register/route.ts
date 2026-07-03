import { NextRequest, NextResponse } from "next/server";
import { extractAuthPayload, extractErrorMessage, getBackendUrl } from "../utils";
import {
  getMockUser,
  isMockAuthEnabled,
  MOCK_AUTH_TOKEN,
} from "@/app/lib/mockAuth";

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

async function loginAfterRegister(args: {
  backendUrl: string;
  email: string;
  password: string;
}) {
  const loginResponse = await fetch(`${args.backendUrl}/auth/password-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: args.email,
      password: args.password,
    }),
  });

  const loginData = await loginResponse.json().catch(() => null);
  return {
    ok: loginResponse.ok,
    status: loginResponse.status,
    data: loginData,
    payload: extractAuthPayload(loginData),
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

    if (isMockAuthEnabled()) {
      const result = NextResponse.json({
        user: {
          ...getMockUser(email),
          name: name || getMockUser(email).name,
          username: username || getMockUser(email).username,
        },
      });
      const cookieOptions = buildCookieOptions();

      result.cookies.set(COOKIE_NAME, MOCK_AUTH_TOKEN, cookieOptions);
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

    const registerResponse = await fetch(
      `${backendUrl}/auth/register`,
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
          error: extractErrorMessage(registerData, "Register failed"),
        },
        { status: registerResponse.status || 500 }
      );
    }

    let authPayload = extractAuthPayload(registerData);

    if (!authPayload.token || !authPayload.user) {
      const loginResult = await loginAfterRegister({
        backendUrl,
        email,
        password,
      });

      if (loginResult.ok && loginResult.payload.token && loginResult.payload.user) {
        authPayload = loginResult.payload;
      } else {
        return NextResponse.json(
          {
            error: extractErrorMessage(
              loginResult.data,
              "Register succeeded but login failed"
            ),
          },
          { status: loginResult.status || 500 }
        );
      }
    }

    if (!authPayload.token || !authPayload.user) {
      return NextResponse.json(
        {
          error: extractErrorMessage(registerData, "Register succeeded but login failed"),
        },
        { status: registerResponse.status || 500 }
      );
    }

    const result = NextResponse.json({ user: authPayload.user });
    const cookieOptions = buildCookieOptions(authPayload.exp);
    result.cookies.set(COOKIE_NAME, authPayload.token, cookieOptions);
    result.cookies.set("auth-token", authPayload.token, cookieOptions);

    return result;
  } catch (error) {
    console.error("Register route error:", error);
    return NextResponse.json({ error: "Register failed" }, { status: 500 });
  }
}
