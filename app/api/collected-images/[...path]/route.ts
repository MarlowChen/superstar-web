import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getMockCollectedImages,
  isMockAuthEnabled,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(req: NextRequest, context: RouteContext) {
  if (isMockAuthEnabled()) {
    const [, pageSegment, limitSegment] = context.params.path;
    const page = Number(pageSegment) || 1;
    const limit = Number(limitSegment) || 20;

    return NextResponse.json(getMockCollectedImages(page, limit));
  }

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

  const forwardedPath = context.params.path
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const targetUrl = new URL(`/collected-images/${forwardedPath}`, backendUrl);
  targetUrl.search = req.nextUrl.search;

  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      Authorization: `JWT ${token}`,
      Cookie: `payload-token=${token}; auth-token=${token}`,
      Accept: req.headers.get("accept") || "application/json",
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
