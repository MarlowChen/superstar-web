import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { extractErrorMessage, extractUser, getBackendUrl } from "../utils";
import {
  getMockUser,
  isMockAuthToken,
  isMockAuthEnabled,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";

function clearStaleAuthCookies(response: NextResponse) {
  response.cookies.set("payload-token", "", { path: "/", maxAge: 0 });
  response.cookies.set("auth-token", "", { path: "/", maxAge: 0 });
  return response;
}

export async function GET() {
  if (isMockAuthEnabled()) {
    return NextResponse.json({ user: getMockUser() });
  }

  const cookieStore = cookies();
  const payloadToken = cookieStore.get("payload-token")?.value;
  const authToken = cookieStore.get("auth-token")?.value;
  const token = pickUsableAuthToken(payloadToken, authToken);

  if (!token) {
    const response = NextResponse.json({ user: null }, { status: 200 });

    return isMockAuthToken(payloadToken) || isMockAuthToken(authToken)
      ? clearStaleAuthCookies(response)
      : response;
  }

  const backendUrl = getBackendUrl();
  if (!backendUrl) {
    return NextResponse.json(
      { user: null, error: "NEXT_PUBLIC_SERVER_URL is required" },
      { status: 500 }
    );
  }

  try {
    const response = await fetch(
      `${backendUrl}/auth/me`,
      {
        headers: {
          Authorization: `JWT ${token}`,
          Cookie: `payload-token=${token}; auth-token=${token}`,
        },
      }
    );

    const data = await response.json().catch(() => null);
    const user = extractUser(data);

    if (!response.ok || !user) {
      const status = response.status || 401;
      const authStatusResponse = NextResponse.json(
        {
          user: null,
          error: extractErrorMessage(data, "Unauthenticated"),
        },
        { status: status === 401 ? 200 : status }
      );

      return status === 401
        ? clearStaleAuthCookies(authStatusResponse)
        : authStatusResponse;
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Auth me route error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
