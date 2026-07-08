import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createMockGenerationSubmission,
  isMockAuthEnabled,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";
import {
  getReferenceDebugTraceId,
  logReferenceDebug,
  summarizeReferenceDebugBody,
} from "@/app/api/_utils/referenceDebug";

type RouteContext = {
  params: {
    path: string[];
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
  const traceId = getReferenceDebugTraceId(req);

  if (isMockAuthEnabled()) {
    const body = await req.json().catch(() => ({}));

    return NextResponse.json(
      createMockGenerationSubmission(
        body && typeof body === "object" ? (body as Record<string, unknown>) : {}
      )
    );
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
  const targetUrl = new URL(`/generate/${forwardedPath}`, backendUrl);
  targetUrl.search = req.nextUrl.search;

  let response: Response;
  const bodyText = await req.text();
  logReferenceDebug(
    "api/generate",
    traceId,
    summarizeReferenceDebugBody(bodyText),
    {
      path: `/generate/${forwardedPath}`,
      targetHost: targetUrl.host,
      headerReferenceImageCount: req.headers.get("x-reference-image-count"),
    }
  );

  try {
    response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        Authorization: `JWT ${token}`,
        Cookie: `payload-token=${token}; auth-token=${token}`,
        "Content-Type": req.headers.get("content-type") || "application/json",
        Accept: req.headers.get("accept") || "application/json",
        "X-Reference-Debug-Id": traceId,
        "X-Reference-Image-Count": req.headers.get("x-reference-image-count") || "",
      },
      body: bodyText,
      cache: "no-store",
    });
  } catch (error) {
    console.error("[api/generate] backend proxy failed", error);
    return NextResponse.json(
      { error: "Backend proxy failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }

  const body = await response.text();
  const contentType = response.headers.get("content-type") || "application/json";

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
