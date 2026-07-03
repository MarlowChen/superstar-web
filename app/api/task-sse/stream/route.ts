import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createMockGenerationTask,
  isMockAuthEnabled,
  pickUsableAuthToken,
} from "@/app/lib/mockAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (isMockAuthEnabled()) {
    const taskId = req.nextUrl.searchParams.get("taskId") || "mock-image-1-local";
    const task = createMockGenerationTask(taskId);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const enqueue = (event: string, data: unknown, id: string) => {
          controller.enqueue(
            encoder.encode(
              `id: ${id}\nevent: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        };

        enqueue("connected", { taskId }, `${taskId}-connected`);
        enqueue(
          "generation.progress",
          {
            taskId,
            phase: "completed",
            status: "completed",
            expectedCount: task.expectedCount,
            resultCount: task.resultCount,
            progressPercent: 100,
          },
          `${taskId}-progress`
        );
        enqueue("task_finished", task, `${taskId}-finished`);
        controller.close();
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
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

  const targetUrl = new URL("/task-sse/stream", backendUrl);
  targetUrl.search = req.nextUrl.search;

  const response = await fetch(targetUrl, {
    method: "GET",
    headers: {
      Authorization: `JWT ${token}`,
      Cookie: `payload-token=${token}; auth-token=${token}`,
      Accept: "text/event-stream",
    },
    cache: "no-store",
    signal: req.signal,
  });

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
