import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = {
  params: {
    path: string[];
  };
};

async function proxyUserRequest(req: NextRequest, context: RouteContext) {
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

  const forwardedPath = context.params.path
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const targetUrl = new URL(`/user/${forwardedPath}`, backendUrl);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  if (accept) {
    headers.set("Accept", accept);
  }

  headers.set("Authorization", `JWT ${token}`);
  headers.set("Cookie", `payload-token=${token}; auth-token=${token}`);

  const method = req.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    cache: "no-store",
  };

  if (method !== "GET" && method !== "HEAD") {
    init.body = await req.arrayBuffer();
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
  return proxyUserRequest(req, context);
}

export function POST(req: NextRequest, context: RouteContext) {
  return proxyUserRequest(req, context);
}

export function PUT(req: NextRequest, context: RouteContext) {
  return proxyUserRequest(req, context);
}

export function PATCH(req: NextRequest, context: RouteContext) {
  return proxyUserRequest(req, context);
}

export function DELETE(req: NextRequest, context: RouteContext) {
  return proxyUserRequest(req, context);
}
