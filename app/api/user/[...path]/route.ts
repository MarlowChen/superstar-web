import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  getMockUserImages,
  getMockUser,
  isMockAuthEnabled,
  pickUsableAuthToken,
  MOCK_USER_POINT,
  MOCK_USER_SETTINGS,
} from "@/app/lib/mockAuth";

type RouteContext = {
  params: {
    path: string[];
  };
};

async function proxyUserRequest(req: NextRequest, context: RouteContext) {
  if (isMockAuthEnabled()) {
    const [resource, pageSegment, limitSegment] = context.params.path;

    if (resource === "point") {
      return NextResponse.json(MOCK_USER_POINT);
    }

    if (resource === "settings") {
      return NextResponse.json(MOCK_USER_SETTINGS);
    }

    if (resource === "profile") {
      return NextResponse.json({ user: getMockUser() });
    }

    if (resource === "images") {
      const page = Number(pageSegment) || 1;
      const limit = Number(limitSegment) || 10;

      return NextResponse.json(getMockUserImages(page, limit));
    }

    return NextResponse.json({});
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
