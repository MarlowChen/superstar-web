import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isMockAuthEnabled,
  MOCK_TEMPLATES,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";

export async function GET(req: NextRequest) {
  if (isMockAuthEnabled()) {
    const category = req.nextUrl.searchParams.get("category");
    const docs = MOCK_TEMPLATES.filter((template) =>
      category ? template.category === category : true
    );

    return NextResponse.json({
      docs,
      totalDocs: docs.length,
      totalPages: 1,
    });
  }

  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SERVER_URL is required" },
      { status: 500 }
    );
  }

  const cookieStore = cookies();
  const token = pickUsableAuthToken(
    cookieStore.get("payload-token")?.value,
    cookieStore.get("auth-token")?.value
  );
  const targetUrl = new URL("/templates", backendUrl);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers({
    Accept: req.headers.get("accept") || "application/json",
  });

  if (token) {
    headers.set("Authorization", `JWT ${token}`);
    headers.set("Cookie", `payload-token=${token}; auth-token=${token}`);
  }

  const response = await fetch(targetUrl, {
    method: "GET",
    headers,
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
