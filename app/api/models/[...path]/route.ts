import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = {
  params: {
    path: string[];
  };
};

async function proxyModelsRequest(req: NextRequest, context: RouteContext) {
  const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_SERVER_URL is required" },
      { status: 500 }
    );
  }

  const token =
    cookies().get("payload-token")?.value ||
    cookies().get("auth-token")?.value;

  const forwardedPath = context.params.path
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const targetUrl = new URL(`/models/${forwardedPath}`, backendUrl);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers({
    Accept: req.headers.get("accept") || "application/json",
  });
  const contentType = req.headers.get("content-type");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (token) {
    headers.set("Authorization", `JWT ${token}`);
    headers.set("Cookie", `payload-token=${token}; auth-token=${token}`);
  }

  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.text();
  }

  const response = await fetch(targetUrl, init);
  const body = await response.text();
  const responseContentType =
    response.headers.get("content-type") || "application/json";

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": responseContentType,
    },
  });
}

export function GET(req: NextRequest, context: RouteContext) {
  return proxyModelsRequest(req, context);
}

export function POST(req: NextRequest, context: RouteContext) {
  return proxyModelsRequest(req, context);
}
