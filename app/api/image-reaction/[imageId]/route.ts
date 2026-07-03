import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pickUsableAuthToken } from "@/app/lib/mockAuth";

type RouteContext = {
  params: {
    imageId: string;
  };
};

export async function POST(req: NextRequest, context: RouteContext) {
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

  const targetUrl = new URL(
    `/image/${encodeURIComponent(context.params.imageId)}/reaction`,
    backendUrl
  );

  const response = await fetch(targetUrl, {
    method: "POST",
    headers: {
      Authorization: `JWT ${token}`,
      Cookie: `payload-token=${token}; auth-token=${token}`,
      "Content-Type": req.headers.get("content-type") || "application/json",
      Accept: req.headers.get("accept") || "application/json",
    },
    body: await req.text(),
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
