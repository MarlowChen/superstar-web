import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const token =
    cookies().get("payload-token")?.value ||
    cookies().get("auth-token")?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/auth/me`,
      {
        headers: {
          Authorization: `JWT ${token}`,
          Cookie: `payload-token=${token}; auth-token=${token}`,
        },
      }
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.user) {
      return NextResponse.json(
        {
          user: null,
          error: data?.errors?.[0]?.message || data?.error || data?.message,
        },
        { status: response.status || 401 }
      );
    }

    return NextResponse.json({ user: data.user });
  } catch (error) {
    console.error("Auth me route error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
