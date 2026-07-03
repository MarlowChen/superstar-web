import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  isMockAuthEnabled,
  MOCK_TEMPLATES,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function GET(req: NextRequest, context: RouteContext) {
  if (isMockAuthEnabled()) {
    const slug = context.params.path[0];
    const template = MOCK_TEMPLATES.find((item) => item.slug === slug);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json(template);
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
  const forwardedPath = context.params.path
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const targetUrl = new URL(`/templates/${forwardedPath}`, backendUrl);
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
