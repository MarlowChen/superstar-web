import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pickUsableAuthToken } from "@/app/lib/mockAuth";

type RouteContext = {
  params: {
    path: string[];
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryMediaResponse = (status: number) =>
  status === 401 ||
  status === 403 ||
  status === 404 ||
  status === 409 ||
  status === 425 ||
  status === 429 ||
  status === 502 ||
  status === 503 ||
  status === 504;

const copyHeader = (target: Headers, source: Headers, name: string) => {
  const value = source.get(name);
  if (value) target.set(name, value);
};

export async function GET(req: NextRequest, context: RouteContext) {
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
  const targetUrl = new URL(`/media/${forwardedPath}`, backendUrl);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers({
    Accept: req.headers.get("accept") || "*/*",
  });
  const range = req.headers.get("range");
  if (range) headers.set("Range", range);

  if (token) {
    headers.set("Authorization", `JWT ${token}`);
    headers.set("Cookie", `payload-token=${token}; auth-token=${token}`);
  }

  let response: Response | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      response = await fetch(targetUrl, {
        method: "GET",
        headers,
        cache: "no-store",
      });
    } catch (error) {
      console.error("[media] backend proxy failed", error);
      response = null;
      if (attempt === 3) break;
      await sleep(300 + attempt * 450);
      continue;
    }

    if (!shouldRetryMediaResponse(response.status) || attempt === 3) {
      break;
    }

    await response.body?.cancel().catch(() => undefined);
    await sleep(300 + attempt * 450);
  }

  if (!response) {
    return NextResponse.json(
      { error: "Media fetch failed", detail: "Backend media proxy failed" },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  copyHeader(responseHeaders, response.headers, "content-type");
  copyHeader(responseHeaders, response.headers, "content-length");
  copyHeader(responseHeaders, response.headers, "content-range");
  copyHeader(responseHeaders, response.headers, "accept-ranges");
  copyHeader(responseHeaders, response.headers, "etag");
  responseHeaders.set(
    "cache-control",
    response.headers.get("cache-control") || "private, no-store"
  );
  responseHeaders.set("vary", "Cookie, Range");

  if (!responseHeaders.has("content-type")) {
    responseHeaders.set("content-type", "application/octet-stream");
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}
