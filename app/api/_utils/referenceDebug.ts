import { NextRequest } from "next/server";

type ReferenceDebugSummary = {
  imagesCount: number;
  referenceImageUrlsCount: number;
  firstFrameUrlPresent: boolean;
  lastFrameUrlPresent: boolean;
  references: Array<{
    index: number;
    source: "images" | "referenceImageUrls" | "firstFrameUrl" | "lastFrameUrl";
    host: string;
    tail: string;
  }>;
  bodyKeys: string[];
  modelId?: string;
  modelHint?: string;
  type?: string;
  uuid?: string;
  conversationId?: string;
};

const summarizeUrl = (value: unknown) => {
  if (typeof value !== "string" || value.trim() === "") return null;

  try {
    const parsed = new URL(value);
    const parts = parsed.pathname.split("/").filter(Boolean);
    return {
      host: parsed.host,
      tail: parts.slice(-2).join("/"),
    };
  } catch {
    const cleanValue = value.split("?")[0];
    const parts = cleanValue.split("/").filter(Boolean);
    return {
      host: value.startsWith("data:") ? "data-url" : "relative-or-opaque",
      tail: parts.slice(-2).join("/").slice(-96),
    };
  }
};

const pushSummaries = (
  references: ReferenceDebugSummary["references"],
  source: ReferenceDebugSummary["references"][number]["source"],
  values: unknown[]
) => {
  values.forEach((value) => {
    const summary = summarizeUrl(value);
    if (!summary) return;

    references.push({
      index: references.length,
      source,
      ...summary,
    });
  });
};

export const getReferenceDebugTraceId = (req: NextRequest) =>
  req.headers.get("x-reference-debug-id") ||
  req.headers.get("x-request-id") ||
  "missing-trace-id";

export const summarizeReferenceDebugBody = (
  bodyText: string
): ReferenceDebugSummary | null => {
  if (!bodyText) return null;

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return null;
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return null;
  }

  const record = body as Record<string, unknown>;
  const images = Array.isArray(record.images) ? record.images : [];
  const referenceImageUrls = Array.isArray(record.referenceImageUrls)
    ? record.referenceImageUrls
    : [];
  const references: ReferenceDebugSummary["references"] = [];

  pushSummaries(references, "images", images);
  pushSummaries(references, "referenceImageUrls", referenceImageUrls);
  pushSummaries(references, "firstFrameUrl", [record.firstFrameUrl]);
  pushSummaries(references, "lastFrameUrl", [record.lastFrameUrl]);

  return {
    imagesCount: images.filter((item) => typeof item === "string" && item).length,
    referenceImageUrlsCount: referenceImageUrls.filter(
      (item) => typeof item === "string" && item
    ).length,
    firstFrameUrlPresent:
      typeof record.firstFrameUrl === "string" && record.firstFrameUrl.length > 0,
    lastFrameUrlPresent:
      typeof record.lastFrameUrl === "string" && record.lastFrameUrl.length > 0,
    references,
    bodyKeys: Object.keys(record).sort(),
    modelId: typeof record.modelId === "string" ? record.modelId : undefined,
    modelHint: typeof record.modelHint === "string" ? record.modelHint : undefined,
    type: typeof record.type === "string" ? record.type : undefined,
    uuid: typeof record.uuid === "string" ? record.uuid : undefined,
    conversationId:
      typeof record.conversationId === "string" ? record.conversationId : undefined,
  };
};

export const logReferenceDebug = (
  scope: string,
  traceId: string,
  summary: ReferenceDebugSummary | null,
  extra: Record<string, unknown> = {}
) => {
  console.info(`[${scope}] reference-debug`, {
    traceId,
    ...extra,
    ...summary,
  });
};
