import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isMockAuthEnabled, pickUsableAuthToken } from "@/app/lib/mockAuth";

export async function POST(req: NextRequest) {
  if (isMockAuthEnabled()) {
    const body = await req.json().catch(() => ({}));
    const message =
      body && typeof body === "object" && typeof body.message === "string"
        ? body.message
        : "";
    const payload = {
      ok: true,
      type: "chat",
      conversationId: "mock-conversation-local",
      message: {
        role: "ASSISTANT",
        content: message
          ? `這是本機 mock 回覆：已收到「${message}」。`
          : "這是本機 mock 回覆，可用來檢查聊天 UI。",
      },
    };

    if ((req.headers.get("accept") || "").includes("text/event-stream")) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `event: progress\ndata: ${JSON.stringify({
                phase: "mock_processing",
                label: "本機 mock 正在回覆",
                progressPercent: 70,
              })}\n\n`
            )
          );
          controller.enqueue(
            encoder.encode(`event: final\ndata: ${JSON.stringify(payload)}\n\n`)
          );
          controller.close();
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          connection: "keep-alive",
        },
      });
    }

    return NextResponse.json(payload);
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

  const targetUrl = new URL("/chat/create", backendUrl);
  targetUrl.search = req.nextUrl.search;

  let response: Response;
  try {
    response = await fetch(targetUrl, {
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
  } catch (error) {
    console.error("[api/chat/create] backend proxy failed", error);
    return NextResponse.json(
      { error: "Backend proxy failed", detail: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }

  const contentType = response.headers.get("content-type") || "application/json";
  if (contentType.includes("text/event-stream")) {
    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        "content-type": contentType,
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  }

  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}
