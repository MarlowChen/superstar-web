import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const token =
    cookies().get("payload-token")?.value ||
    cookies().get("auth-token")?.value;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SERVER_URL is required" },
      { status: 500 }
    );
  }

  const upstreamUrl = new URL("/chat/conversations", backendUrl);
  const requestUrl = new URL(request.url);
  requestUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const response = await fetch(upstreamUrl, {
    method: "GET",
    headers: {
      Authorization: `JWT ${token}`,
      Cookie: `payload-token=${token}; auth-token=${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const body = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
