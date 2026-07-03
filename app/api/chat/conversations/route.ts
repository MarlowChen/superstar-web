import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isMockAuthEnabled, pickUsableAuthToken } from "@/app/lib/mockAuth";

export async function GET() {
  if (isMockAuthEnabled()) {
    return NextResponse.json([
      {
        id: "mock-conversation-local",
        title: "本機測試對話",
        summary: "用來檢查側邊欄、聊天列表與刪除確認流程",
        updatedAt: new Date().toISOString(),
      },
    ]);
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

  const response = await fetch(new URL("/chat/conversations", backendUrl), {
    method: "GET",
    headers: {
      Authorization: `JWT ${token}`,
      Cookie: `payload-token=${token}; auth-token=${token}`,
      Accept: "application/json",
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
