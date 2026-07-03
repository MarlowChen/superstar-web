import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pickUsableAuthToken } from "@/app/lib/mockAuth";

export async function GET(req: NextRequest) {
  const cookieStore = cookies();
  const token = pickUsableAuthToken(
    cookieStore.get("payload-token")?.value,
    cookieStore.get("auth-token")?.value
  );

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

  const targetUrl = new URL("/chat-sse/stream", backendUrl);
  targetUrl.search = req.nextUrl.search;

  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      Authorization: `JWT ${token}`,
      Cookie: `payload-token=${token}; auth-token=${token}`,
      Accept: "text/event-stream",
    },
    cache: "no-store",
    signal: req.signal,
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
