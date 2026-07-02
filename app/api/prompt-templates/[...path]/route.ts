import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = {
  params: {
    path: string[];
  };
};

async function proxyPromptTemplateRequest(
  req: NextRequest,
  context: RouteContext,
  method: "GET" | "POST"
) {
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
  const targetUrl = new URL(`/prompt-templates/${forwardedPath}`, backendUrl);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers({
    Accept: req.headers.get("accept") || "application/json",
  });

  if (method === "POST") {
    headers.set("Content-Type", req.headers.get("content-type") || "application/json");
  }

  if (token) {
    headers.set("Authorization", `JWT ${token}`);
    headers.set("Cookie", `payload-token=${token}; auth-token=${token}`);
  }

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: method === "POST" ? await req.text() : undefined,
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

export function GET(req: NextRequest, context: RouteContext) {
  return proxyPromptTemplateRequest(req, context, "GET");
}

export function POST(req: NextRequest, context: RouteContext) {
  return proxyPromptTemplateRequest(req, context, "POST");
}
