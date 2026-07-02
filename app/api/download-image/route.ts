import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = new Set([
  "tempfile.aiquickdraw.com",
  "aierone.nyc3.cdn.digitaloceanspaces.com",
  "aierone.nyc3.digitaloceanspaces.com",
  "nyc3.digitaloceanspaces.com",
  "api.superstar-ai.xyz",
  "superstar-ai.xyz",
  "aierone-api-3ewyr5bvoa-de.a.run.app",
  "aierone-73arn5nlpa-uc.a.run.app",
]);

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") || "";
  let sourceUrl: URL;

  try {
    sourceUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (sourceUrl.protocol !== "https:" || !ALLOWED_HOSTS.has(sourceUrl.hostname)) {
    return NextResponse.json({ error: "unsupported image host" }, { status: 400 });
  }

  const response = await fetch(sourceUrl.toString(), {
    cache: "no-store",
    headers: {
      Accept: "image/*,application/octet-stream,*/*",
    },
  });

  if (!response.ok || !response.body) {
    return NextResponse.json(
      { error: "failed to fetch image" },
      { status: response.status || 502 }
    );
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "content-type": response.headers.get("content-type") || "application/octet-stream",
      "content-disposition": "attachment",
      "cache-control": "no-store",
    },
  });
}
