"use client";
import {
  useState,
  useContext,
  FormEvent,
  JSX,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  GalleryContext,
  isLocalPlaceholderGroupId,
  mergeImageGroupCollections,
} from "./contexts/GalleryContext";
import { ImageData, ImageDataGroup, PromptFormProps, TaskStatus } from "./types";
import { showToast } from "./CustomToast";
import {
  X,
  Palette,
  Plus,
  AlertTriangle,
  Sparkles,
  MessageSquare,
  Image as ImageIcon,
  Video,
  Mic,
  RectangleHorizontal,
  GripVertical,
  FileAudio,
  ChevronDown,
} from "lucide-react";
import { LoraModel, Media } from "@/payload-types";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useLocale, useTranslations } from "next-intl";
import ObjectID from "bson-objectid";
import { useAuth } from "@/app/context/AuthContext";
import { ImageCompressor } from "@/app/utils/imageCompression";
import Image from "next/image";

type CapabilityParamOption = {
  value: string;
  label: string;
};

type CapabilityParam = {
  key: string;
  label: string;
  type:
    | "text"
    | "number"
    | "select"
    | "boolean"
    | "image_upload"
    | "audio_upload"
    | "video_upload"
    | "json";
  required?: boolean;
  default?: string | number | boolean | null;
  placeholder?: string;
  omitWhenEmpty?: boolean;
  autoBehavior?: string;
  min?: number;
  max?: number;
  group?: string;
  options?: CapabilityParamOption[];
};

type CapabilityModel = {
  id: string;
  modelId: string;
  source: "local" | "kie" | "piapi" | "google" | "atlas" | "horizon" | "siray";
  displayId?: string;
  displayTitle?: string;
  providerHidden?: boolean;
  providerRoutingNote?: string;
  label: string;
  description?: string | null;
  workflow?: string | null;
  kind: GenerateType;
  supports?: {
    textToImage?: boolean;
    imageToImage?: boolean;
    textToVideo?: boolean;
    imageToVideo?: boolean;
    textToAudio?: boolean;
  };
  inputs: {
    text?: boolean;
    images?: boolean;
    audio?: boolean;
    video?: boolean;
  };
  limits?: {
    maxReferenceImages?: number;
    imageToImageAllowsSizeSelection?: boolean;
    minReferenceVideoSeconds?: number;
    maxReferenceVideoSeconds?: number;
  };
  params: CapabilityParam[];
  submit: {
    endpoint?: string;
    method?: "POST";
    type: GenerateType | "chat";
    modelId: string;
  };
  requestRules?: {
    sendOnlyKeysFromParams?: boolean;
    omitEmptyOptionalParams?: boolean;
    hiddenParams?: string[];
    modes?: Array<{
      id?: string;
      key?: string;
      mode?: string;
      name?: string;
      send?: string[];
    }>;
  };
  note?: string | null;
  cover?: unknown;
};

type TaskDiscardPayload = {
  _id?: string;
  id?: string;
  taskId?: string;
  discardRecommended?: boolean;
  terminalAction?: string;
  failureCode?: string;
  failureMessage?: string;
  message?: string;
  error?: string;
  failure?: {
    code?: string;
    message?: string;
  };
};

type TaskRuntimePayload = TaskDiscardPayload & {
  status?: string;
  kind?: string;
  type?: string;
  prompt?: string;
  url?: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  fileUrl?: string;
  mediaUrl?: string;
  outputUrl?: string;
  resultUrl?: string;
  src?: string;
  s3Url?: string;
  s3_url?: string;
  resultUrls?: Array<unknown>;
  outputs?: Array<unknown>;
  media?: unknown;
  video?: unknown;
  audio?: unknown;
  image?: unknown;
  file?: unknown;
  loraModel?: string | { id?: string; title?: string };
  conversationId?: string;
  projectId?: string;
  conversation?: string | {
    id?: string;
    _id?: string;
  };
  expectedCount?: number;
  count?: number;
  resultCount?: number;
  actualCount?: number;
  partialCompleteFinal?: boolean;
  partialCompleteReason?: string | null;
  settings?: Record<string, unknown> | null;
  publishedImages?: Array<unknown>;
  images?: Array<{
    file?: File;
    name?: string;
    url?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
};

type GenerationRequestSnapshot = NonNullable<ImageDataGroup["requestSnapshot"]>;

type GenerationProgressPayload = {
  event?: string;
  taskId?: string;
  conversationId?: string;
  kind?: GenerateType | "chat";
  modelId?: string;
  phase?: string;
  status?: string;
  label?: string;
  detail?: string;
  expectedCount?: number;
  resultCount?: number;
  progressPercent?: number;
  resultIndex?: number;
  resultUrl?: string;
  timestamp?: string;
  canRetry?: boolean;
  discardRecommended?: boolean;
};

const VIDEO_TIMEOUT_DISCARDED_CODE = "VIDEO_TIMEOUT_DISCARDED";

const resolveBackendSubmitEndpoint = (endpoint: string) => {
  const normalizePath = (pathname: string, search = "") => {
    if (pathname.startsWith("/api/generate/")) {
      return `${pathname}${search}`;
    }

    if (pathname === "/api/chat/create") {
      return `${pathname}${search}`;
    }

    if (pathname.startsWith("/api/backend/generate/")) {
      return `${pathname.replace("/api/backend/generate/", "/api/generate/")}${search}`;
    }

    if (pathname.startsWith("/api/backend/chat/")) {
      return `${pathname.replace("/api/backend/chat/", "/api/chat/")}${search}`;
    }

    return pathname.startsWith("/generate/") || pathname === "/chat/create"
      ? `/api${pathname}${search}`
      : `${pathname}${search}`;
  };

  if (/^https?:\/\//i.test(endpoint)) {
    const parsed = new URL(endpoint);
    return normalizePath(parsed.pathname, parsed.search);
  }

  return normalizePath(endpoint);
};

const normalizeMediaUrl = (url?: string) => {
  if (!url) return "";

  try {
    const parsed = new URL(url, typeof window === "undefined" ? "https://local.invalid" : window.location.origin);
    if (parsed.pathname.startsWith("/media/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Fall through to relative-path handling.
  }

  return url.startsWith("/media/") ? url : url;
};

const isTaskDiscardPayload = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const task = payload as TaskDiscardPayload;
  return (
    task.discardRecommended === true ||
    task.terminalAction === "discard" ||
    task.failureCode === VIDEO_TIMEOUT_DISCARDED_CODE ||
    task.failure?.code === VIDEO_TIMEOUT_DISCARDED_CODE
  );
};

const getTaskFailureMessage = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const task = payload as TaskDiscardPayload;
  return task.failureMessage || task.failure?.message || task.message || task.error || "";
};

const appendProgressTrail = (
  existing: ImageDataGroup["progressTrail"],
  event: GenerationProgressPayload
) => {
  const timestamp = event.timestamp || new Date().toISOString();
  const nextItem = {
    phase: event.phase,
    label: event.label,
    detail: event.detail,
    timestamp,
    progressPercent: event.progressPercent,
    resultCount: event.resultCount,
    expectedCount: event.expectedCount,
  };
  const previous = existing || [];
  const last = previous[previous.length - 1];

  if (
    last?.phase === nextItem.phase &&
    last?.label === nextItem.label &&
    last?.timestamp === nextItem.timestamp
  ) {
    return previous;
  }

  return [...previous, nextItem].slice(-8);
};

const buildParamsSummary = ({
  modelLabel,
  kind,
  body,
  referenceCount,
}: {
  modelLabel?: string;
  kind?: string;
  body: Record<string, unknown>;
  referenceCount?: number;
}) => {
  const parts = [
    modelLabel,
    typeof body.aspectRatio === "string" && body.aspectRatio ? body.aspectRatio : "",
    typeof body.duration === "number" || typeof body.duration === "string"
      ? `${body.duration}s`
      : "",
    typeof body.resolution === "string" && body.resolution ? body.resolution : "",
    kind === "image" && Number(body.count) > 0 ? `${Number(body.count)} 張` : "",
    referenceCount ? `參考圖 ${referenceCount}` : "",
    typeof body.generateAudio === "boolean"
      ? `生成音訊 ${body.generateAudio ? "ON" : "OFF"}`
      : "",
  ].filter(Boolean);

  return parts.join(" · ");
};

const getRuntimeTaskId = (task: unknown): string => {
  if (!task || typeof task !== "object") return "";
  const value = task as TaskRuntimePayload;
  return readHistoryString(value.id) ||
    readHistoryString(value._id) ||
    readHistoryString(value.taskId) ||
    "";
};

const getRuntimeTaskConversationId = (task: unknown): string => {
  if (!task || typeof task !== "object") return "";
  const value = task as TaskRuntimePayload;
  const conversation = value.conversation;
  const conversationRecord = asHistoryRecord(conversation);

  return (
    readHistoryString(value.conversationId) ||
    readHistoryString(value.projectId) ||
    readHistoryString(conversation) ||
    readHistoryString(conversationRecord?.id) ||
    readHistoryString(conversationRecord?._id) ||
    ""
  );
};

type CapabilityMedia = {
  kind: GenerateType;
  label: string;
  models: CapabilityModel[];
};

type CapabilityResponse = {
  version: string;
  submission: {
    endpoint: string;
    method: "POST";
    fields: Record<string, string>;
    note?: string;
  };
  media: CapabilityMedia[];
};

const normalizeCapabilityModelKey = (value?: string | null): string => {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";

  const withoutPrefix = raw
    .replace(/^text:/, "")
    .replace(/^kie:/, "")
    .replace(/^openai\//, "")
    .replace(/^google\//, "")
    .replace(/^anthropic\//, "")
    .replace(/^claude\//, "")
    .replace(/_/g, "-");

  if (
    withoutPrefix === "gpt-5.4" ||
    withoutPrefix === "gpt-5-4" ||
    withoutPrefix === "gpt54" ||
    withoutPrefix === "gpt-5-4-preview"
  ) {
    return "text:gpt-5-4";
  }

  if (
    withoutPrefix === "gemini-3.1-pro" ||
    withoutPrefix === "gemini-3-1-pro" ||
    withoutPrefix === "gemini-3.1-pro-preview" ||
    withoutPrefix === "gemini-3-pro-preview"
  ) {
    return "text:gemini-3.1-pro";
  }

  if (
    withoutPrefix === "claude-opus-4-6" ||
    withoutPrefix === "claude-opus-4.6" ||
    withoutPrefix === "opus-4-6" ||
    withoutPrefix === "opus-4.6"
  ) {
    return "text:claude-opus-4-6";
  }

  return raw;
};

const capabilityModelKeys = (
  model: Pick<CapabilityModel, "id" | "modelId" | "submit"> | null | undefined
): string[] =>
  [
    model?.id,
    model?.modelId,
    model?.submit?.modelId,
    normalizeCapabilityModelKey(model?.id),
    normalizeCapabilityModelKey(model?.modelId),
    normalizeCapabilityModelKey(model?.submit?.modelId),
  ].filter((value): value is string => Boolean(value));

function getCapabilityModelSortRank(model: CapabilityModel): number {
  const keys = capabilityModelKeys(model);
  if (keys.includes("seedance-2-fast")) return 0;
  if (keys.includes("seedance-2")) return 1;
  if (keys.includes("seedance15video")) return 50;
  return 10;
}

function getCapabilityParam(
  model: CapabilityModel | null | undefined,
  key: string
): CapabilityParam | undefined {
  return model?.params?.find((param) => param.key === key);
}

function getCapabilityParamByKeys(
  model: CapabilityModel | null | undefined,
  keys: string[]
): CapabilityParam | undefined {
  return model?.params?.find((param) => keys.includes(param.key));
}

function normalizeCapabilityOptions(
  param: CapabilityParam | null | undefined
): CapabilityParamOption[] {
  if (param?.type === "select" && param.default === null) {
    return [
      {
        value: "",
        label: "Auto",
      },
      ...(param.options || []),
    ];
  }

  if (param?.options?.length) {
    return param.options;
  }

  if (param?.default !== undefined && param.default !== null && param.default !== "") {
    const value = String(param.default);
    return [{ value, label: value }];
  }

  return [];
}

const isOneKResolutionOption = (option: CapabilityParamOption) => {
  const normalized = `${option.value} ${option.label}`.toLowerCase().replace(/\s+/g, "");
  return (
    normalized === "1k1k" ||
    normalized.includes("1k") ||
    normalized.includes("1024")
  );
};

const getSafeImageResolutionOptions = (
  options: CapabilityParamOption[]
): CapabilityParamOption[] => {
  const safeOptions = options.filter(isOneKResolutionOption);

  return safeOptions.length > 0 ? safeOptions.slice(0, 1) : [{ value: "1K", label: "1K" }];
};

const clampImageResolutionValue = (
  value: string,
  options: CapabilityParamOption[]
) => {
  const safeOptions = getSafeImageResolutionOptions(options);
  const matched = safeOptions.find((option) => option.value === value);

  return matched?.value || safeOptions[0]?.value || "1K";
};

function shouldSendCapabilityParam(
  param: CapabilityParam | null | undefined,
  value: unknown
) {
  if (!param) return false;
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (trimmedValue === "" && !param.required) {
      return false;
    }
  }

  return true;
}

const getCapabilityParamMax = (param: CapabilityParam | undefined) =>
  Math.max(0, Number(param?.max) || 0);

const getCapabilityParamsByType = (
  model: CapabilityModel | null | undefined,
  type: CapabilityParam["type"]
) => model?.params?.filter((param) => param.type === type) || [];

const pickCapabilityModeSendKeys = (
  model: CapabilityModel | null | undefined,
  values: Record<string, unknown>
) => {
  const modes = model?.requestRules?.modes || [];
  if (modes.length === 0) return null;

  const hasAnyValue = (keys: string[] = []) =>
    keys.some((key) => {
      const value = values[key];
      if (Array.isArray(value)) return value.length > 0;
      return value !== undefined && value !== null && value !== "";
    });

  const referenceMode = modes.find((mode) => {
    const send = mode.send || [];
    return send.includes("referenceImageUrls") || send.includes("referenceAudioUrls");
  });
  if (
    referenceMode?.send &&
    hasAnyValue(["referenceAudioUrls"])
  ) {
    return new Set(referenceMode.send);
  }

  const referenceImages = values.referenceImageUrls;
  if (
    referenceMode?.send &&
    Array.isArray(referenceImages) &&
    referenceImages.length > 2
  ) {
    return new Set(referenceMode.send);
  }

  const firstLastMode = modes.find((mode) => {
    const send = mode.send || [];
    return send.includes("firstFrameUrl") || send.includes("lastFrameUrl");
  });
  if (
    firstLastMode?.send &&
    hasAnyValue(["firstFrameUrl", "lastFrameUrl"])
  ) {
    return new Set(firstLastMode.send);
  }

  if (
    referenceMode?.send &&
    hasAnyValue(["referenceImageUrls", "referenceAudioUrls"])
  ) {
    return new Set(referenceMode.send);
  }

  const textMode = modes.find((mode) => {
    const modeId = String(mode.id || mode.key || mode.mode || mode.name || "").toLowerCase();
    return modeId === "text_to_video" || modeId === "text-to-video";
  });

  return textMode?.send ? new Set(textMode.send) : null;
};

const RECONNECTABLE_TASK_STATUSES = new Set<TaskStatus>([
  TaskStatus.IN_QUEUE,
  TaskStatus.PROMPT_DELIVERING,
  TaskStatus.AI_PROCESSING,
  TaskStatus.GENERATING,
  TaskStatus.PARTIAL_COMPLETE,
]);

const LOCAL_TASK_PLACEHOLDER_PREFIXES = ["pending-", "chat-", "history-"];

const isBackendTaskId = (taskId: string | null | undefined) => {
  const normalizedTaskId = String(taskId || "").trim();
  if (!normalizedTaskId) return false;
  return !LOCAL_TASK_PLACEHOLDER_PREFIXES.some((prefix) =>
    normalizedTaskId.startsWith(prefix)
  );
};

const normalizeGenerationStatus = (
  status: TaskStatus,
  resultCount: number,
  expectedCount: number
) => {
  if (
    status === TaskStatus.COMPLETED &&
    resultCount < Math.max(1, expectedCount)
  ) {
    return resultCount > 0
      ? TaskStatus.PARTIAL_COMPLETE
      : TaskStatus.AI_PROCESSING;
  }

  return status;
};

const BANANA_MAX_REFERENCE_IMAGES = 4;

type GenerateType = "image" | "video" | "audio" | "text";
type SubmitType = GenerateType | "chat" | null;

const resolveCapabilitySubmitType = (kind: unknown): SubmitType => {
  if (kind === "chat" || kind === "text") return kind;
  if (kind === "image" || kind === "video" || kind === "audio") return kind;
  return null;
};

const areSubmitTypesCompatible = (
  selectedKind: unknown,
  generateType: SubmitType
) => {
  const selectedType = resolveCapabilitySubmitType(selectedKind);
  if (!selectedType || !generateType) return true;
  if ((selectedType === "text" && generateType === "chat") || (selectedType === "chat" && generateType === "text")) return true;
  return selectedType === generateType;
};

const resolveGenerationKind = (
  kind: SubmitType | ChatCreateResponse["kind"] | undefined
): GenerateType | "chat" => {
  if (
    kind === "image" ||
    kind === "video" ||
    kind === "audio" ||
    kind === "text" ||
    kind === "chat"
  ) {
    return kind;
  }

  return "image";
};

const resolveTaskLoraModel = (
  task: Pick<TaskRuntimePayload, "loraModel" | "kind" | "type">
): ImageDataGroup["loraModel"] => {
  if (typeof task.loraModel === "string" && task.loraModel) {
    return task.loraModel;
  }

  if (
    task.loraModel &&
    typeof task.loraModel === "object" &&
    task.loraModel.id &&
    task.loraModel.title
  ) {
    return {
      id: task.loraModel.id,
      title: task.loraModel.title,
    };
  }

  return resolveGenerationKind((task.kind || task.type || "image") as SubmitType);
};

type GenerationFormError = {
  message: string;
  missingFields: string[];
  choices: string[];
  reason:
    | "missing_required_info"
    | "ambiguous_intent"
    | "unsupported_request"
    | "invalid_input"
    | null;
};

type ChatCreateResponse = {
  type?: "chat" | "generation";
  kind?: "image" | "video" | "audio";
  count?: number;
  taskId?: string;
  status?: string;
  conversationId?: string;
  userMessageId?: string;
  assistantMessageId?: string;
  message?: string | {
    role?: string;
    content?: string;
  };
  ok?: boolean;
  missingFields?: string[];
  choices?: string[];
  reason?: GenerationFormError["reason"];
  error?: string;
  detail?: string;
};

const normalizeChatCreateResponse = (payload: unknown): ChatCreateResponse | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const raw = payload as Record<string, unknown>;
  const nested =
    raw.result && typeof raw.result === "object"
      ? (raw.result as Record<string, unknown>)
      : raw.data && typeof raw.data === "object"
        ? (raw.data as Record<string, unknown>)
        : raw;

  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value.trim().length > 0 ? value : undefined;

  const taskFromNested =
    nested.task && typeof nested.task === "object"
      ? (nested.task as Record<string, unknown>)
      : null;
  const conversationFromNested =
    nested.conversation && typeof nested.conversation === "object"
      ? (nested.conversation as Record<string, unknown>)
      : null;
  const conversationFromTask =
    taskFromNested?.conversation &&
    typeof taskFromNested.conversation === "object"
      ? (taskFromNested.conversation as Record<string, unknown>)
      : null;
  const assistantMessage = asRecord(nested.assistantMessage);
  const userMessage = asRecord(nested.userMessage);
  const nestedData = asRecord(nested.data);
  const nestedMetadata = asRecord(nested.metadata);
  const assistantConversation = asRecord(assistantMessage?.conversation);
  const userConversation = asRecord(userMessage?.conversation);
  const dataConversation = asRecord(nestedData?.conversation);

  const userMessageMetadata = asRecord(userMessage?.metadata);
  const assistantMessageMetadata = asRecord(assistantMessage?.metadata);
  const metadataCandidates = [
    nestedMetadata,
    asRecord(nestedData?.metadata),
    userMessageMetadata,
    assistantMessageMetadata,
  ].filter((item): item is Record<string, unknown> => Boolean(item));

  const taskIdFromMetadata = metadataCandidates
    .map((item) =>
      asString(item.taskId) ||
      asString(item.generationId) ||
      asString(item.id)
    )
    .find(Boolean);

  const conversationIdFromMessages =
    asString(assistantMessage?.conversationId) ||
    asString(userMessage?.conversationId) ||
    asString(assistantConversation?.id) ||
    asString(userConversation?.id) ||
    asString(assistantMessage?.conversation) ||
    asString(userMessage?.conversation);

  const normalized: ChatCreateResponse = {
    ...(nested as ChatCreateResponse),
    taskId:
      typeof nested.taskId === "string"
        ? nested.taskId
        : asString(nestedData?.taskId)
          ? asString(nestedData?.taskId)
          : taskIdFromMetadata
            ? taskIdFromMetadata
        : typeof nested.id === "string"
          ? nested.id
          : typeof taskFromNested?.id === "string"
            ? taskFromNested.id
            : typeof taskFromNested?._id === "string"
              ? taskFromNested._id
              : undefined,
    conversationId:
      typeof nested.conversationId === "string"
        ? nested.conversationId
        : asString(nestedData?.conversationId)
          ? asString(nestedData?.conversationId)
          : conversationIdFromMessages
            ? conversationIdFromMessages
        : typeof nested.projectId === "string"
          ? nested.projectId
          : typeof taskFromNested?.conversationId === "string"
            ? taskFromNested.conversationId
            : typeof taskFromNested?.projectId === "string"
              ? taskFromNested.projectId
              : asString(dataConversation?.id)
                ? asString(dataConversation?.id)
              : typeof conversationFromNested?.id === "string"
                ? conversationFromNested.id
                : typeof conversationFromTask?.id === "string"
                  ? conversationFromTask.id
          : undefined,
    type:
      nested.type === "chat" || nested.type === "generation"
        ? nested.type
        : asString(nested.status) === "submitted" ||
            asString(nestedData?.status) === "submitted" ||
            asString(nested.kind) === "image" ||
            asString(nested.kind) === "video" ||
            asString(nested.kind) === "audio" ||
            asString(nestedData?.type) === "generation_result" ||
            asString(userMessage?.messageType) === "generation_result" ||
            asString(assistantMessage?.messageType) === "generation_result"
          ? "generation"
        : typeof nested.taskId === "string" ||
            typeof nestedData?.taskId === "string" ||
            typeof nested.id === "string" ||
            typeof taskFromNested?.id === "string" ||
            typeof taskFromNested?._id === "string" ||
            Boolean(taskIdFromMetadata)
          ? "generation"
          : undefined,
    message:
      typeof nested.message === "string" ||
      (nested.message &&
        typeof nested.message === "object" &&
        typeof (nested.message as { content?: unknown }).content === "string")
        ? (nested.message as ChatCreateResponse["message"])
        : typeof assistantMessage?.content === "string"
          ? {
              role:
                typeof assistantMessage.role === "string"
                  ? assistantMessage.role
                  : "ASSISTANT",
              content: assistantMessage.content,
            }
        : undefined,
    userMessageId:
      asString(nested.userMessageId) ||
      asString(userMessage?.id) ||
      asString(nestedData?.userMessageId),
    assistantMessageId:
      asString(nested.assistantMessageId) ||
      asString(assistantMessage?.id) ||
      asString(nestedData?.assistantMessageId),
    kind:
      nested.kind === "image" || nested.kind === "video" || nested.kind === "audio"
        ? nested.kind
        : asString(nestedData?.kind) === "image" ||
            asString(nestedData?.kind) === "video" ||
            asString(nestedData?.kind) === "audio"
          ? (nestedData?.kind as "image" | "video" | "audio")
          : undefined,
    status:
      asString(nested.status) ||
      asString(nestedData?.status) ||
      asString(assistantMessage?.status) ||
      asString(userMessage?.status),
  };

  return normalized;
};

const getResponseMessageText = (
  message: ChatCreateResponse["message"]
): string => {
  if (typeof message === "string") {
    return message;
  }

  if (message && typeof message.content === "string") {
    return message.content;
  }

  return "";
};

const getBackendErrorText = (data: ChatCreateResponse | null | undefined) =>
  getResponseMessageText(data?.message) ||
  data?.detail ||
  data?.error ||
  "";

const getSubmitExceptionMessage = (error: unknown, locale: string) => {
  const rawMessage = error instanceof Error ? error.message : "";
  const errorName = error instanceof Error ? error.name : "";

  if (/abort|timeout/i.test(errorName) || /abort|timeout|timed out/i.test(rawMessage)) {
    return locale === "zh-TW"
      ? "送出逾時：後端建立任務太久沒有回應，請稍後重試。"
      : locale === "ja"
        ? "送信がタイムアウトしました。バックエンドがタスク作成に時間をかけすぎています。しばらくしてからもう一度お試しください。"
        : "Submit timed out: the backend took too long to create the task. Please try again later.";
  }

  if (/failed to fetch|networkerror|load failed/i.test(rawMessage)) {
    return locale === "zh-TW"
      ? "送出失敗：無法連到後端代理，請確認網路或稍後再試。"
      : locale === "ja"
        ? "送信に失敗しました。バックエンドプロキシに接続できません。ネットワークを確認してからもう一度お試しください。"
        : "Submit failed: unable to reach the backend proxy. Please check your network and try again.";
  }

  return rawMessage;
};

const isInsufficientPointsResponse = (
  status: number,
  data: ChatCreateResponse | null | undefined
) => {
  if (status === 402) return true;

  const text = getBackendErrorText(data).toLowerCase();
  return (
    text.includes("insufficient points") ||
    text.includes("not enough points") ||
    text.includes("not enough credits") ||
    text.includes("insufficient credits") ||
    text.includes("點數不足") ||
    text.includes("余额不足") ||
    text.includes("餘額不足")
  );
};

type ChatHistoryMessage = {
  id?: string;
  role?: string;
  sender?: string;
  type?: string;
  messageType?: string;
  content?: unknown;
  task?: {
    id?: string;
    _id?: string;
    taskId?: string;
    conversationId?: string;
    projectId?: string;
    conversation?: string | {
      id?: string;
      _id?: string;
    };
    kind?: "image" | "video" | "audio" | "text" | "chat";
    type?: "image" | "video" | "audio" | "text" | "chat";
    status?: string;
    expectedCount?: number;
    resultCount?: number;
    actualCount?: number;
    partialCompleteFinal?: boolean;
    partialCompleteReason?: string | null;
    settings?: Record<string, unknown> | null;
    createdAt?: string;
    updatedAt?: string;
    publishedImages?: Array<{
      publishedImageId?: string;
      shortId?: string;
      url?: string;
    }>;
  } | null;
  createdAt?: string;
  updatedAt?: string;
};

const asHistoryRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readHistoryString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim().length > 0 ? value : undefined;

const getHistoryTaskId = (
  task: NonNullable<ChatHistoryMessage["task"]>
): string | undefined =>
  readHistoryString(task.id) ||
  readHistoryString(task._id) ||
  readHistoryString(task.taskId);

const getHistoryTaskConversationId = (
  task: NonNullable<ChatHistoryMessage["task"]>
): string | undefined => {
  const conversation = task.conversation;
  const conversationRecord = asHistoryRecord(conversation);

  return (
    readHistoryString(task.conversationId) ||
    readHistoryString(task.projectId) ||
    readHistoryString(conversation) ||
    readHistoryString(conversationRecord?.id) ||
    readHistoryString(conversationRecord?._id)
  );
};

const isHistoryMessageLike = (value: unknown): value is ChatHistoryMessage => {
  const record = asHistoryRecord(value);
  if (!record) return false;

  return (
    "content" in record ||
    "task" in record ||
    "role" in record ||
    "sender" in record ||
    "messageType" in record
  );
};

const extractHistoryMessages = (payload: unknown): ChatHistoryMessage[] => {
  if (Array.isArray(payload)) {
    return payload.filter(isHistoryMessageLike);
  }

  const root = asHistoryRecord(payload);
  if (!root) return [];

  const queue: Record<string, unknown>[] = [root];
  const visited = new Set<Record<string, unknown>>();
  const candidates: ChatHistoryMessage[][] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);

    Object.values(current).forEach((value) => {
      if (Array.isArray(value)) {
        const messages = value.filter(isHistoryMessageLike);
        if (messages.length > 0) {
          candidates.push(messages);
        }
        value.forEach((item) => {
          const nested = asHistoryRecord(item);
          if (nested) queue.push(nested);
        });
        return;
      }

      const nested = asHistoryRecord(value);
      if (nested) queue.push(nested);
    });
  }

  return candidates.sort((a, b) => b.length - a.length)[0] || [];
};

const resolveHistoryRole = (message: ChatHistoryMessage): string => {
  const rawRole = String(
    message.role || message.sender || message.type || message.messageType || ""
  ).toLowerCase();

  if (["user", "human", "customer", "member"].includes(rawRole)) return "user";
  if (["assistant", "ai", "bot", "system_assistant"].includes(rawRole)) {
    return "assistant";
  }

  return rawRole;
};

const isVideoUrl = (url?: string) =>
  /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");

const GENERATE_TYPE_REFERENCE_LIMITS: Record<GenerateType, number> = {
  image: 3,
  video: 2,
  audio: 0,
  text: 0,
};

const GENERATE_IMAGE_COUNTS = [1, 2, 3, 4] as const;

const readTaskSettings = (task: unknown): Record<string, unknown> => {
  const settings = task && typeof task === "object"
    ? (task as { settings?: unknown }).settings
    : null;
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {};
};



const extractTaskReferenceImages = (task: unknown): Array<{ name?: string; url?: string }> => {
  const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;

  const pickString = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  };

  const pickNestedUrl = (value: unknown): string => {
    const record = asRecord(value);
    if (!record) return "";
    return pickString(
      record.url,
      record.uploadedUrl,
      record.imageUrl,
      record.image_url,
      record.fileUrl,
      record.src,
      record.init_image,
      record.initImage,
      asRecord(record.image_url)?.url,
      asRecord(record.image)?.url,
      asRecord(record.file)?.url,
      asRecord(record.asset)?.url
    );
  };

  const shouldUseRecordAsImage = (record: Record<string, unknown>, requireImageType: boolean) => {
    if (!requireImageType) return true;
    const rawType = pickString(record.type, record.mediaType, record.assetType, record.asset_type);
    return !rawType || rawType.toLowerCase().includes("image");
  };

  const results: Array<{ name?: string; url?: string }> = [];
  const seen = new Set<string>();
  const append = (value: unknown, requireImageType = false) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach((item) => append(item, requireImageType));
      return;
    }

    if (typeof value === "string") {
      const url = normalizeMediaUrl(value.trim());
      if (!url || seen.has(url) || isVideoUrl(url)) return;
      seen.add(url);
      results.push({ url });
      return;
    }

    const record = asRecord(value);
    if (!record || !shouldUseRecordAsImage(record, requireImageType)) return;

    const url = normalizeMediaUrl(pickNestedUrl(record));
    if (!url || seen.has(url) || isVideoUrl(url)) return;

    seen.add(url);
    results.push({
      name: pickString(record.name, record.fileName, record.filename, record.id) || undefined,
      url,
    });
  };

  const collectFromRecord = (record: Record<string, unknown> | null) => {
    if (!record) return;
    append(record.images);
    append(record.referenceImages);
    append(record.referenceImageUrls);
    append(record.inputImages);
    append(record.inputImageUrls);
    append(record.referenceAssets, true);
    append(record.attachments, true);
    append(record.init_image);
    append(record.initImage);
    append(record.sourceImage);
    append(record.sourceImageUrl);

    const snapshot = asRecord(record.requestSnapshot);
    collectFromRecord(asRecord(snapshot?.body));
    collectFromRecord(asRecord(record.requestBody));
    collectFromRecord(asRecord(record.body));
  };

  collectFromRecord(asRecord(task));
  collectFromRecord(readTaskSettings(task));

  return results;
};

const readTaskNumber = (...values: unknown[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

const resolveTaskExpectedCount = (
  task: {
    kind?: string;
    type?: string;
    expectedCount?: number;
    count?: number;
    settings?: Record<string, unknown> | null;
    publishedImages?: Array<unknown>;
  } | null | undefined,
  fallback = 1
) => {
  const settings = readTaskSettings(task);
  const taskKind = String(
    task?.kind || task?.type || settings.kind || settings.type || ""
  ).toLowerCase();
  const normalizedFallback = taskKind === "image" ? fallback : 1;
  const publishedCount = Array.isArray(task?.publishedImages)
    ? task!.publishedImages!.length
    : 0;
  const expected =
    readTaskNumber(
      task?.expectedCount,
      settings.expectedCount,
      task?.count,
      settings.count,
      settings.requestedCount,
      settings.samples
    ) || publishedCount || normalizedFallback;

  return Math.max(1, taskKind && taskKind !== "image" ? 1 : expected);
};

const resolveTaskResultCount = (
  task: {
    status?: unknown;
    resultCount?: number;
    actualCount?: number;
    settings?: Record<string, unknown> | null;
    publishedImages?: Array<unknown>;
  } | null | undefined
) => {
  const settings = readTaskSettings(task);
  const publishedCount = Array.isArray(task?.publishedImages)
    ? task!.publishedImages!.filter((p) => {
        if (typeof p === "string") return p.trim().length > 0;
        return Boolean((p as { url?: string; publishedImageId?: string; id?: string })?.url ||
          (p as { publishedImageId?: string; id?: string })?.publishedImageId ||
          (p as { id?: string })?.id);
      }).length
    : 0;
  const normalizedStatus = String(task?.status || settings.status || "").toUpperCase();
  const canUseReportedCounts =
    normalizedStatus === TaskStatus.COMPLETED ||
    normalizedStatus === TaskStatus.PARTIAL_COMPLETE ||
    normalizedStatus === TaskStatus.FAILED;

  if (!canUseReportedCounts) {
    return publishedCount;
  }

  return Math.max(
    0,
    readTaskNumber(
      task?.resultCount,
      settings.resultCount,
      task?.actualCount,
      settings.actualCount,
      settings.completedCount
    ) || publishedCount
  );
};

const PARTIAL_FINAL_STALE_MS = 2 * 60 * 1000;

const isTaskPartialCompleteFinal = (
  task: ({
    status?: string;
    partialCompleteFinal?: boolean;
    updatedAt?: string;
    createdAt?: string;
    settings?: Record<string, unknown> | null;
  } & Parameters<typeof resolveTaskExpectedCount>[0] & Parameters<typeof resolveTaskResultCount>[0]) | null | undefined
) => {
  if (String(task?.status || "").toUpperCase() !== TaskStatus.PARTIAL_COMPLETE) {
    return false;
  }

  const settings = readTaskSettings(task);
  if (task?.partialCompleteFinal === true || settings.partialCompleteFinal === true) {
    return true;
  }

  const resultCount = resolveTaskResultCount(task);
  const expectedCount = resolveTaskExpectedCount(task);
  if (resultCount <= 0 || resultCount >= expectedCount) return false;

  const updatedAtMs = new Date(
    String(settings.partialCompleteAt || task?.createdAt || task?.updatedAt || 0)
  ).getTime();
  return Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs >= PARTIAL_FINAL_STALE_MS;
};

const resolveTaskDisplayExpectedCount = (
  task: Parameters<typeof isTaskPartialCompleteFinal>[0],
  fallback = 1
) => {
  if (isTaskPartialCompleteFinal(task)) {
    const settings = readTaskSettings(task);
    return Math.max(
      1,
      readTaskNumber(
        task?.actualCount,
        settings.actualCount,
        settings.completedCount
      ) || resolveTaskResultCount(task)
    );
  }
  return resolveTaskExpectedCount(task, fallback);
};

const isFailedStatus = (status: unknown) =>
  String(status || "").toUpperCase() === TaskStatus.FAILED;

const groupHasRenderableMedia = (group?: Pick<ImageDataGroup, "publishedImages"> | null) =>
  Boolean(group?.publishedImages?.some((image) => Boolean(image?.url)));

const taskHasRenderableMedia = (task: { publishedImages?: Array<unknown>; resultCount?: number } | null | undefined) =>
  Boolean(
    task?.publishedImages?.some((item) => {
      if (typeof item === "string") return item.trim().length > 0;
      if (!item || typeof item !== "object") return false;
      const record = item as Record<string, unknown>;
      return Boolean(record.url || record.s3_url || record.imageUrl || record.videoUrl || record.fileUrl || record.proxyUrl);
    })
  );

const isEmptyFailedTask = (task: { status?: unknown; publishedImages?: Array<unknown>; resultCount?: number } | null | undefined) =>
  isFailedStatus(task?.status) && !taskHasRenderableMedia(task);

const normalizeTaskPublishedImages = (
  publishedImages: unknown
): Array<{
  publishedImageId?: string;
  shortId?: string;
  url?: string;
}> => {
  if (!Array.isArray(publishedImages)) return [];

  const pickString = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  };

  const readNestedUrl = (value: unknown) => {
    if (!value || typeof value !== "object") return "";
    const record = value as Record<string, unknown>;

    return pickString(
      record.url,
      record.imageUrl,
      record.videoUrl,
      record.audioUrl,
      record.fileUrl,
      record.s3_url,
      record.s3Url,
      record.src,
      record.filename
    );
  };

  return publishedImages.flatMap((image) => {
    if (typeof image === "string") {
      return image.trim() ? [{ publishedImageId: image.trim() }] : [];
    }

    if (!image || typeof image !== "object") return [];

    const value = image as Record<string, unknown>;
    const publishedImageId =
      pickString(value.publishedImageId, value.imageId, value.id, value._id);
    const shortId = pickString(value.shortId) || undefined;
    const url = pickString(
      value.url,
      value.imageUrl,
      value.videoUrl,
      value.audioUrl,
      value.fileUrl,
      value.resultUrl,
      value.s3_url,
      value.s3Url,
      value.src,
      readNestedUrl(value.media),
      readNestedUrl(value.image),
      readNestedUrl(value.video),
      readNestedUrl(value.audio),
      readNestedUrl(value.file)
    );

    if (!publishedImageId && !shortId && !url) return [];
    return [{ publishedImageId, shortId, url }];
  });
};

const extractTaskMediaCandidates = (
  payload: Partial<TaskRuntimePayload> | null | undefined
): Array<{
  publishedImageId?: string;
  shortId?: string;
  url?: string;
}> => {
  if (!payload || typeof payload !== "object") return [];

  const pickMediaString = (...values: unknown[]) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return "";
  };

  const readNestedMediaUrl = (value: unknown) => {
    if (!value || typeof value !== "object") return "";
    const record = value as Record<string, unknown>;

    return pickMediaString(
      record.url,
      record.imageUrl,
      record.videoUrl,
      record.audioUrl,
      record.fileUrl,
      record.s3_url,
      record.s3Url,
      record.src,
      record.filename
    );
  };

  const topLevelUrl = pickMediaString(
    payload.url,
    payload.imageUrl,
    payload.videoUrl,
    payload.audioUrl,
    payload.fileUrl,
    payload.mediaUrl,
    payload.outputUrl,
    payload.resultUrl,
    payload.s3_url,
    payload.s3Url,
    payload.src,
    readNestedMediaUrl(payload.media),
    readNestedMediaUrl(payload.video),
    readNestedMediaUrl(payload.audio),
    readNestedMediaUrl(payload.image),
    readNestedMediaUrl(payload.file)
  );

  const merged: Array<{
    publishedImageId?: string;
    shortId?: string;
    url?: string;
  }> = [
    ...normalizeTaskPublishedImages(payload.publishedImages),
    ...(topLevelUrl ? [{ url: topLevelUrl }] : []),
    ...normalizeTaskPublishedImages(payload.resultUrls),
    ...normalizeTaskPublishedImages(payload.outputs),
  ];

  const seen = new Set<string>();
  return merged.filter((item) => {
    const key = `${item.publishedImageId || ""}:${item.shortId || ""}:${item.url || ""}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveGenerationOutputCount = (
  kind: GenerateType | "chat" | null | undefined,
  requestedCount?: number | null
) => {
  if (kind !== "image") {
    return 1;
  }

  return Math.max(1, Number(requestedCount) || 1);
};

const buildTaskImageSlots = (
  taskId: string,
  publishedImages: Array<{
    publishedImageId?: string;
    shortId?: string;
    url?: string;
  }> = [],
  expectedCount = 1
): ImageData[] => {
  const slotCount = Math.max(expectedCount, 1);

  return Array.from({ length: slotCount }, (_, index) => {
    const item = publishedImages[index];

    return {
      id: `${taskId}_${index}`,
      publishedImageId: item?.publishedImageId || "",
      shortId: item?.shortId,
      url: normalizeMediaUrl(item?.url),
      userReaction: {
        like: false,
        dislike: false,
        collecting: false,
        comment: "",
      },
      reactions: {
        likes: 0,
        dislikes: 0,
        collections: 0,
      },
    };
  });
};

export default function PromptForm({
  isGenerating,
  setIsGenerating,
  setIsModelSelectorOpen,
  selectedModel,
  setSelectedModel,
  initialTemplate,
  retryGenerationRequest,
  onRetryGenerationRequestConsumed,
  onImageToImageModeChange,
}: PromptFormProps): JSX.Element {
  const { user, updateUserPoint } = useAuth();
  const [prompt, setPrompt] = useState<string>("");
  const [isComposing, setIsComposing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<
    { file?: File; name: string; url?: string }[]
  >([]);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [audioFileName, setAudioFileName] = useState<string>("");
  const [motionVideoUrl, setMotionVideoUrl] = useState<string>("");
  const [motionVideoFileName, setMotionVideoFileName] = useState<string>("");
  const [showStyleTransferMenu, setShowStyleTransferMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [capabilityResponse, setCapabilityResponse] = useState<CapabilityResponse | null>(null);
  const [isLoadingModelMenu, setIsLoadingModelMenu] = useState(false);
  const [showModelWarning, setShowModelWarning] = useState(false);
  const [isUploadingReferences, setIsUploadingReferences] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingMotionVideo, setIsUploadingMotionVideo] = useState(false);
  const [pendingReferenceCount, setPendingReferenceCount] = useState(0);
  const [pendingReferencePreviews, setPendingReferencePreviews] = useState<
    { id: string; name: string; url: string }[]
  >([]);

  const [showSelectedImageModelWarning, setShowSelectedImageModelWarning] = useState(false);
  const [draggedReferenceIndex, setDraggedReferenceIndex] = useState<number | null>(null);
  const [draggedOverReferenceIndex, setDraggedOverReferenceIndex] = useState<number | null>(null);

  const [generateType, setGenerateType] = useState<SubmitType>(null);
  const [imageCount, setImageCount] = useState<(typeof GENERATE_IMAGE_COUNTS)[number]>(4);
  const [formError, setFormError] = useState<GenerationFormError | null>(null);

  // 動態能力欄位狀態
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  const [showCountMenu, setShowCountMenu] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [selectedAspectRatioValue, setSelectedAspectRatioValue] = useState<string>("1:1");
  const [selectedResolutionValue, setSelectedResolutionValue] = useState<string>("");
  const [selectedDurationValue, setSelectedDurationValue] = useState<string>("");
  const [dynamicParamValues, setDynamicParamValues] = useState<Record<string, string | number | boolean>>({});
  const desktopCountButtonRef = useRef<HTMLDivElement>(null);
  const mobileCountButtonRef = useRef<HTMLDivElement>(null);
  const desktopRatioButtonRef = useRef<HTMLDivElement>(null);
  const mobileRatioButtonRef = useRef<HTMLDivElement>(null);
  const typeButtonRef = useRef<HTMLDivElement>(null);

  const desktopStyleTransferButtonRef = useRef<HTMLDivElement>(null);
  const mobileStyleTransferButtonRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLDivElement>(null);
  const {
    images,
    addImage,
    setImages,
    removeImage,
    updateImage,
    updateImageQueue,
    selectedImageForGeneration,
    setSelectedImageForGeneration,
  } = useContext(GalleryContext);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const selectedConversationId = searchParams.get("conversationId");
  const freshConversationKey = searchParams.get("fresh");
  const locale = useLocale();
  const t = useTranslations("drawing");
  const tm = useTranslations("models");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const appliedTemplateKeyRef = useRef<string | null>(null);
  const lastParamInitKeyRef = useRef<string | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const motionVideoInputRef = useRef<HTMLInputElement>(null);

  const clearPendingReferencePreviews = useCallback(() => {
    setPendingReferencePreviews((prev) => {
      prev.forEach((preview) => URL.revokeObjectURL(preview.url));
      return [];
    });
  }, []);

  const showPendingReferencePreviews = useCallback((files: File[]) => {
    setPendingReferencePreviews((prev) => {
      prev.forEach((preview) => URL.revokeObjectURL(preview.url));
      return files.map((file, index) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${index}`,
        name: file.name,
        url: URL.createObjectURL(file),
      }));
    });
  }, []);

  useEffect(() => {
    return () => {
      clearPendingReferencePreviews();
    };
  }, [clearPendingReferencePreviews]);

  const promptPlaceholder = useMemo(() => {
    if (locale === "zh-TW") {
      return {
        default: "直接描述你想做什麼，我會幫你判斷是聊天還是生成",
        chat: "直接輸入你想聊的內容",
        text: "直接輸入你想處理的文字內容",
        image: "描述你想生成的畫面、角色、場景或風格",
        video: "描述你想生成的影片內容、運鏡、節奏或氛圍",
        audio: "描述你想生成的音效、情緒、節奏或使用情境",
      } as const;
    }

    if (locale === "ja") {
      return {
        default: "何をしたいかそのまま入力してください。会話か生成かを判断します",
        chat: "会話したい内容をそのまま入力してください",
        text: "処理したいテキスト内容を入力してください",
        image: "生成したい画面、キャラクター、シーン、スタイルを書いてください",
        video: "生成したい動画の内容、カメラワーク、テンポ、雰囲気を書いてください",
        audio: "生成したい効果音、感情、テンポ、使用シーンを書いてください",
      } as const;
    }

    return {
      default: "Describe what you want naturally. I will decide whether to chat or generate",
      chat: "Type what you want to talk about",
      text: "Type the writing task you want help with",
      image: "Describe the image, character, scene, or style you want to generate",
      video: "Describe the video, motion, pacing, or mood you want to generate",
      audio: "Describe the sound effect, mood, rhythm, or use case you want to generate",
    } as const;
  }, [locale]);

  const modeOptions = useMemo(
    () =>
      [
        {
          id: null,
          label: locale === "zh-TW" ? "自動" : locale === "ja" ? "自動" : "Auto",
          icon: Sparkles,
        },
        {
          id: "chat" as const,
          label: locale === "zh-TW" ? "文字" : locale === "ja" ? "テキスト" : "Text",
          icon: MessageSquare,
        },
        {
          id: "image" as const,
          label: locale === "zh-TW" ? "圖片" : locale === "ja" ? "画像" : "Image",
          icon: ImageIcon,
        },
        {
          id: "video" as const,
          label: locale === "zh-TW" ? "影片" : locale === "ja" ? "動画" : "Video",
          icon: Video,
        },
        {
          id: "audio" as const,
          label: locale === "zh-TW" ? "聲音" : locale === "ja" ? "音声" : "Audio",
          icon: Mic,
        },
      ] satisfies Array<{
        id: SubmitType;
        label: string;
        icon: typeof ImageIcon;
      }>,
    [locale]
  );
  const renderedModeOptions = modeOptions;
  const activeModeOption = useMemo(
    () => renderedModeOptions.find((item) => item.id === generateType) || renderedModeOptions[0],
    [generateType, renderedModeOptions]
  );
  const selectedCapabilityModel = useMemo(() => {
    if (!selectedModel || !capabilityResponse?.media) {
      return selectedModel as (LoraModel & CapabilityModel) | null;
    }

    const selectedRecord = selectedModel as LoraModel & Partial<CapabilityModel>;
    const selectedKeys = new Set([
      selectedRecord.id,
      selectedRecord.modelId,
      selectedRecord.submit?.modelId,
      normalizeCapabilityModelKey(selectedRecord.id),
      normalizeCapabilityModelKey(selectedRecord.modelId),
      normalizeCapabilityModelKey(selectedRecord.submit?.modelId),
    ].filter(Boolean));

    const realModel = capabilityResponse.media
      .flatMap((m) => m.models)
      .find((m) => capabilityModelKeys(m).some((key) => selectedKeys.has(key)));

    return (realModel || selectedModel) as (LoraModel & CapabilityModel) | null;
  }, [selectedModel, capabilityResponse]);
  const selectedCapabilitySubmitType = useMemo(
    () =>
      resolveCapabilitySubmitType(
        selectedCapabilityModel?.submit?.type || selectedCapabilityModel?.kind
      ),
    [selectedCapabilityModel?.kind, selectedCapabilityModel?.submit?.type]
  );
  const effectiveGenerateType = useMemo<SubmitType>(() => {
    if (generateType !== null) return generateType;
    const selectedKind = selectedCapabilityModel?.kind as SubmitType | undefined;
    if (selectedKind === "image" || selectedKind === "video" || selectedKind === "audio" || selectedKind === "text") {
      return selectedKind;
    }
    return generateType;
  }, [generateType, selectedCapabilityModel?.kind]);
  const isTextMode = generateType === "chat" || generateType === "text";
  const isManualImageMode = generateType === "image";
  const selectedModelIdentity = String(
    selectedCapabilityModel?.submit?.modelId ||
      selectedCapabilityModel?.modelId ||
      selectedCapabilityModel?.id ||
      ""
  ).toLowerCase();
  const isImageFaceSwapMode =
    generateType === "image" &&
    (selectedModelIdentity.includes("piapifaceswap") ||
      selectedModelIdentity.includes("face_swap"));
  const isVideoFaceSwapMode =
    generateType === "video" &&
    (selectedModelIdentity.includes("piapivideofaceswap") ||
      selectedModelIdentity.includes("videofaceswap"));
  const isBananaImageModel =
    generateType === "image" && selectedModelIdentity.includes("banana");
  const isTalkingAvatarModel =
    generateType === "video" &&
    selectedCapabilityModel?.submit?.modelId === "kie:KlingAIAvatarStandard";
  const isMotionControlModel =
    generateType === "video" &&
    selectedCapabilityModel?.submit?.modelId === "kie:KlingMotionControl26";
  const imageUploadParams = useMemo(
    () => getCapabilityParamsByType(selectedCapabilityModel, "image_upload"),
    [selectedCapabilityModel]
  );
  const hasSchemaImageUpload = imageUploadParams.length > 0;
  const schemaImageUploadMax = useMemo(
    () =>
      imageUploadParams.reduce(
        (max, param) => Math.max(max, getCapabilityParamMax(param)),
        0
      ),
    [imageUploadParams]
  );
  const hasSchemaAudioUpload =
    getCapabilityParamsByType(selectedCapabilityModel, "audio_upload").length > 0;
  const hasSchemaVideoUpload =
    getCapabilityParamsByType(selectedCapabilityModel, "video_upload").length > 0;
  const videoUploadParam = getCapabilityParamsByType(selectedCapabilityModel, "video_upload")[0] || null;
  const booleanParams = useMemo(
    () => getCapabilityParamsByType(selectedCapabilityModel, "boolean"),
    [selectedCapabilityModel]
  );
  const requiresVideoReferenceImage =
    generateType === "video" &&
    (Boolean(selectedCapabilityModel?.inputs?.images) || hasSchemaImageUpload);
  const selectedMediaGroup = useMemo(() => {
    const currentType = String(generateType || "");
    return (
      capabilityResponse?.media?.find((item) => {
        const itemKind = String(item.kind || "");
        if (currentType === "chat" || currentType === "text") {
          return itemKind === "chat" || itemKind === "text";
        }
        return itemKind === currentType;
      }) || null
    );
  }, [capabilityResponse, generateType]);
  const availableModels = useMemo(
    () => selectedMediaGroup?.models || [],
    [selectedMediaGroup]
  );
  const selectedModelRequestId =
    selectedCapabilityModel?.submit?.modelId ||
    selectedCapabilityModel?.modelId ||
    selectedCapabilityModel?.id ||
    "";
  const selectedModelSupportsImageInput =
    Boolean(selectedCapabilityModel?.inputs?.images) || hasSchemaImageUpload || isBananaImageModel;
  const selectedModelMaxReferenceImages = Math.max(
    0,
    schemaImageUploadMax ||
      Number(getCapabilityParam(selectedCapabilityModel, "images")?.max) ||
      (isBananaImageModel ? BANANA_MAX_REFERENCE_IMAGES : 0)
  );
  const countParam = getCapabilityParam(selectedCapabilityModel, "count");
  const aspectRatioParam =
    getCapabilityParamByKeys(selectedCapabilityModel, [
      "aspectRatio",
      "aspect_ratio",
      "ratio",
    ]);
  const resolutionParam = getCapabilityParam(selectedCapabilityModel, "resolution");
  const durationParam = getCapabilityParam(selectedCapabilityModel, "duration");
  const outputFormatParam = getCapabilityParam(selectedCapabilityModel, "output_format");
  const aspectRatioOptions = useMemo(
    () => normalizeCapabilityOptions(aspectRatioParam),
    [aspectRatioParam]
  );
  const rawResolutionOptions = useMemo(
    () => normalizeCapabilityOptions(resolutionParam),
    [resolutionParam]
  );
  const resolutionOptions = useMemo(
    () =>
      generateType === "image"
        ? getSafeImageResolutionOptions(rawResolutionOptions)
        : rawResolutionOptions,
    [generateType, rawResolutionOptions]
  );
  const countOptions = useMemo(() => {
    const min = Math.max(1, Number(countParam?.min) || 1);
    const max = Math.min(4, Math.max(min, Number(countParam?.max) || 4));

    return GENERATE_IMAGE_COUNTS.filter((count) => count >= min && count <= max);
  }, [countParam?.max, countParam?.min]);
  const durationOptions = useMemo(
    () => normalizeCapabilityOptions(durationParam),
    [durationParam]
  );
  const selectedAspectRatioLabel = useMemo(
    () =>
      aspectRatioOptions.find((option) => option.value === selectedAspectRatioValue)
        ?.label ||
      selectedAspectRatioValue ||
      "Auto",
    [aspectRatioOptions, selectedAspectRatioValue]
  );
  const showVideoAspectRatio =
    !!aspectRatioParam &&
    generateType === "video" &&
    !isVideoFaceSwapMode;
  const showVideoDuration =
    !!durationParam &&
    generateType === "video" &&
    !isVideoFaceSwapMode;
  const showVideoResolution =
    !!resolutionParam && generateType === "video" && !isVideoFaceSwapMode;
  const currentPromptPlaceholder = useMemo(() => {
    if (isTalkingAvatarModel) {
      return locale === "zh-TW"
        ? "補充想說的內容、口氣或表情風格"
        : locale === "ja"
          ? "話し方、口調、表情の雰囲気を補足してください"
          : "Add speaking style, tone, or expression guidance";
    }

    if (isMotionControlModel) {
      return locale === "zh-TW"
        ? "補充動作細節、節奏或鏡頭感"
        : locale === "ja"
          ? "動きの細部、テンポ、カメラ感を補足してください"
          : "Add motion details, pacing, or camera direction";
    }

    return promptPlaceholder[generateType || "default"];
  }, [generateType, isMotionControlModel, isTalkingAvatarModel, locale, promptPlaceholder]);
  const canAttachReferenceImages =
    generateType !== "audio" &&
    (isImageFaceSwapMode ||
      isVideoFaceSwapMode ||
      generateType === null ||
      generateType === "image" ||
      generateType === "video" ||
      (isTextMode && selectedModelSupportsImageInput) ||
      (!isManualImageMode || selectedModelSupportsImageInput));
  const canAttachAudio = !isTextMode && (
    generateType === null ||
    Boolean(selectedCapabilityModel?.inputs?.audio) ||
    hasSchemaAudioUpload
  );
  const canAttachMotionVideo = !isTextMode && (
    generateType === null ||
    isVideoFaceSwapMode ||
    Boolean(selectedCapabilityModel?.inputs?.video) ||
    hasSchemaVideoUpload
  );
  const effectiveMaxReferenceImages =
    isImageFaceSwapMode
      ? selectedImageForGeneration
        ? 1
        : 2
      : isVideoFaceSwapMode
        ? 1
      : isManualImageMode
        ? selectedModelSupportsImageInput
          ? selectedModelMaxReferenceImages
          : 3
      : generateType === "video"
        ? requiresVideoReferenceImage || !selectedCapabilityModel
          ? Math.max(1, selectedModelMaxReferenceImages || 1)
          : 3
      : isTextMode
        ? selectedModelSupportsImageInput
          ? selectedModelMaxReferenceImages
          : 0
      : generateType
        ? GENERATE_TYPE_REFERENCE_LIMITS[generateType as GenerateType]
        : 3;

  const filteredMenuModels = useMemo(() => {
    return availableModels
      .slice()
      .sort((a, b) => {
        const rankDelta = getCapabilityModelSortRank(a) - getCapabilityModelSortRank(b);
        if (rankDelta !== 0) return rankDelta;
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });
  }, [availableModels]);

  const getModelCapabilityBadges = useCallback(
    (model: CapabilityModel) => {
      const badges: string[] = [];
      const hasImageUpload =
        Boolean(model.inputs?.images) ||
        getCapabilityParamsByType(model, "image_upload").length > 0;
      const hasAudioUpload =
        Boolean(model.inputs?.audio) ||
        getCapabilityParamsByType(model, "audio_upload").length > 0;
      const hasVideoUpload =
        Boolean(model.inputs?.video) ||
        getCapabilityParamsByType(model, "video_upload").length > 0;
      const resolutionOptions = getCapabilityParam(model, "resolution")?.options || [];
      const durationOptions = getCapabilityParam(model, "duration")?.options || [];

      if (model.supports?.textToVideo) {
        badges.push(locale === "zh-TW" ? "文生影片" : locale === "ja" ? "テキスト動画" : "Text to video");
      } else if (model.supports?.textToImage) {
        badges.push(locale === "zh-TW" ? "文生圖" : locale === "ja" ? "テキスト画像" : "Text to image");
      }

      if (model.supports?.imageToVideo || model.supports?.imageToImage || hasImageUpload) {
        badges.push(locale === "zh-TW" ? "可上傳圖片" : locale === "ja" ? "画像入力" : "Image input");
      }

      if (hasAudioUpload) {
        badges.push(locale === "zh-TW" ? "可上傳音訊" : locale === "ja" ? "音声入力" : "Audio input");
      }

      if (hasVideoUpload) {
        badges.push(locale === "zh-TW" ? "可上傳影片" : locale === "ja" ? "動画入力" : "Video input");
      }

      if (resolutionOptions.length) {
        badges.push(resolutionOptions.map((option) => option.label || option.value).join(" / "));
      }

      if (durationOptions.length) {
        const first = durationOptions[0]?.label || durationOptions[0]?.value;
        const last = durationOptions[durationOptions.length - 1]?.label || durationOptions[durationOptions.length - 1]?.value;
        if (first && last) {
          badges.push(first === last ? first : `${first}-${last}`);
        }
      }

      return badges.slice(0, 5);
    },
    [locale]
  );

  const previewUrls = useMemo(() => {
    return uploadedImages.map((image) => ({
      name: image.name,
      url: image.file ? URL.createObjectURL(image.file) : image.url || "",
      shouldRevoke: Boolean(image.file),
    }));
  }, [uploadedImages]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      previewUrls.forEach((image) => {
        if (image.shouldRevoke && image.url) {
          URL.revokeObjectURL(image.url);
        }
      });
    };
  }, [previewUrls]);

  const eventSourceRef = useRef<EventSource | null>(null);
  const chatEventSourceRef = useRef<EventSource | null>(null);
  const chatLastEventIdsRef = useRef<Record<string, string>>({});
  const chatRevealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatDraftsRef = useRef<Record<string, string>>({});
  const imagesRef = useRef<ImageDataGroup[]>([]);
  // 獨立追蹤每個 task 的 expectedCount，避免 imagesRef 因 useEffect 延遲導致 SSE 取到舊值
  const taskExpectedCountRef = useRef<Record<string, number>>({});
  const discardedTaskToastRef = useRef<Set<string>>(new Set());
  const failedTaskToastRef = useRef<Set<string>>(new Set());
  const autoReconnectedTaskIdsRef = useRef<Set<string>>(new Set());
  const activeChatStreamRef = useRef<{
    conversationId: string | null;
    groupId: string | null;
    fallbackPrompt: string;
    assistantMessageId?: string;
  }>({
    conversationId: null,
    groupId: null,
    fallbackPrompt: "",
    assistantMessageId: undefined,
  });
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const taskPollingTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const taskPollingStartedAtRef = useRef<Record<string, number>>({});
  const conversationIdRef = useRef<string | null>(null);
  const historyRequestSeqRef = useRef(0);

  const connectionStateRef = useRef<{
    isConnecting: boolean;
    isConnected: boolean;
    currentTaskId: string | null;
    userId: string | null;
    reconnectAttempt: number;
    lastEventId: string | null;
  }>({
    isConnecting: false,
    isConnected: false,
    currentTaskId: null,
    userId: null,
    reconnectAttempt: 0,
    lastEventId: null,
  });

  const promptRef = useRef(prompt);
  const modelRef = useRef(selectedModel?.id || "");
  const uuidRef = useRef<string>("");
  const historyLoadedRef = useRef(false);
  const skipNextHistoryLoadRef = useRef<string | null>(null);
  const handledFreshKeyRef = useRef<string | null>(null);
  const submitInFlightRef = useRef(false);
  const capabilitiesLoadedRef = useRef(false);

  const syncConversationUrl = useCallback((nextConversationId: string | null) => {
    if (typeof window === "undefined") return;

    const currentQuery = searchParams.toString();
    const nextParams = new URLSearchParams(currentQuery);
    nextParams.delete("fresh");
    // 一旦進入既有 conversation 後，移除「來自 templates」的所有 preset 參數，
    // 避免 hasTemplatePreset 持續為 true，使 isFreshConversation 在 images 短暫為空時又被誤判為 hero 介面。
    nextParams.delete("templatePrompt");
    nextParams.delete("templateType");
    nextParams.delete("templateAspectRatio");
    nextParams.delete("templateCount");
    nextParams.delete("modelId");
    nextParams.delete("selectedImageUrl");

    if (nextConversationId) {
      nextParams.set("conversationId", nextConversationId);
    } else {
      nextParams.delete("conversationId");
    }

    const query = nextParams.toString();
    if (query === currentQuery) {
      return;
    }
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const readHistoryText = useCallback((content: unknown): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (typeof item === "string") return item;
          if (!item || typeof item !== "object") return "";
          const value = item as Record<string, unknown>;
          return typeof value.text === "string"
            ? value.text
            : typeof value.content === "string"
              ? value.content
              : "";
        })
        .filter(Boolean)
        .join("\n");
    }
    if (!content || typeof content !== "object") return "";

    const value = content as Record<string, unknown>;

    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    if (
      value.message &&
      typeof value.message === "object" &&
      typeof (value.message as Record<string, unknown>).content === "string"
    ) {
      return (value.message as Record<string, unknown>).content as string;
    }

    return "";
  }, []);

  const buildConversationGroups = useCallback(
    (conversationId: string, messages: ChatHistoryMessage[]): ImageDataGroup[] => {
      const groups: ImageDataGroup[] = [];
      let pendingGroup: ImageDataGroup | null = null;
      let skipNextAssistantGeneration = false;

      const mapContentImages = (content: unknown) => {
        if (!Array.isArray(content)) return [];

        return content.flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const images = (item as Record<string, unknown>).images;
          if (!Array.isArray(images)) return [];

          return images
            .map((image) => {
              if (!image || typeof image !== "object") return null;
              const value = image as Record<string, unknown>;
              const publishedImageId =
                typeof value.publishedImageId === "string"
                  ? value.publishedImageId
                  : typeof value.id === "string"
                    ? value.id
                    : "";
              const shortId =
                typeof value.shortId === "string" ? value.shortId : undefined;
              const url = typeof value.url === "string" ? value.url : "";

              if (!publishedImageId && !shortId && !url) return null;
              return { publishedImageId, shortId, url };
            })
            .filter(Boolean) as Array<{
              publishedImageId?: string;
              shortId?: string;
              url?: string;
            }>;
        });
      };

      const mapTaskImages = (
        task: NonNullable<ChatHistoryMessage["task"]>
      ): ImageData[] => {
        const taskId = getHistoryTaskId(task) || "task";
        const publishedImages = Array.isArray(task.publishedImages) ? task.publishedImages : [];
        // 歷史記錄要顯示所有已發布圖片，不被 expectedCount 截斷
        const expectedCount = Math.max(
          resolveTaskDisplayExpectedCount(task),
          publishedImages.length
        );
        return buildTaskImageSlots(taskId, publishedImages, expectedCount);
      };

      messages.forEach((message, index) => {
        const role = resolveHistoryRole(message);
        const text = readHistoryText(message.content);
        const contentImages = mapContentImages(message.content);
        const contentType =
          message.content && typeof message.content === "object"
            ? String(
                (message.content as Record<string, unknown>).type || ""
              ).toLowerCase()
            : "";
        const timestamp =
          message.updatedAt ||
          message.createdAt ||
          new Date().toISOString();

        if (role === "user") {
          if (message.task && isEmptyFailedTask(message.task)) {
            pendingGroup = null;
            skipNextAssistantGeneration = true;
            return;
          }
          skipNextAssistantGeneration = false;

          const taskImages = message.task ? mapTaskImages(message.task) : [];
          const isGeneration = !!message.task;
          const taskId = message.task ? getHistoryTaskId(message.task) : undefined;
          const taskConversationId = message.task
            ? getHistoryTaskConversationId(message.task)
            : undefined;
          const expectedCount = message.task
            ? resolveTaskExpectedCount(message.task)
            : undefined;
          const resultCount = message.task
            ? resolveTaskResultCount(message.task)
            : undefined;
          const referenceImages = message.task
            ? extractTaskReferenceImages(message.task)
            : [];

          pendingGroup = {
            id: taskId || `history-${message.id || index}`,
            publishedImages: taskImages,
            expectedCount,
            resultCount,
            images: referenceImages.length > 0 ? referenceImages : undefined,
            prompt: text,
            responseType: isGeneration ? "generation" : "chat",
            conversationId: taskConversationId || conversationId,
            userMessageId: message.id,
            kind: isGeneration ? "image" : "chat",
            loraModel: isGeneration ? "image" : "chat",
            timestamp: message.task?.updatedAt || timestamp,
            status: isGeneration
              ? normalizeGenerationStatus(
                  (message.task?.status as TaskStatus) || TaskStatus.COMPLETED,
                  resultCount || 0,
                  expectedCount || 1
                )
              : TaskStatus.COMPLETED,
          };
          groups.push(pendingGroup);
          return;
        }

        if (role === "assistant") {
          if (skipNextAssistantGeneration) {
            skipNextAssistantGeneration = false;
            pendingGroup = null;
            return;
          }

          if (
            contentType === "assistant_generation" &&
            contentImages.length === 0 &&
            !message.task &&
            (!pendingGroup ||
              !Array.isArray(pendingGroup.publishedImages) ||
              pendingGroup.publishedImages.every((image) => !image?.url))
          ) {
            if (pendingGroup) {
              const pendingId = pendingGroup.id;
              const pendingUserMessageId = pendingGroup.userMessageId;
              for (let i = groups.length - 1; i >= 0; i -= 1) {
                const candidate = groups[i];
                if (
                  candidate &&
                  (candidate.id === pendingId ||
                    (pendingUserMessageId && candidate.userMessageId === pendingUserMessageId))
                ) {
                  groups.splice(i, 1);
                  break;
                }
              }
            }
            pendingGroup = null;
            return;
          }

          const target =
            pendingGroup && !pendingGroup.assistantMessage
              ? pendingGroup
              : (() => {
                  const orphanGroup: ImageDataGroup = {
                    id: `history-assistant-${message.id || index}`,
                    publishedImages: [],
                    prompt: "",
                    responseType: contentType === "assistant_generation" ? "generation" : "chat",
                    conversationId,
                    kind:
                      contentType === "assistant_generation"
                        ? "image"
                        : "chat",
                    loraModel:
                      contentType === "assistant_generation"
                        ? "image"
                        : "chat",
                    timestamp,
                    status: TaskStatus.COMPLETED,
                  };
                  groups.push(orphanGroup);
                  return orphanGroup;
                })();

          target.assistantMessage = text;
          target.assistantMessageId = message.id;
          target.timestamp = timestamp;

          if (contentType === "assistant_generation") {
            const content = (message.content || {}) as Record<string, unknown>;
            target.responseType = "generation";
            target.kind = String(content.kind || "image") as
              | "image"
              | "video"
              | "audio"
              | "chat";
            target.loraModel = target.kind;
          }

          if (contentImages.length > 0) {
            target.responseType = "generation";
            target.kind = contentImages.some((image) => isVideoUrl(image.url))
              ? "video"
              : "image";
            target.loraModel = target.kind;
            target.publishedImages = buildTaskImageSlots(
              message.id || `history-content-${index}`,
              contentImages,
              contentImages.length
            );
            target.expectedCount = contentImages.length;
            target.resultCount = contentImages.length;
          }

          pendingGroup = null;
        }
      });

      return groups;
    },
    [readHistoryText]
  );


  const mergeConversationGroupsWithLocalState = useCallback(
    (historyGroups: ImageDataGroup[], targetConversationId: string) => {
      const localGroups = imagesRef.current.filter((group) => {
        const sameConversation =
          !group.conversationId || group.conversationId === targetConversationId;
        const isLocalPlaceholder = isLocalPlaceholderGroupId(group.id);
        const isReconnectableGeneration =
          isBackendTaskId(group.id) && RECONNECTABLE_TASK_STATUSES.has(group.status);
        const isActiveChat =
          group.responseType === "chat" &&
          group.status !== TaskStatus.COMPLETED &&
          group.status !== TaskStatus.FAILED;

        return sameConversation && (isLocalPlaceholder || isReconnectableGeneration || isActiveChat);
      });

      return mergeImageGroupCollections([...historyGroups, ...localGroups]).sort((a, b) => {
        const aTime = Date.parse(a.timestamp || "");
        const bTime = Date.parse(b.timestamp || "");

        if (Number.isNaN(aTime) || Number.isNaN(bTime)) return 0;
        return aTime - bTime;
      });
    },
    []
  );

  useEffect(() => {
    promptRef.current = prompt;
    modelRef.current = selectedModel?.id || "";

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [prompt, selectedModel]);

  const loadConversationHistory = useCallback(
    async (targetConversationId: string) => {
      const requestSeq = historyRequestSeqRef.current + 1;
      historyRequestSeqRef.current = requestSeq;

      try {
        let messagesData: unknown = null;
        let historyLoadSucceeded = false;

        window.dispatchEvent(
          new CustomEvent("drawing:conversation-history-loading", {
            detail: {
              conversationId: targetConversationId,
            },
          })
        );

        const messagesRes = await fetch(
          `/api/chat/${encodeURIComponent(targetConversationId)}/messages?limit=100`,
          {
            method: "GET",
            credentials: "include",
          }
        );

        if (messagesRes.ok) {
          messagesData = await messagesRes.json();
          historyLoadSucceeded = true;
        } else {
          console.warn("Failed to load conversation history:", {
            conversationId: targetConversationId,
            chatStatus: messagesRes.status,
          });
        }

        if (historyRequestSeqRef.current !== requestSeq) {
          return;
        }

        const messageList = extractHistoryMessages(messagesData)
          .map((message, index) => ({ message, index }))
          .sort((a, b) => {
            const aTime = Date.parse(a.message.createdAt || a.message.updatedAt || "");
            const bTime = Date.parse(b.message.createdAt || b.message.updatedAt || "");

            if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
              return a.index - b.index;
            }

            if (aTime === bTime) {
              return a.index - b.index;
            }

            return aTime - bTime;
          })
          .map(({ message }) => message);

        conversationIdRef.current = targetConversationId;
        historyLoadedRef.current = true;
        syncConversationUrl(targetConversationId);

        if (messageList.length === 0) {
          const mergedLocalGroups = historyLoadSucceeded
            ? mergeConversationGroupsWithLocalState([], targetConversationId)
            : [];

          if (historyLoadSucceeded) {
            setImages(mergedLocalGroups);
          }
          window.dispatchEvent(
            new CustomEvent("drawing:conversation-history-loaded", {
              detail: {
                conversationId: targetConversationId,
                groupCount: mergedLocalGroups.length,
              },
            })
          );
          return;
        }

        const historyGroups = buildConversationGroups(
          targetConversationId,
          messageList
        );

        if (historyRequestSeqRef.current !== requestSeq) {
          return;
        }
        const resolvedGroups = mergeConversationGroupsWithLocalState(
          historyGroups,
          targetConversationId
        );

        setImages(resolvedGroups);
        window.dispatchEvent(
          new CustomEvent("drawing:conversation-history-loaded", {
            detail: {
              conversationId: targetConversationId,
              groupCount: resolvedGroups.length,
            },
          })
        );
      } catch (error) {
        if (historyRequestSeqRef.current !== requestSeq) {
          return;
        }

        console.error("Failed to load conversation history:", error);
        window.dispatchEvent(
          new CustomEvent("drawing:conversation-history-loaded", {
            detail: {
              conversationId: targetConversationId,
              groupCount: 0,
            },
          })
        );
      }
    },
    [
      buildConversationGroups,
      mergeConversationGroupsWithLocalState,
      setImages,
      syncConversationUrl,
    ]
  );

  useEffect(() => {
    if (freshConversationKey) {
      if (handledFreshKeyRef.current !== freshConversationKey) {
        historyRequestSeqRef.current += 1;
        handledFreshKeyRef.current = freshConversationKey;
        conversationIdRef.current = null;
        historyLoadedRef.current = true;
        setPrompt("");
        if (inputRef.current) {
          inputRef.current.textContent = "";
        }
        setUploadedImages([]);
        setAudioUrl("");
        setAudioFileName("");
        setMotionVideoUrl("");
        setMotionVideoFileName("");
        setSelectedImageForGeneration(null);
        setGenerateType(null);
        setSelectedModel(null);
        setImageCount(1);
        setFormError(null);
        setShowTypeMenu(false);
        setShowModelMenu(false);
        setShowRatioMenu(false);
        setShowCountMenu(false);
        setShowStyleTransferMenu(false);
        setShowModelWarning(false);
        setShowSelectedImageModelWarning(false);
        setSelectedAspectRatioValue("");
        setSelectedResolutionValue("");
        setSelectedDurationValue("");
        onImageToImageModeChange?.(false);
        setImages([]);
        router.replace(pathname, { scroll: false });
      }
      return;
    }

    handledFreshKeyRef.current = null;

    if (!selectedConversationId) {
      // 避免在「剛建立新 conversation、URL 尚未同步」的短暫過渡期把 pending 卡清掉導致閃爍
      if (!historyLoadedRef.current) {
        historyRequestSeqRef.current += 1;
        conversationIdRef.current = null;
        historyLoadedRef.current = true;
        setImages([]);
      }
      return;
    }

    if (
      skipNextHistoryLoadRef.current === selectedConversationId &&
      imagesRef.current.length > 0
    ) {
      skipNextHistoryLoadRef.current = null;
      return;
    }
    skipNextHistoryLoadRef.current = null;

    loadConversationHistory(selectedConversationId);
  }, [
    freshConversationKey,
    loadConversationHistory,
    onImageToImageModeChange,
    pathname,
    router,
    selectedConversationId,
    setImages,
    setSelectedImageForGeneration,
    setSelectedModel,
  ]);

  useEffect(() => {
    const handleShowRemainingPointsToast = (event: CustomEvent<{ points: number }>) => {
      const { points } = event.detail;
      if (points > 0) {
        showToast(t("remaining_points_message", { count: points }), false);
      }
    };

    window.addEventListener('showRemainingPointsToast', handleShowRemainingPointsToast as EventListener);

    return () => {
      window.removeEventListener('showRemainingPointsToast', handleShowRemainingPointsToast as EventListener);
    };
  }, [t]);

  useEffect(() => {
    setShowModelWarning(false);
    setShowSelectedImageModelWarning(false);
  }, [uploadedImages.length, selectedImageForGeneration]);

  const modelIdFromQuery = searchParams.get("modelId");
  useEffect(() => {
    let cancelled = false;

    const fetchCapabilities = async () => {
      try {
        const response = await fetch(
          `/api/models/capabilities?locale=${encodeURIComponent(locale)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Failed to fetch capabilities");
        }

        const data = (await response.json()) as CapabilityResponse;
        if (cancelled) return;

        setCapabilityResponse(data);
        capabilitiesLoadedRef.current = true;

        if (!modelIdFromQuery) return;

        const requestedModelKey = normalizeCapabilityModelKey(modelIdFromQuery);
        const matchedModel = data.media
          .flatMap((item) => item.models)
          .find((model) =>
            capabilityModelKeys(model).some(
              (key) => key === modelIdFromQuery || key === requestedModelKey
            )
          );

        if (matchedModel) {
          const nextType = resolveCapabilitySubmitType(matchedModel.kind);
          if (nextType) {
            setGenerateType(nextType);
          }
          setSelectedModel(matchedModel as unknown as LoraModel);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch capabilities:", error);
        }
      }
    };

    fetchCapabilities();

    return () => {
      cancelled = true;
    };
  }, [locale, modelIdFromQuery, setSelectedModel]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      const isStyleTransferButton =
        desktopStyleTransferButtonRef.current?.contains(target) ||
        mobileStyleTransferButtonRef.current?.contains(target);
      const isStyleTransferMenu = document
        .querySelector("[data-style-transfer-menu]")
        ?.contains(target);

      if (!isStyleTransferButton && !isStyleTransferMenu) {
        setShowStyleTransferMenu(false);
      }

      const isRatioButton =
        desktopRatioButtonRef.current?.contains(target) ||
        mobileRatioButtonRef.current?.contains(target);
      const isRatioMenu = document
        .querySelector("[data-ratio-menu]")
        ?.contains(target);

      if (!isRatioButton && !isRatioMenu) {
        setShowRatioMenu(false);
      }

      const isCountButton =
        desktopCountButtonRef.current?.contains(target) ||
        mobileCountButtonRef.current?.contains(target);
      const isCountMenu = document
        .querySelector("[data-count-menu]")
        ?.contains(target);

      if (!isCountButton && !isCountMenu) {
        setShowCountMenu(false);
      }

      const isTypeButton =
        typeButtonRef.current?.contains(target);
      const isTypeMenu = document
        .querySelector("[data-type-menu]")
        ?.contains(target);

      if (!isTypeButton && !isTypeMenu) {
        setShowTypeMenu(false);
      }

      const isModelButton = modelButtonRef.current?.contains(target);
      const isModelMenu = document
        .querySelector("[data-model-menu]")
        ?.contains(target);

      if (!isModelButton && !isModelMenu) {
        setShowModelMenu(false);
      }

    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsLoadingModelMenu(false);
  }, [capabilityResponse]);

  useEffect(() => {
    if (!selectedCapabilitySubmitType) return;

    if (generateType && !areSubmitTypesCompatible(selectedCapabilitySubmitType, generateType)) {
      setSelectedModel(null);
    }
  }, [
    generateType,
    selectedCapabilitySubmitType,
    setSelectedModel,
  ]);

  useEffect(() => {
    if (generateType !== null) return;
    if (!selectedModel) return;
    const nextType = resolveCapabilitySubmitType(selectedCapabilityModel?.kind);
    if (!nextType) return;

    setGenerateType(nextType);
  }, [generateType, selectedModel, selectedCapabilityModel?.kind]);

  useEffect(() => {
    // 只在「模型/模式切換」時初始化一次，避免使用者點選後又被重置。
    const initKey = [
      generateType || "chat",
      selectedCapabilityModel?.id || selectedCapabilityModel?.modelId || "no-model",
    ].join(":");

    if (lastParamInitKeyRef.current === initKey) {
      return;
    }
    lastParamInitKeyRef.current = initKey;

    const nextAspectRatioValue =
      aspectRatioParam?.default === null
        ? ""
        : String(aspectRatioParam?.default || aspectRatioOptions[0]?.value || "");
    const nextResolutionValue =
      generateType === "image"
        ? clampImageResolutionValue(
            String(resolutionParam?.default || resolutionOptions[0]?.value || ""),
            resolutionOptions
          )
        : String(resolutionParam?.default || resolutionOptions[0]?.value || "");
    const nextDurationValue =
      String(durationParam?.default || durationOptions[0]?.value || "");
    const defaultImageCount = Math.max(1, Number(countParam?.default) || 1);
    const nextImageCount = (
      countOptions.includes(defaultImageCount as (typeof GENERATE_IMAGE_COUNTS)[number])
        ? defaultImageCount
        : countOptions[0] || 1
    ) as (typeof GENERATE_IMAGE_COUNTS)[number];
    const nextDynamicParamValues = (selectedCapabilityModel?.params || []).reduce<
      Record<string, string | number | boolean>
    >((acc, param) => {
      if (
        param.type === "boolean" &&
        typeof param.default === "boolean"
      ) {
        acc[param.key] = param.default;
      }
      return acc;
    }, {});

    setSelectedAspectRatioValue(nextAspectRatioValue);
    setSelectedResolutionValue(nextResolutionValue);
    setSelectedDurationValue(nextDurationValue);
    setImageCount(nextImageCount);
    setDynamicParamValues(nextDynamicParamValues);
  }, [
    aspectRatioOptions,
    aspectRatioParam,
    countParam,
    countOptions,
    durationOptions,
    durationParam,
    generateType,
    resolutionOptions,
    resolutionParam,
    selectedCapabilityModel?.id,
    selectedCapabilityModel?.modelId,
    selectedCapabilityModel?.params,
  ]);

  useEffect(() => {
    if (generateType !== "image" || !resolutionParam) return;

    const safeValue = clampImageResolutionValue(selectedResolutionValue, resolutionOptions);
    if (safeValue !== selectedResolutionValue) {
      setSelectedResolutionValue(safeValue);
    }
  }, [generateType, resolutionOptions, resolutionParam, selectedResolutionValue]);

  const isReconnectableGroup = useCallback((groupId: string | null, conversationId?: string | null) => {
    if (!isBackendTaskId(groupId)) return false;
    const group = imagesRef.current.find((item) =>
      item.id === groupId &&
      (!conversationId || !item.conversationId || item.conversationId === conversationId)
    );
    if (!group) return false;
    return RECONNECTABLE_TASK_STATUSES.has(group.status);
  }, []);

  const isReconnectableChatGroup = useCallback(
    (groupId: string | null, conversationId?: string | null) => {
      if (!groupId) return false;

      const group = imagesRef.current.find(
        (item) =>
          item.id === groupId &&
          item.responseType === "chat" &&
          (!conversationId || !item.conversationId || item.conversationId === conversationId)
      );

      if (!group) return false;
      return group.status !== TaskStatus.COMPLETED && group.status !== TaskStatus.FAILED;
    },
    []
  );

  const cleanupSSE = useCallback(() => {
    const state = connectionStateRef.current;
    const hasActiveTask = Boolean(state.currentTaskId);
    const hasConnection =
      Boolean(eventSourceRef.current) ||
      Boolean(heartbeatTimerRef.current) ||
      Boolean(reconnectTimerRef.current) ||
      state.isConnected ||
      state.isConnecting;

    if (!hasActiveTask && !hasConnection) {
      return;
    }

    console.log(`🧹 Cleaning up SSE connection for task: ${state.currentTaskId}`);

    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (eventSourceRef.current) {
      try {
        eventSourceRef.current.close();
      } catch (error) {
        console.warn("Error closing EventSource:", error);
      }
      eventSourceRef.current = null;
    }

    const lastEventId = state.lastEventId;
    connectionStateRef.current = {
      isConnecting: false,
      isConnected: false,
      currentTaskId: null,
      userId: null,
      reconnectAttempt: 0,
      lastEventId: lastEventId,
    };
  }, []);

  const stopTaskPolling = useCallback((taskId?: string | null) => {
    if (!taskId) return;

    const timer = taskPollingTimersRef.current[taskId];
    if (timer) {
      clearTimeout(timer);
      delete taskPollingTimersRef.current[taskId];
    }
    delete taskPollingStartedAtRef.current[taskId];
  }, []);

  const stopAllTaskPolling = useCallback(() => {
    Object.values(taskPollingTimersRef.current).forEach((timer) => {
      clearTimeout(timer);
    });
    taskPollingTimersRef.current = {};
    taskPollingStartedAtRef.current = {};
  }, []);

  const hasOtherReconnectableTask = useCallback((taskId: string) => {
    return imagesRef.current.some(
      (group) =>
        group.id !== taskId &&
        isBackendTaskId(group.id) &&
        RECONNECTABLE_TASK_STATUSES.has(group.status)
    );
  }, []);

  const handleDiscardedTask = useCallback(
    (discardedTaskId: string, payload: unknown) => {
      if (!discardedTaskId) {
        return;
      }

      stopTaskPolling(discardedTaskId);
      removeImage(discardedTaskId);
      delete taskExpectedCountRef.current[discardedTaskId];
      if (connectionStateRef.current.currentTaskId === discardedTaskId) {
        cleanupSSE();
      }
      if (!hasOtherReconnectableTask(discardedTaskId)) {
        setIsGenerating(false);
      }

      if (discardedTaskToastRef.current.has(discardedTaskId)) {
        return;
      }

      discardedTaskToastRef.current.add(discardedTaskId);
      showToast(
        getTaskFailureMessage(payload) ||
          (locale === "zh-TW"
            ? "影片生成超過 5 分鐘，已作廢，請重試。"
            : locale === "ja"
              ? "動画生成が5分を超えたため破棄されました。もう一度お試しください。"
              : "Video generation exceeded 5 minutes and was discarded. Please try again.")
      );
    },
    [cleanupSSE, hasOtherReconnectableTask, locale, removeImage, setIsGenerating, stopTaskPolling]
  );

  const handleFailedTask = useCallback(
    (failedTaskId: string, payload: unknown) => {
      if (!failedTaskId) {
        return;
      }

      const failureMessage =
        getTaskFailureMessage(payload) ||
        (locale === "zh-TW"
          ? "生成失敗，請調整內容後再試一次。"
          : locale === "ja"
            ? "生成に失敗しました。内容を調整してもう一度お試しください。"
            : "Generation failed. Please adjust your prompt and try again.");
      const existingGroup = imagesRef.current.find((group) => group.id === failedTaskId);

      stopTaskPolling(failedTaskId);
      removeImage(`pending-${failedTaskId}`);
      removeImage(`retry-${failedTaskId}`);

      if (groupHasRenderableMedia(existingGroup)) {
        updateImage(failedTaskId, {
          ...existingGroup!,
          id: failedTaskId,
          status: TaskStatus.FAILED,
          failureMessage,
          resultCount: existingGroup?.resultCount || existingGroup?.publishedImages?.filter((image) => Boolean(image?.url)).length || 0,
        });
      } else {
        removeImage(failedTaskId);
      }

      delete taskExpectedCountRef.current[failedTaskId];
      if (connectionStateRef.current.currentTaskId === failedTaskId) {
        cleanupSSE();
      }
      if (!hasOtherReconnectableTask(failedTaskId)) {
        setIsGenerating(false);
      }

      if (failedTaskToastRef.current.has(failedTaskId)) {
        return;
      }

      failedTaskToastRef.current.add(failedTaskId);
      showToast(failureMessage, true);
    },
    [cleanupSSE, hasOtherReconnectableTask, locale, removeImage, setIsGenerating, stopTaskPolling, updateImage]
  );

  const applyTaskPayload = useCallback(
    (payload: unknown, fallbackTaskId?: string): boolean => {
      if (!payload || typeof payload !== "object") {
        return false;
      }

      const task = payload as TaskRuntimePayload;
      const taskId = getRuntimeTaskId(task) || fallbackTaskId || "";
      if (!taskId) return false;

      const mediaCandidates = extractTaskMediaCandidates(task);
      const resultCount = resolveTaskResultCount(task);
      const partialFinal = isTaskPartialCompleteFinal(task);
      const existingExpected = taskExpectedCountRef.current[taskId];
      const expectedCount = partialFinal
        ? Math.max(1, resultCount, mediaCandidates.length)
        : Math.max(resolveTaskExpectedCount(task), existingExpected || 0);
      const updatedImages = buildTaskImageSlots(
        taskId,
        mediaCandidates,
        expectedCount
      );
      const status = (task.status as TaskStatus) || TaskStatus.PROMPT_DELIVERING;
      const normalizedStatus = partialFinal
        ? TaskStatus.COMPLETED
        : normalizeGenerationStatus(
          status,
          resultCount,
          expectedCount
        );
      const done =
        partialFinal ||
        (normalizedStatus === TaskStatus.COMPLETED && resultCount >= expectedCount) ||
        normalizedStatus === TaskStatus.FAILED ||
        resultCount >= expectedCount;

      if (isTaskDiscardPayload(task)) {
        handleDiscardedTask(taskId, task);
        return true;
      }

      if (normalizedStatus === TaskStatus.FAILED) {
        handleFailedTask(taskId, task);
        return true;
      }

      const existingGroup = imagesRef.current.find((group) => group.id === taskId);
      updateImage(taskId, {
        id: taskId,
        publishedImages: updatedImages,
        expectedCount,
        resultCount,
        prompt: task.prompt || existingGroup?.prompt || promptRef.current,
        loraModel: resolveTaskLoraModel(task) || existingGroup?.loraModel || modelRef.current,
        timestamp: new Date(task.updatedAt || task.createdAt || Date.now()).toISOString(),
        conversationId:
          getRuntimeTaskConversationId(task) ||
          existingGroup?.conversationId ||
          conversationIdRef.current ||
          undefined,
        discardRecommended: task.discardRecommended,
        terminalAction: task.terminalAction,
        failureCode: task.failureCode || task.failure?.code,
        failureMessage: getTaskFailureMessage(task) || existingGroup?.failureMessage,
        activeResultIndex:
          !partialFinal && resultCount < expectedCount ? resultCount : undefined,
        status: done ? TaskStatus.COMPLETED : normalizedStatus,
      });

      if (done) {
        delete taskExpectedCountRef.current[taskId];
        stopTaskPolling(taskId);
        setIsGenerating(false);
        if (connectionStateRef.current.currentTaskId === taskId) {
          cleanupSSE();
        }
      }

      return done;
    },
    [
      cleanupSSE,
      handleDiscardedTask,
      handleFailedTask,
      setIsGenerating,
      stopTaskPolling,
      updateImage,
    ]
  );

  const applyProgressPayload = useCallback(
    (payload: unknown, fallbackTaskId?: string) => {
      if (!payload || typeof payload !== "object") return;

      const event = payload as GenerationProgressPayload;
      const taskId = event.taskId || fallbackTaskId || "";
      if (!taskId) return;

      const existingGroup = imagesRef.current.find((group) => group.id === taskId);
      if (!existingGroup) return;

      const nextPublishedImages = [...(existingGroup.publishedImages || [])];
      if (event.resultUrl) {
        const resultIndex =
          typeof event.resultIndex === "number"
            ? event.resultIndex
            : Math.max(0, event.resultCount || nextPublishedImages.length || 1) - 1;
        nextPublishedImages[resultIndex] = {
          id: `${taskId}_${resultIndex}`,
          publishedImageId:
            nextPublishedImages[resultIndex]?.publishedImageId || "",
          shortId: nextPublishedImages[resultIndex]?.shortId,
          url: normalizeMediaUrl(event.resultUrl),
          userReaction: nextPublishedImages[resultIndex]?.userReaction || {
            like: false,
            dislike: false,
            collecting: false,
            comment: "",
          },
          reactions: nextPublishedImages[resultIndex]?.reactions || {
            likes: 0,
            dislikes: 0,
            collections: 0,
          },
        };
      }

      const visibleResultCount = nextPublishedImages.filter((image) => Boolean(image?.url)).length;
      const rawExpectedCount = event.expectedCount || existingGroup.expectedCount || 1;
      const progressHasMedia = Boolean(event.resultUrl);
      const progressSaysCompleted =
        event.phase === "completed" ||
        event.phase === "provider_completed" ||
        event.status === "completed";
      const completedProgressWithoutMedia =
        progressSaysCompleted && !progressHasMedia && visibleResultCount < rawExpectedCount;
      const nextResultCount =
        (progressHasMedia ? event.resultCount : undefined) ||
        visibleResultCount ||
        (completedProgressWithoutMedia ? 0 : existingGroup.resultCount) ||
        0;
      const partialFinal = event.phase === "provider_partial_final";
      const nextExpectedCount = partialFinal
        ? Math.max(1, nextResultCount)
        : rawExpectedCount;
      const requestedStatus =
        partialFinal
          ? TaskStatus.COMPLETED
          : event.phase === "partial_result"
            ? TaskStatus.PARTIAL_COMPLETE
            : completedProgressWithoutMedia
              ? existingGroup.status
              : progressSaysCompleted
                ? TaskStatus.COMPLETED
                : event.phase === "failed" || event.status === "failed"
                  ? TaskStatus.FAILED
                  : existingGroup.status;
      const nextStatus = partialFinal
        ? TaskStatus.COMPLETED
        : normalizeGenerationStatus(
          requestedStatus,
          nextResultCount,
          nextExpectedCount
        );

      if (nextStatus === TaskStatus.FAILED) {
        handleFailedTask(taskId, event);
        return;
      }

      updateImage(taskId, {
        ...existingGroup,
        id: taskId,
        publishedImages: partialFinal
          ? nextPublishedImages.filter((image) => Boolean(image?.url)).slice(0, nextExpectedCount)
          : nextPublishedImages,
        expectedCount: nextExpectedCount,
        resultCount: nextResultCount,
        currentPhase: event.phase || existingGroup.currentPhase,
        currentLabel: event.label || event.detail || existingGroup.currentLabel,
        activeResultIndex:
          partialFinal
            ? undefined
            : typeof event.resultIndex === "number"
              ? event.resultIndex
              : nextResultCount < nextExpectedCount
                ? nextResultCount
                : undefined,
        progressPercent:
          typeof event.progressPercent === "number"
            ? event.progressPercent
            : existingGroup.progressPercent,
        progressTrail: appendProgressTrail(existingGroup.progressTrail, event),
        status: nextStatus,
      });

      const hasAllVisibleResults = visibleResultCount >= nextExpectedCount;
      const done =
        partialFinal ||
        hasAllVisibleResults ||
        (nextStatus === TaskStatus.COMPLETED && hasAllVisibleResults);

      if (done) {
        delete taskExpectedCountRef.current[taskId];
        stopTaskPolling(taskId);
        setIsGenerating(false);
        if (connectionStateRef.current.currentTaskId === taskId) {
          cleanupSSE();
        }
      }
    },
    [cleanupSSE, handleFailedTask, setIsGenerating, stopTaskPolling, updateImage]
  );

  const startTaskStatusPolling = useCallback(
    (taskId: string, reason: string) => {
      if (!isBackendTaskId(taskId) || taskPollingTimersRef.current[taskId]) {
        return;
      }

      taskPollingStartedAtRef.current[taskId] ||= Date.now();
      let attempt = 0;

      const schedule = (delay: number) => {
        taskPollingTimersRef.current[taskId] = setTimeout(poll, delay);
      };

      const poll = async () => {
        delete taskPollingTimersRef.current[taskId];

        if (!isReconnectableGroup(taskId, conversationIdRef.current)) {
          stopTaskPolling(taskId);
          const hasReconnectableTask = imagesRef.current.some((group) =>
            isBackendTaskId(group.id) && RECONNECTABLE_TASK_STATUSES.has(group.status)
          );
          if (!hasReconnectableTask) {
            setIsGenerating(false);
          }
          return;
        }

        const startedAt = taskPollingStartedAtRef.current[taskId] || Date.now();
        const elapsedMs = Date.now() - startedAt;
        const currentGroup = imagesRef.current.find((group) => group.id === taskId);
        const timeoutMs = currentGroup?.kind === "video"
          ? 10 * 60 * 1000
          : 3 * 60 * 1000;

        if (elapsedMs > timeoutMs) {
          handleFailedTask(taskId, {
            id: taskId,
            status: TaskStatus.FAILED,
            failureMessage:
              locale === "zh-TW"
                ? "生成等待逾時，請重新送出。"
                : locale === "ja"
                  ? "生成の待機時間が超過しました。もう一度お試しください。"
                  : "Generation timed out. Please retry.",
          });
          return;
        }

        try {
          const res = await fetch(`/api/task/${encodeURIComponent(taskId)}/status`, {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          });

          if (res.status === 410) {
            const data = await res.json().catch(() => ({}));
            handleDiscardedTask(taskId, data);
            return;
          }

          if (res.ok) {
            const data = await res.json();
            const done = applyTaskPayload(data, taskId);
            if (done) return;
          } else if (res.status === 404) {
            handleFailedTask(taskId, {
              id: taskId,
              status: TaskStatus.FAILED,
              failureMessage:
                locale === "zh-TW"
                  ? "找不到這筆生成任務，請重新送出。"
                  : locale === "ja"
                    ? "この生成タスクが見つかりません。もう一度お試しください。"
                    : "This generation task was not found. Please retry.",
            });
            return;
          }
        } catch (error) {
          console.warn(`Task polling failed (${reason}):`, error);
        }

        attempt += 1;
        schedule(Math.min(2000 + attempt * 1000, 10000));
      };

      schedule(0);
    },
    [
      applyTaskPayload,
      handleDiscardedTask,
      handleFailedTask,
      isReconnectableGroup,
      locale,
      setIsGenerating,
      stopTaskPolling,
    ]
  );

  const cleanupChatSSE = useCallback(() => {
    if (chatRevealTimerRef.current) {
      clearInterval(chatRevealTimerRef.current);
      chatRevealTimerRef.current = null;
    }

    if (chatEventSourceRef.current) {
      try {
        chatEventSourceRef.current.close();
      } catch (error) {
        console.warn("Error closing chat EventSource:", error);
      }
      chatEventSourceRef.current = null;
    }
  }, []);

  const updateChatBubble = useCallback(
    ({
      groupId,
      conversationId,
      fallbackPrompt,
      assistantMessage,
      assistantMessageId,
      status,
    }: {
      groupId: string;
      conversationId: string;
      fallbackPrompt: string;
      assistantMessage: string;
      assistantMessageId?: string;
      status: TaskStatus;
    }) => {
      chatDraftsRef.current[groupId] = assistantMessage;

      if (
        status === TaskStatus.COMPLETED &&
        activeChatStreamRef.current.groupId === groupId
      ) {
        activeChatStreamRef.current = {
          conversationId: null,
          groupId: null,
          fallbackPrompt: "",
          assistantMessageId: undefined,
        };
      }

      updateImage(groupId, {
        id: groupId,
        publishedImages: [],
        prompt: fallbackPrompt,
        assistantMessage,
        assistantMessageId,
        responseType: "chat",
        conversationId,
        loraModel: "chat",
        timestamp: new Date().toISOString(),
        status,
        kind: "chat",
      });
    },
    [updateImage]
  );

  const revealChatMessage = useCallback(
    ({
      groupId,
      conversationId,
      fallbackPrompt,
      targetText,
      assistantMessageId,
      completeOnFinish = true,
      append = false,
    }: {
      groupId: string;
      conversationId: string;
      fallbackPrompt: string;
      targetText: string;
      assistantMessageId?: string;
      completeOnFinish?: boolean;
      append?: boolean;
    }) => {
      if (!targetText) return;

      if (chatRevealTimerRef.current) {
        clearInterval(chatRevealTimerRef.current);
        chatRevealTimerRef.current = null;
      }

      const previousText = chatDraftsRef.current[groupId] || "";
      const fullText = append ? `${previousText}${targetText}` : targetText;

      if (fullText === previousText) {
        updateChatBubble({
          groupId,
          conversationId,
          fallbackPrompt,
          assistantMessage: fullText,
          assistantMessageId,
          status: completeOnFinish ? TaskStatus.COMPLETED : TaskStatus.PROMPT_DELIVERING,
        });
        return;
      }

      let nextIndex =
        fullText.startsWith(previousText) && previousText.length < fullText.length
          ? previousText.length
          : 0;

      if (nextIndex === 0) {
        updateChatBubble({
          groupId,
          conversationId,
          fallbackPrompt,
          assistantMessage: "",
          assistantMessageId,
          status: TaskStatus.PROMPT_DELIVERING,
        });
      }

      chatRevealTimerRef.current = setInterval(() => {
        const step = Math.max(1, Math.ceil((fullText.length - nextIndex) / 18));
        nextIndex = Math.min(fullText.length, nextIndex + step);

        updateChatBubble({
          groupId,
          conversationId,
          fallbackPrompt,
          assistantMessage: fullText.slice(0, nextIndex),
          assistantMessageId,
          status:
            nextIndex >= fullText.length && completeOnFinish
              ? TaskStatus.COMPLETED
              : TaskStatus.PROMPT_DELIVERING,
        });

        if (nextIndex >= fullText.length && chatRevealTimerRef.current) {
          clearInterval(chatRevealTimerRef.current);
          chatRevealTimerRef.current = null;
        }
      }, 18);
    },
    [updateChatBubble]
  );

  useEffect(() => {
    return () => {
      cleanupSSE();
      cleanupChatSSE();
      stopAllTaskPolling();
    };
  }, [cleanupSSE, cleanupChatSSE, stopAllTaskPolling]);

  useEffect(() => {
    const resetToNewConversation = () => {
      historyRequestSeqRef.current += 1;
      conversationIdRef.current = null;
      historyLoadedRef.current = true;
      skipNextHistoryLoadRef.current = null;
      handledFreshKeyRef.current = null;
      activeChatStreamRef.current = {
        conversationId: null,
        groupId: null,
        fallbackPrompt: "",
        assistantMessageId: undefined,
      };
      chatDraftsRef.current = {};
      chatLastEventIdsRef.current = {};
      taskExpectedCountRef.current = {};
      autoReconnectedTaskIdsRef.current.clear();

      cleanupSSE();
      cleanupChatSSE();
      stopAllTaskPolling();
      syncConversationUrl(null);

      setPrompt("");
      if (inputRef.current) {
        inputRef.current.textContent = "";
      }
      setUploadedImages([]);
      setAudioUrl("");
      setAudioFileName("");
      setMotionVideoUrl("");
      setMotionVideoFileName("");
      setSelectedImageForGeneration(null);
      setGenerateType(null);
      setSelectedModel(null);
      setImageCount(1);
      setFormError(null);
      setShowTypeMenu(false);
      setShowModelMenu(false);
      setShowRatioMenu(false);
      setShowStyleTransferMenu(false);
      setShowModelWarning(false);
      setShowSelectedImageModelWarning(false);
      setSelectedAspectRatioValue("");
      setSelectedResolutionValue("");
      setSelectedDurationValue("");
      setIsGenerating(false);
      onImageToImageModeChange?.(false);
      setImages([]);
    };

    window.addEventListener("drawing:new-conversation", resetToNewConversation);
    return () => {
      window.removeEventListener("drawing:new-conversation", resetToNewConversation);
    };
  }, [
    cleanupChatSSE,
    cleanupSSE,
    onImageToImageModeChange,
    setIsGenerating,
    setImages,
    setSelectedImageForGeneration,
    setSelectedModel,
    stopAllTaskPolling,
    syncConversationUrl,
  ]);

  useEffect(() => {
    if (onImageToImageModeChange) {
      const isImageToImageMode = !!(
        uploadedImages.length > 0 || selectedImageForGeneration
      );
      onImageToImageModeChange(isImageToImageMode);
    }
    // 🌟 關鍵：拔掉 onImageToImageModeChange 與物件依賴，改用布林值判斷
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImages.length, !!selectedImageForGeneration]);

  useEffect(() => {
    if (selectedImageForGeneration && uploadedImages.length > 0) {
      setUploadedImages([]);
      setShowModelWarning(false);
      showToast(t("toast.switched_to_gallery_image") || "已切換為圖庫圖片，已移除上傳圖片");
    }
  }, [selectedImageForGeneration, uploadedImages.length, t]);

  useEffect(() => {
    if (generateType === "image" || generateType === "audio") {
      if (audioUrl) {
        setAudioUrl("");
        setAudioFileName("");
      }
      if (motionVideoUrl) {
        setMotionVideoUrl("");
        setMotionVideoFileName("");
      }
    }
  }, [audioUrl, generateType, motionVideoUrl]);

  const hasSelectedGalleryImage = Boolean(selectedImageForGeneration);

  useEffect(() => {
    if (generateType !== "video") return;

    if (!canAttachAudio && audioUrl) {
      setAudioUrl("");
      setAudioFileName("");
    }

    if (!canAttachMotionVideo && motionVideoUrl) {
      setMotionVideoUrl("");
      setMotionVideoFileName("");
    }

    if (
      !isImageFaceSwapMode &&
      !isVideoFaceSwapMode &&
      !selectedModelSupportsImageInput &&
      (uploadedImages.length > 0 || hasSelectedGalleryImage)
    ) {
      setUploadedImages([]);
      setSelectedImageForGeneration(null);
    }
  }, [
    audioUrl,
    canAttachAudio,
    canAttachMotionVideo,
    generateType,
    motionVideoUrl,
    uploadedImages.length,
    hasSelectedGalleryImage,
    isImageFaceSwapMode,
    isVideoFaceSwapMode,
    selectedModelSupportsImageInput,
    setSelectedImageForGeneration,
  ]);
  const hasAttachedMedia = !!(
    selectedImageForGeneration ||
    uploadedImages.length > 0 ||
    audioUrl ||
    motionVideoUrl ||
    pendingReferenceCount > 0 ||
    isUploadingReferences
  );
  const hasReferenceImages = !!(
    selectedImageForGeneration ||
    uploadedImages.length > 0 ||
    pendingReferenceCount > 0 ||
    isUploadingReferences
  );

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent || "";
    setPrompt(text);
    setFormError((prev) => {
      if (!prev || !prev.missingFields.includes("prompt")) return prev;
      return {
        ...prev,
        missingFields: prev.missingFields.filter((field) => field !== "prompt"),
        message: "",
      };
    });
  };

  const resetComposer = useCallback(() => {
    setPrompt("");
    if (inputRef.current) {
      inputRef.current.textContent = "";
      inputRef.current.innerHTML = "";
    }
  }, []);

  useEffect(() => {
    const handleApplyPromptTemplate = (
      event: Event
    ) => {
      const customEvent = event as CustomEvent<{
        prompt?: string;
        type?: SubmitType;
      }>;

      const nextPrompt = customEvent.detail?.prompt || "";
      const nextType =
        customEvent.detail?.type === undefined ? generateType : customEvent.detail.type;

      setGenerateType(nextType ?? null);
      if (
        nextType &&
        selectedCapabilitySubmitType &&
        !areSubmitTypesCompatible(selectedCapabilitySubmitType, nextType)
      ) {
        setSelectedModel(null);
      }
      setPrompt(nextPrompt);
      setFormError(null);

      if (inputRef.current) {
        inputRef.current.textContent = nextPrompt;
        inputRef.current.focus();

        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          const range = document.createRange();
          range.selectNodeContents(inputRef.current);
          range.collapse(false);
          selection.addRange(range);
        }
      }
    };

    window.addEventListener(
      "drawing:apply-prompt-template",
      handleApplyPromptTemplate as EventListener
    );

    return () => {
      window.removeEventListener(
        "drawing:apply-prompt-template",
        handleApplyPromptTemplate as EventListener
      );
    };
  }, [generateType, selectedCapabilitySubmitType, setSelectedModel]);

  useEffect(() => {
    const templateType = initialTemplate?.type ?? null;
    const templatePrompt = initialTemplate?.prompt?.trim() || "";
    const templateAspectRatio = initialTemplate?.aspectRatio;
    const templateCount = Number(initialTemplate?.count) || 0;
    const templateSelectedImageUrl = initialTemplate?.selectedImageUrl || "";

    const hasTemplatePayload = Boolean(
      templateType ||
        templatePrompt ||
        templateAspectRatio ||
        templateCount ||
        templateSelectedImageUrl
    );

    if (!hasTemplatePayload) {
      return;
    }

    const templateKey = JSON.stringify({
      type: templateType,
      prompt: templatePrompt,
      aspectRatio: templateAspectRatio,
      count: templateCount,
      selectedImageUrl: templateSelectedImageUrl,
    });

    if (appliedTemplateKeyRef.current === templateKey) {
      return;
    }
    appliedTemplateKeyRef.current = templateKey;

    setGenerateType(templateType);
    setFormError(null);

    if (templatePrompt) {
      setPrompt(templatePrompt);
      if (inputRef.current) {
        inputRef.current.textContent = templatePrompt;
      }
    }

    if (templateAspectRatio) {
      setSelectedAspectRatioValue(templateAspectRatio);
    }

    if (templateType === "image" && templateCount > 0) {
      const nextCount = Math.min(
        Math.max(1, templateCount),
        Math.max(...GENERATE_IMAGE_COUNTS)
      ) as (typeof GENERATE_IMAGE_COUNTS)[number];
      setImageCount(nextCount);
    }

    if (templateSelectedImageUrl) {
      setSelectedImageForGeneration({
        publishedImageId: "template-selected-image",
        url: templateSelectedImageUrl,
        groupIndex: -1,
        imageIndex: -1,
      });
    }
  }, [initialTemplate, setSelectedImageForGeneration]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || isComposing) {
      return;
    }

    // Gemini-like behavior:
    // - Enter: submit (never insert newline)
    // - Shift+Enter: newline
    if (!event.shiftKey) {
      event.preventDefault();
      if (!canSubmit) return;
      if (formRef.current) {
        if (typeof formRef.current.requestSubmit === "function") {
          formRef.current.requestSubmit();
        } else {
          formRef.current.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
          );
        }
      }
    }
  };

  const startHeartbeatMonitor = useCallback((taskId: string) => {
    const HEARTBEAT_TIMEOUT = 15000;

    if (heartbeatTimerRef.current) {
      clearTimeout(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setTimeout(() => {
      console.warn(`⏰ 心跳超時 (${taskId})，主動觸發重連`);
      const state = connectionStateRef.current;
      if (state.currentTaskId === taskId && eventSourceRef.current) {
        startTaskStatusPolling(taskId, "sse-heartbeat-timeout");
        eventSourceRef.current.close();
      }
    }, HEARTBEAT_TIMEOUT);
  }, [startTaskStatusPolling]);

  const resetHeartbeatMonitor = useCallback(
    (taskId: string) => {
      if (connectionStateRef.current.currentTaskId === taskId) {
        startHeartbeatMonitor(taskId);
      }
    },
    [startHeartbeatMonitor]
  );

  const setupChatSSE = useCallback(
    async ({
      conversationId,
      groupId,
      fallbackPrompt,
      assistantMessageId,
    }: {
      conversationId: string;
      groupId: string;
      fallbackPrompt: string;
      assistantMessageId?: string;
    }) => {
      if (!conversationId) return;

      activeChatStreamRef.current = {
        conversationId,
        groupId,
        fallbackPrompt,
        assistantMessageId,
      };

      cleanupChatSSE();

      const parseChatPayload = (
        payload: unknown
      ): {
        role?: string;
        messageId?: string;
        fullText?: string;
        deltaText?: string;
      } => {
        if (!payload || typeof payload !== "object") return {};
        const data = payload as Record<string, unknown>;

        const directMessage =
          data.message && typeof data.message === "object"
            ? (data.message as Record<string, unknown>)
            : null;
        const content =
          directMessage?.content && typeof directMessage.content === "object"
            ? (directMessage.content as Record<string, unknown>)
            : data.content && typeof data.content === "object"
              ? (data.content as Record<string, unknown>)
              : null;

        const fullText =
          typeof data.content === "string"
            ? data.content
            : typeof content?.text === "string"
              ? content.text
              : typeof directMessage?.content === "string"
                ? directMessage.content
                : typeof data.text === "string"
                  ? data.text
                  : undefined;

        const deltaText =
          typeof data.delta === "string"
            ? data.delta
            : typeof data.chunk === "string"
              ? data.chunk
              : undefined;

        return {
          role:
            typeof directMessage?.role === "string"
              ? directMessage.role
              : typeof data.role === "string"
                ? data.role
                : typeof content?.role === "string"
                  ? content.role
                  : undefined,
          messageId:
            typeof directMessage?.id === "string"
              ? directMessage.id
              : typeof data.id === "string"
                ? data.id
                : undefined,
          fullText,
          deltaText,
        };
      };

      const createChatStreamUrl = () => {
        const url = new URL("/api/chat-sse/stream", window.location.origin);
        url.searchParams.set("conversationId", conversationId);
        const lastChatEventId = chatLastEventIdsRef.current[conversationId];
        if (lastChatEventId) {
          url.searchParams.set("after", lastChatEventId);
        }
        return url.toString();
      };

      let reconnectAttempt = 0;
      const maxReconnectAttempts = 5;
      const connectChatSSE = () => {
        try {
          const currentActive = activeChatStreamRef.current;
          if (
            currentActive.conversationId !== conversationId ||
            currentActive.groupId !== groupId
          ) {
            return;
          }

        const es = new EventSource(createChatStreamUrl(), { withCredentials: true });
        chatEventSourceRef.current = es;

        const handleEvent = (e: MessageEvent) => {
          try {
            if (e.lastEventId) {
              chatLastEventIdsRef.current[conversationId] = e.lastEventId;
            }

            const payload = JSON.parse(e.data);
            const parsed = parseChatPayload(payload);

            if (parsed.role && parsed.role !== "assistant") {
              return;
            }

            if (parsed.messageId && assistantMessageId && parsed.messageId !== assistantMessageId) {
              return;
            }

            if (parsed.deltaText) {
              revealChatMessage({
                groupId,
                conversationId,
                fallbackPrompt,
                targetText: parsed.deltaText,
                assistantMessageId: parsed.messageId || assistantMessageId,
                completeOnFinish: false,
                append: true,
              });
              return;
            }

            if (parsed.fullText) {
              revealChatMessage({
                groupId,
                conversationId,
                fallbackPrompt,
                targetText: parsed.fullText,
                assistantMessageId: parsed.messageId || assistantMessageId,
                completeOnFinish: true,
              });
            }
          } catch (error) {
            console.error("Error parsing chat SSE payload:", error);
          }
        };

        const handleProgressEvent = (e: MessageEvent) => {
          try {
            if (e.lastEventId) {
              chatLastEventIdsRef.current[conversationId] = e.lastEventId;
            }

            const event = JSON.parse(e.data) as GenerationProgressPayload;
            const existingGroup = imagesRef.current.find((group) => group.id === groupId);
            updateImage(groupId, {
              ...(existingGroup || {}),
              id: groupId,
              publishedImages: existingGroup?.publishedImages || [],
              prompt: existingGroup?.prompt || fallbackPrompt,
              assistantMessage: existingGroup?.assistantMessage || "",
              responseType: "chat",
              conversationId: event.conversationId || conversationId,
              kind: "chat",
              loraModel: existingGroup?.loraModel || "chat",
              timestamp: existingGroup?.timestamp || new Date().toISOString(),
              status: TaskStatus.PROMPT_DELIVERING,
              currentPhase: event.phase || existingGroup?.currentPhase,
              currentLabel:
                event.label ||
                event.detail ||
                existingGroup?.currentLabel ||
                (locale === "zh-TW"
                  ? "正在處理"
                  : locale === "ja"
                    ? "処理中"
                    : "Processing"),
              progressPercent:
                typeof event.progressPercent === "number"
                  ? event.progressPercent
                  : existingGroup?.progressPercent,
              progressTrail: appendProgressTrail(existingGroup?.progressTrail, event),
            });
          } catch (error) {
            console.error("Error parsing chat progress SSE payload:", error);
          }
        };

          es.addEventListener("open", () => {
            reconnectAttempt = 0;
          });
          es.addEventListener("message", handleEvent);
          es.onmessage = handleEvent;
          es.addEventListener("progress", handleProgressEvent);
          es.addEventListener("summary", () => {});
          es.onerror = () => {
            if (chatEventSourceRef.current !== es) return;
            cleanupChatSSE();
            const current = activeChatStreamRef.current;
            if (
              current.conversationId !== conversationId ||
              current.groupId !== groupId ||
              reconnectAttempt >= maxReconnectAttempts
            ) {
              return;
            }
            reconnectAttempt += 1;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), 16000);
            setTimeout(connectChatSSE, delay);
          };
        } catch (error) {
          console.error("Error creating chat EventSource:", error);
        }
      };

      connectChatSSE();
    },
    [cleanupChatSSE, locale, revealChatMessage, updateImage]
  );

  const setupUserSSE = useCallback(
    async (userId: string, taskId: string): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        let didResolve = false;
        const resolveOnce = (value: boolean) => {
          if (didResolve) return;
          didResolve = true;
          resolve(value);
        };

        if (!userId || !isBackendTaskId(taskId)) {
          console.error("❌ Missing userId or taskId for SSE");
          resolveOnce(false);
          return;
        }

        const state = connectionStateRef.current;

        if (
          state.isConnected &&
          state.currentTaskId === taskId &&
          state.userId === userId
        ) {
          console.log(`✅ SSE already connected for task: ${taskId}`);
          resolveOnce(true);
          return;
        }

        if (state.isConnecting && state.currentTaskId === taskId) {
          console.log(`⏳ SSE connection already in progress for task: ${taskId}`);
          setTimeout(() => resolveOnce(connectionStateRef.current.isConnected), 1000);
          return;
        }

        cleanupSSE();

        connectionStateRef.current = {
          isConnecting: true,
          isConnected: false,
          currentTaskId: taskId,
          userId,
          reconnectAttempt:
            state.currentTaskId === taskId ? state.reconnectAttempt : 0,
          lastEventId:
            state.currentTaskId === taskId ? state.lastEventId : null,
        };

        const buildTaskSseUrl = () => {
          const url = new URL("/api/task-sse/stream", window.location.origin);
          url.searchParams.set("userId", userId);
          url.searchParams.set("taskId", taskId);
          url.searchParams.set("limit", "5");
          const lastEventId = connectionStateRef.current.lastEventId;
          if (lastEventId) {
            url.searchParams.set("replay", "1");
            url.searchParams.set("after", lastEventId);
            console.log(`🔄 啟用回放模式，從 eventId: ${lastEventId} 開始`);
          }
          return url.toString();
        };

        console.log(`🔗 Connecting SSE for user: ${userId}, task: ${taskId}`);

        const maxReconnectAttempts = 5;
        const getReconnectDelay = (attempt: number) => {
          return Math.min(1000 * Math.pow(2, attempt), 16000);
        };

        const connectSSE = () => {
          const currentState = connectionStateRef.current;

          if (currentState.currentTaskId !== taskId) {
            console.log(`🚫 Task changed, aborting SSE connection for: ${taskId}`);
            resolveOnce(false);
            return;
          }

          try {
            const es = new EventSource(buildTaskSseUrl(), { withCredentials: true });
            eventSourceRef.current = es;

            es.addEventListener("open", () => {
              if (eventSourceRef.current !== es) {
                return;
              }

              console.log(`✅ SSE connected for task: ${taskId}`);
              connectionStateRef.current.isConnecting = false;
              connectionStateRef.current.isConnected = true;
              connectionStateRef.current.reconnectAttempt = 0;
              startHeartbeatMonitor(taskId);
              resolveOnce(true);
            });

            es.addEventListener("heartbeat", () => {
              if (eventSourceRef.current !== es) {
                return;
              }

              resetHeartbeatMonitor(taskId);
            });

            es.addEventListener("connected", () => {
              if (eventSourceRef.current !== es) {
                return;
              }

              console.log(`📡 SSE connected event received for task: ${taskId}`);
            });

            es.addEventListener("status", (e: MessageEvent) => {
              if (eventSourceRef.current !== es) {
                return;
              }

              try {
                if (e.lastEventId) {
                  connectionStateRef.current.lastEventId = e.lastEventId;
                }

                const task = JSON.parse(e.data);
                console.log(`📨 SSE status update:`, task.status, `for task:`, task._id);
                const taskId = task._id || task.id;
                applyTaskPayload(task, taskId);
              } catch (err) {
                console.error("Error parsing status event:", err);
              }
            });

            es.addEventListener("queue", (e: MessageEvent) => {
              if (eventSourceRef.current !== es) {
                return;
              }

              try {
                if (e.lastEventId) {
                  connectionStateRef.current.lastEventId = e.lastEventId;
                }

                const queueInfo = JSON.parse(e.data) as Array<{
                  id: string;
                  position: number;
                }>;
                queueInfo.forEach(async (data) => {
                  await updateImageQueue(data.id, data.position);
                });
              } catch (err) {
                console.error("Error parsing queue event:", err);
              }
            });

            es.addEventListener("generation.progress", (e: MessageEvent) => {
              if (eventSourceRef.current !== es) {
                return;
              }

              try {
                if (e.lastEventId) {
                  connectionStateRef.current.lastEventId = e.lastEventId;
                }
                applyProgressPayload(JSON.parse(e.data), taskId);
              } catch (err) {
                console.error("Error parsing generation.progress event:", err);
              }
            });

            es.addEventListener("task_finished", (e: MessageEvent) => {
              if (eventSourceRef.current !== es) {
                return;
              }

              console.log(`🏁 Task finished event received for task: ${taskId}`);
              try {
                const data = JSON.parse(e.data);
                console.log(`Task finished with status: ${data.status}`);
                if (isTaskDiscardPayload(data)) {
                  handleDiscardedTask(data._id || data.id || taskId, data);
                  return;
                }

                const resolvedTaskId = data._id || data.id || taskId;
                const finished = applyTaskPayload(data, resolvedTaskId);
                const terminalStatus = String(data.status || "").toUpperCase();

                if (
                  !finished &&
                  (terminalStatus === TaskStatus.COMPLETED ||
                    terminalStatus === TaskStatus.PARTIAL_COMPLETE)
                ) {
                  startTaskStatusPolling(resolvedTaskId, "task-finished-missing-result");
                }
              } catch (err) {
                console.error("Error parsing task_finished event:", err);
              }
            });

            es.addEventListener("error", (e) => {
              if (eventSourceRef.current !== es) {
                return;
              }

              console.error("SSE error:", e);

              const currentState = connectionStateRef.current;

              if (es.readyState === EventSource.CLOSED) {
                console.log("🔴 SSE connection closed by server or network");

                if (currentState.currentTaskId !== taskId) {
                  console.log(`🚫 Task changed, not reconnecting for: ${taskId}`);
                  resolveOnce(false);
                  return;
                }

                if (currentState.reconnectAttempt < maxReconnectAttempts) {
                  currentState.reconnectAttempt++;
                  const delay = getReconnectDelay(
                    currentState.reconnectAttempt - 1
                  );

                  console.log(
                    `🔄 Attempting reconnect ${currentState.reconnectAttempt}/${maxReconnectAttempts} in ${delay}ms`
                  );

                  connectionStateRef.current.isConnecting = true;
                  connectionStateRef.current.isConnected = false;

                  reconnectTimerRef.current = setTimeout(() => {
                    if (connectionStateRef.current.currentTaskId === taskId) {
                      connectSSE();
                    } else {
                      console.log(`🚫 Task changed during reconnect delay, aborting for: ${taskId}`);
                      resolveOnce(false);
                    }
                  }, delay);
                } else {
                  console.log(`❌ Max reconnection attempts (${maxReconnectAttempts}) reached for task: ${taskId}`);
                  autoReconnectedTaskIdsRef.current.delete(taskId);
                  startTaskStatusPolling(taskId, "sse-max-reconnect");
                  showToast(t(`error_messages.network_delay`));
                  setIsGenerating(false);
                  cleanupSSE();
                  resolveOnce(false);
                }
              } else if (es.readyState === EventSource.CONNECTING) {
                console.log("⏳ SSE is reconnecting...");
                connectionStateRef.current.isConnecting = true;
                connectionStateRef.current.isConnected = false;
                resetHeartbeatMonitor(taskId);
                startTaskStatusPolling(taskId, "sse-connecting");
                resolveOnce(false);
              }
            });
          } catch (error) {
            console.error("Error creating EventSource:", error);
            startTaskStatusPolling(taskId, "sse-create-error");
            resolveOnce(false);
          }
        };

        connectSSE();
      });
    },
    [
      applyProgressPayload,
      applyTaskPayload,
      cleanupSSE,
      handleDiscardedTask,
      startHeartbeatMonitor,
      resetHeartbeatMonitor,
      startTaskStatusPolling,
      setIsGenerating,
      t,
      updateImageQueue,
    ]
  );

  useEffect(() => {
    const userId = (user as { id?: string } | null | undefined)?.id;
    if (!userId) {
      return;
    }

    const activeConversationId = conversationIdRef.current || selectedConversationId;
    const reconnectableGroups = images.filter(
      (group) =>
        isBackendTaskId(group.id) &&
        RECONNECTABLE_TASK_STATUSES.has(group.status) &&
        (!activeConversationId ||
          !group.conversationId ||
          group.conversationId === activeConversationId)
    );
    const activeGroup = reconnectableGroups[reconnectableGroups.length - 1];
    if (!activeGroup?.id) {
      return;
    }

    const connectionState = connectionStateRef.current;
    if (
      connectionState.currentTaskId === activeGroup.id &&
      (connectionState.isConnecting || connectionState.isConnected)
    ) {
      return;
    }

    if (autoReconnectedTaskIdsRef.current.has(activeGroup.id)) {
      return;
    }

    if (taskPollingTimersRef.current[activeGroup.id]) {
      return;
    }

    taskExpectedCountRef.current[activeGroup.id] =
      activeGroup.expectedCount || activeGroup.publishedImages.length || 1;
    setIsGenerating(true);

    const reconnectTaskId = activeGroup.id;
    autoReconnectedTaskIdsRef.current.add(reconnectTaskId);
    void setupUserSSE(userId, reconnectTaskId).then((connected) => {
      if (!connected) {
        autoReconnectedTaskIdsRef.current.delete(reconnectTaskId);
        startTaskStatusPolling(reconnectTaskId, "auto-reconnect-failed");
      }
    });
  }, [images, selectedConversationId, setIsGenerating, setupUserSSE, startTaskStatusPolling, user]);

  useEffect(() => {
    let wasHidden = false;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const reconnectStreams = (reason: string) => {
      const state = connectionStateRef.current;
      const activeChat = activeChatStreamRef.current;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      reconnectTimer = setTimeout(() => {
        if (
          state.currentTaskId &&
          state.userId &&
          isReconnectableGroup(state.currentTaskId, conversationIdRef.current)
        ) {
          console.log(`🔄 Task SSE 重新連線：${reason}`);
          cleanupSSE();
          void setupUserSSE(state.userId, state.currentTaskId);
        }

        if (
          activeChat.conversationId &&
          activeChat.groupId &&
          isReconnectableChatGroup(activeChat.groupId, activeChat.conversationId)
        ) {
          console.log(`🔄 Chat SSE 重新連線：${reason}`);
          cleanupChatSSE();
          void setupChatSSE({
            conversationId: activeChat.conversationId,
            groupId: activeChat.groupId,
            fallbackPrompt: activeChat.fallbackPrompt,
            assistantMessageId: activeChat.assistantMessageId,
          });
        }
      }, 1000);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        wasHidden = true;
        console.log("📱 頁面進入背景");
      } else {
        console.log("📱 頁面恢復前景");
        if (wasHidden) {
          reconnectStreams("頁面可見性恢復");
        }
        wasHidden = false;
      }
    };

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log("📱 從 bfcache 恢復");
        reconnectStreams("bfcache 恢復");
      }
    };

    const handleOnline = () => {
      console.log("🌐 網路恢復");
      reconnectStreams("網路恢復");
    };

    const handleOffline = () => {
      console.log("🌐 網路離線");
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [cleanupChatSSE, cleanupSSE, isReconnectableChatGroup, isReconnectableGroup, setupChatSSE, setupUserSSE]);

  useEffect(() => {
    const userId = (user as { id?: string } | null | undefined)?.id;
    if (!userId) {
      return;
    }

    const activeConversationId = conversationIdRef.current || selectedConversationId;
    const reconnectableTaskIds = images
      .filter(
        (group) =>
          isBackendTaskId(group.id) &&
          RECONNECTABLE_TASK_STATUSES.has(group.status) &&
          (!activeConversationId ||
            !group.conversationId ||
            group.conversationId === activeConversationId)
      )
      .map((group) => group.id)
      .filter(Boolean) as string[];

    if (reconnectableTaskIds.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      reconnectableTaskIds.forEach((taskId) => {
        const state = connectionStateRef.current;
        const isActiveSseTask =
          state.currentTaskId === taskId &&
          (state.isConnecting || state.isConnected);

        if (!isActiveSseTask) {
          startTaskStatusPolling(taskId, "background-healthcheck");
        }
      });
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [images, isReconnectableGroup, selectedConversationId, startTaskStatusPolling, user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const hasSelectedImage = !!selectedImageForGeneration;
    const hasPrompt = !!prompt.trim();

    if (!hasPrompt) {
      setFormError({
        message:
          locale === "zh-TW"
            ? "請先輸入你要生成的內容。"
            : locale === "ja"
              ? "まず生成したい内容を入力してください。"
              : "Please enter what you want to generate.",
        missingFields: ["prompt"],
        choices: [],
        reason: "missing_required_info",
      });
      return;
    }

    if (isGenerating || !canSubmit) {
      return;
    }

    if (!user) {
      if (typeof window !== "undefined") {
        showToast(
          locale === "zh-TW"
            ? "登入後即可開始創作"
            : locale === "ja"
              ? "ログインすると作成を開始できます"
              : "Sign in to start creating",
          false
        );
        window.dispatchEvent(new CustomEvent("openLoginDialog"));
      }
      return;
    }

    void updateUserPoint().catch((error) => {
      console.warn("[PromptForm] point refresh failed before submit", error);
    });

    if (submitInFlightRef.current) {
      return;
    }
    submitInFlightRef.current = true;

    setIsGenerating(true);
    setFormError(null);
    cleanupChatSSE();

    try {
      const id = ObjectID().toHexString();
      uuidRef.current = id;
      const trimmedPrompt = prompt.trim();
      const tempChatGroupId = `chat-${id}`;
      const tempGenerationGroupId = `pending-${id}`;
      // 自動模式一律先走 chat orchestrator，讓後端用上下文/LLM intent 決定聊天或生成。
      // 即使有參考圖也不能由前端硬判成生圖，因為客戶可能只是要分析/描述圖片。
      const shouldUseIntentRouter =
        effectiveGenerateType === null &&
        !audioUrl &&
        !motionVideoUrl &&
        !isImageFaceSwapMode &&
        !isVideoFaceSwapMode;
      const isNaturalChatMode =
        effectiveGenerateType === null ||
        shouldUseIntentRouter;
      const isExplicitChatMode = effectiveGenerateType === "chat";
      const isModelTextMode = effectiveGenerateType === "text";
      const isChatMode = isNaturalChatMode || isExplicitChatMode || isModelTextMode;
      const activeConversationId = freshConversationKey
        ? null
        : conversationIdRef.current || selectedConversationId;
      const uploadedImageUrls = uploadedImages
        .map((image) => image.url)
        .filter((url): url is string => Boolean(url));
      const selectedImageUrl = selectedImageForGeneration?.url || "";
      const requestImages =
        isImageFaceSwapMode || isVideoFaceSwapMode
          ? [
              ...(selectedImageUrl ? [selectedImageUrl] : []),
              ...uploadedImageUrls,
            ]
          : hasSelectedImage
            ? [selectedImageForGeneration.url].filter(Boolean)
            : uploadedImageUrls;
      const shouldUsePiapiFaceSwap = isImageFaceSwapMode || isVideoFaceSwapMode;
      const capabilityParams = selectedCapabilityModel?.params || [];
      const getParamValue = (param: CapabilityParam): unknown => {
        const key = param.key;

        if (key === "prompt") return trimmedPrompt;
        if (key === "images") return requestImages;
        if (key === "referenceImageUrls") return requestImages;
        if (key === "firstFrameUrl") return requestImages[0] || "";
        if (key === "lastFrameUrl") return requestImages[1] || "";
        if (key === "referenceAudioUrls") return audioUrl ? [audioUrl] : [];
        if (key === "audioUrl") return audioUrl;
        if (key === "videoUrl") return motionVideoUrl;
        if (key === "aspectRatio" || key === "aspect_ratio" || key === "ratio") {
          return selectedAspectRatioValue;
        }
        if (key === "resolution") {
          return effectiveGenerateType === "image"
            ? clampImageResolutionValue(selectedResolutionValue, resolutionOptions)
            : selectedResolutionValue;
        }
        if (key === "duration") return selectedDurationValue;
        if (key === "count") return imageCount;
        if (key === "output_format") {
          return dynamicParamValues[key] ?? param.default;
        }

        return dynamicParamValues[key] ?? param.default;
      };

      if (isChatMode) {
        if (isModelTextMode && (!selectedCapabilityModel?.id || !selectedModelRequestId)) {
          setFormError({
            message:
              locale === "zh-TW"
                ? "請先選擇文字模型"
                : locale === "ja"
                  ? "先にテキストモデルを選択してください"
                  : "Please select a text model first",
            missingFields: ["modelId"],
            choices: [],
            reason: "missing_required_info",
          });
          setIsGenerating(false);
          return;
        }

        addImage({
          id: tempChatGroupId,
          publishedImages: [],
          prompt: trimmedPrompt,
          assistantMessage: "",
          responseType: "chat",
          conversationId: activeConversationId || undefined,
          kind: "chat",
          loraModel: isModelTextMode && selectedCapabilityModel
            ? { id: selectedCapabilityModel.id, title: selectedCapabilityModel.label }
            : "chat",
          timestamp: new Date().toISOString(),
          status: TaskStatus.PROMPT_DELIVERING,
          progressPercent: shouldUseIntentRouter ? 18 : undefined,
          currentLabel: shouldUseIntentRouter
            ? locale === "zh-TW"
              ? "正在讀取上下文與理解需求"
              : locale === "ja"
                ? "文脈を読み取り、意図を理解しています"
                : "Reading context and understanding intent"
            : undefined,
          progressTrail: shouldUseIntentRouter
            ? [
                {
                  phase: "context_loading",
                  label:
                    locale === "zh-TW"
                      ? "讀取對話上下文"
                      : locale === "ja"
                        ? "会話の文脈を読み取り"
                        : "Reading conversation context",
                  detail:
                    locale === "zh-TW"
                      ? "正在整理最近對話、參考圖與目前選擇的模型設定。"
                      : locale === "ja"
                        ? "最近の会話、参照画像、選択中のモデル設定を整理しています。"
                        : "Collecting recent messages, references, and selected model settings.",
                  timestamp: new Date().toISOString(),
                  progressPercent: 18,
                },
              ]
            : undefined,
        });
      } else {
        const pendingCount = resolveGenerationOutputCount(effectiveGenerateType, imageCount);
        addImage({
          id: tempGenerationGroupId,
          // 和文字模式一樣，初始不預建占位符，避免 URL 變更觸發歷史載入時被後端多餘的 publishedImages 沖掉
          publishedImages: [],
          expectedCount: pendingCount,
          resultCount: 0,
          prompt: trimmedPrompt,
          assistantMessage: "",
          responseType: "generation",
          conversationId: activeConversationId || undefined,
          kind: resolveGenerationKind(effectiveGenerateType),
          loraModel: resolveGenerationKind(effectiveGenerateType),
          timestamp: new Date().toISOString(),
          status: TaskStatus.PROMPT_DELIVERING,
          images: uploadedImages.length > 0
            ? uploadedImages.map((image) => ({
                file: image.file,
                name: image.name,
                url: image.url,
              }))
            : undefined,
        });
        taskExpectedCountRef.current[tempGenerationGroupId] = pendingCount;
      }

      let endpoint = resolveBackendSubmitEndpoint("/chat/create");
      let requestBody: Record<string, unknown>;

      if (isModelTextMode && selectedCapabilityModel?.submit?.endpoint) {
        endpoint = resolveBackendSubmitEndpoint(selectedCapabilityModel.submit.endpoint);
      }

      if (!isChatMode) {
        if (isImageFaceSwapMode && requestImages.length !== 2) {
          removeImage(tempGenerationGroupId);
          setFormError({
            message:
              locale === "zh-TW"
                ? "圖片換臉必須剛好 2 張（第 1 張目標圖、第 2 張臉照）"
                : locale === "ja"
                  ? "画像フェイススワップは2枚必須です（1枚目=対象画像、2枚目=顔画像）"
                  : "Image face swap requires exactly 2 images (#1 target, #2 face).",
            missingFields: ["images"],
            choices: [],
            reason: "missing_required_info",
          });
          setIsGenerating(false);
          return;
        }

        if (isVideoFaceSwapMode) {
          if (requestImages.length < 1) {
            removeImage(tempGenerationGroupId);
            setFormError({
              message:
                locale === "zh-TW"
                  ? "影片換臉需要 1 張換臉圖片"
                  : locale === "ja"
                    ? "動画フェイススワップには顔画像が1枚必要です"
                    : "Video face swap requires 1 swap face image",
              missingFields: ["images"],
              choices: [],
              reason: "missing_required_info",
            });
            setIsGenerating(false);
            return;
          }

          if (!motionVideoUrl) {
            removeImage(tempGenerationGroupId);
            setFormError({
              message:
                locale === "zh-TW"
                  ? "影片換臉需要上傳目標影片"
                  : locale === "ja"
                    ? "動画フェイススワップには対象動画が必要です"
                    : "Video face swap requires a target video",
              missingFields: ["videoUrl"],
              choices: [],
              reason: "missing_required_info",
            });
            setIsGenerating(false);
            return;
          }
        }

        if (!shouldUsePiapiFaceSwap && (!selectedCapabilityModel?.id || !selectedModelRequestId)) {
          removeImage(tempGenerationGroupId);
          setFormError({
            message:
              locale === "zh-TW"
                ? "請先選擇模型"
                : locale === "ja"
                  ? "先にモデルを選択してください"
                  : "Please select a model first",
            missingFields: ["modelId"],
            choices: [],
            reason: "missing_required_info",
          });
          setIsGenerating(false);
          return;
        }

        if (
          !shouldUsePiapiFaceSwap &&
          effectiveGenerateType &&
          selectedCapabilityModel?.kind &&
          selectedCapabilityModel.kind !== effectiveGenerateType
        ) {
          removeImage(tempGenerationGroupId);
          setFormError({
            message:
              locale === "zh-TW"
                ? "模型與目前模式不一致，請重新選擇模型"
                : locale === "ja"
                  ? "モデルと現在のモードが一致していません。モデルを選び直してください"
                  : "The selected model does not match the current mode. Please select a model again.",
            missingFields: ["modelId"],
            choices: [],
            reason: "invalid_input",
          });
          setIsGenerating(false);
          return;
        }

        if (!shouldUsePiapiFaceSwap && !selectedModelSupportsImageInput && requestImages.length > 0) {
          removeImage(tempGenerationGroupId);
          setFormError({
            message:
              locale === "zh-TW"
                ? "此模型不支援參考圖"
                : locale === "ja"
                  ? "このモデルは参照画像に対応していません"
                  : "This model does not support reference images",
            missingFields: ["images"],
            choices: [],
            reason: "invalid_input",
          });
          setIsGenerating(false);
          return;
        }

        if (requestImages.length > effectiveMaxReferenceImages) {
          removeImage(tempGenerationGroupId);
          setFormError({
            message:
              locale === "zh-TW"
                ? `此模型最多支援 ${effectiveMaxReferenceImages} 張參考圖`
                : locale === "ja"
                  ? `このモデルは最大 ${effectiveMaxReferenceImages} 枚まで対応します`
                  : `This model supports up to ${effectiveMaxReferenceImages} reference images`,
            missingFields: ["images"],
            choices: [],
            reason: "invalid_input",
          });
          setIsGenerating(false);
          return;
        }
        endpoint = resolveBackendSubmitEndpoint(
          shouldUsePiapiFaceSwap
            ? "/generate/create"
            : selectedCapabilityModel?.submit?.endpoint ||
                capabilityResponse?.submission?.endpoint ||
                "/generate/create"
        );

        const basePayload: Record<string, unknown> = {
          uuid: id,
          type: shouldUsePiapiFaceSwap
            ? (isVideoFaceSwapMode ? "video" : "image")
            : effectiveGenerateType || selectedCapabilityModel?.submit?.type || "image",
          ...(shouldUsePiapiFaceSwap
            ? {}
            : {
                modelId: selectedModelRequestId,
                selectedModelId: selectedModelRequestId,
                modelHint:
                  selectedCapabilityModel?.modelId ||
                  selectedModelRequestId,
              }),
          prompt: trimmedPrompt,
          conversationId: activeConversationId || undefined,
          ...(shouldUsePiapiFaceSwap
            ? {
                modelHint: isVideoFaceSwapMode
                  ? "PiapiVideoFaceSwap"
                  : "PiapiFaceSwap",
              }
            : {}),
        };

        if (shouldUsePiapiFaceSwap) {
          if (isImageFaceSwapMode) {
            basePayload.images = requestImages.slice(0, 2);
          } else if (isVideoFaceSwapMode) {
            basePayload.images = requestImages.slice(0, 1);
            basePayload.swap_faces_index = "0";
            basePayload.target_faces_index = "0";
            if (motionVideoUrl) {
              basePayload.videoUrl = motionVideoUrl;
            }
          }
        } else {
          const paramValues = capabilityParams.reduce<Record<string, unknown>>(
            (acc, param) => {
              acc[param.key] = getParamValue(param);
              return acc;
            },
            {}
          );
          const modeSendKeys = pickCapabilityModeSendKeys(
            selectedCapabilityModel,
            paramValues
          );
          const hiddenParamKeys = new Set(
            selectedCapabilityModel?.requestRules?.hiddenParams || []
          );

          capabilityParams.forEach((param) => {
            if (param.key === "prompt" || hiddenParamKeys.has(param.key)) {
              return;
            }

            if (modeSendKeys && !modeSendKeys.has(param.key)) {
              return;
            }

            const value = paramValues[param.key];
            if (!shouldSendCapabilityParam(param, value)) {
              return;
            }

            if (param.type === "number" && typeof value === "string") {
              const numericValue = Number(value);
              if (!Number.isNaN(numericValue)) {
                basePayload[param.key] = numericValue;
                return;
              }
            }

            basePayload[param.key] = value;
          });
        }

        requestBody = Object.fromEntries(
          Object.entries(basePayload).filter(([, value]) => value !== undefined)
        );
      } else {
        requestBody = {
          ...(isModelTextMode && selectedModelRequestId
            ? {
                type: selectedCapabilityModel?.submit?.type || selectedCapabilityModel?.kind || "text",
                modelId: selectedModelRequestId,
              }
            : shouldUseIntentRouter && selectedModelRequestId
              ? {
                  modelId: selectedModelRequestId,
                  selectedModelId: selectedModelRequestId,
                  modelHint:
                    selectedCapabilityModel?.modelId ||
                    selectedModelRequestId,
                  count: imageCount,
                  aspectRatio: selectedAspectRatioValue || undefined,
                  resolution:
                    selectedCapabilityModel?.kind === "image"
                      ? clampImageResolutionValue(selectedResolutionValue, resolutionOptions)
                      : selectedResolutionValue || undefined,
                  duration: selectedDurationValue || undefined,
                }
            : {}),
          conversationId: activeConversationId || undefined,
          message: trimmedPrompt,
          uuid: id,
          ...(effectiveGenerateType
            ? effectiveGenerateType === "chat"
              ? requestImages.length > 0
                ? { images: requestImages }
                : {}
              : isModelTextMode
                ? requestImages.length > 0
                  ? { images: requestImages }
                  : {}
              : shouldUseIntentRouter
                ? { images: requestImages }
                : {}
            : {
                images: requestImages,
              }),
        };
      }

      const submitMethod =
        selectedCapabilityModel?.submit?.method ||
        capabilityResponse?.submission?.method ||
        "POST";
      const requestSnapshot: GenerationRequestSnapshot = {
        uuid: id,
        endpoint,
        method: submitMethod,
        body: requestBody,
        createdAt: new Date().toISOString(),
      };
      const paramsSummary = isChatMode
        ? undefined
        : buildParamsSummary({
            modelLabel: selectedCapabilityModel?.label,
            kind: String(requestBody.type || effectiveGenerateType || ""),
            body: requestBody,
            referenceCount: requestImages.length,
          });

      const applyChatCreateProgress = (event: GenerationProgressPayload) => {
        if (!isChatMode) return;

        const existingGroup = imagesRef.current.find(
          (group) => group.id === tempChatGroupId
        );
        const nextConversationId =
          event.conversationId ||
          existingGroup?.conversationId ||
          activeConversationId ||
          undefined;
        const nextProgress =
          typeof event.progressPercent === "number"
            ? event.progressPercent
            : existingGroup?.progressPercent;

        updateImage(tempChatGroupId, {
          ...(existingGroup || {}),
          id: tempChatGroupId,
          publishedImages: existingGroup?.publishedImages || [],
          prompt: existingGroup?.prompt || trimmedPrompt,
          assistantMessage: existingGroup?.assistantMessage || "",
          responseType: "chat",
          conversationId: nextConversationId,
          kind: "chat",
          loraModel:
            existingGroup?.loraModel ||
            (isModelTextMode && selectedCapabilityModel
              ? { id: selectedCapabilityModel.id, title: selectedCapabilityModel.label }
              : "chat"),
          timestamp: existingGroup?.timestamp || new Date().toISOString(),
          status: TaskStatus.PROMPT_DELIVERING,
          currentPhase: event.phase || existingGroup?.currentPhase,
          currentLabel:
            event.label ||
            event.detail ||
            existingGroup?.currentLabel ||
            (locale === "zh-TW"
              ? "正在處理"
              : locale === "ja"
                ? "処理中"
                : "Processing"),
          progressPercent: nextProgress,
          progressTrail: appendProgressTrail(existingGroup?.progressTrail, event),
        });
      };

      const readStreamedChatCreateResponse = async (
        response: Response
      ): Promise<{
        data: ChatCreateResponse | null;
        errorData: ChatCreateResponse | null;
        status: number;
      }> => {
        const reader = response.body?.getReader();
        if (!reader) {
          return { data: null, errorData: null, status: response.status };
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let finalPayload: unknown = null;
        let errorPayload: unknown = null;
        let errorStatus = response.status;

        const processBlock = (block: string) => {
          const trimmedBlock = block.trim();
          if (!trimmedBlock) return;

          let eventName = "message";
          const dataLines: string[] = [];

          trimmedBlock.split(/\r?\n/).forEach((line) => {
            if (line.startsWith("event:")) {
              eventName = line.slice("event:".length).trim() || "message";
              return;
            }

            if (line.startsWith("data:")) {
              dataLines.push(line.slice("data:".length).trimStart());
            }
          });

          if (dataLines.length === 0) return;

          let payload: unknown;
          try {
            payload = JSON.parse(dataLines.join("\n"));
          } catch {
            return;
          }

          if (eventName === "progress") {
            applyChatCreateProgress(payload as GenerationProgressPayload);
            return;
          }

          if (eventName === "final") {
            finalPayload = payload;
            return;
          }

          if (eventName === "error") {
            errorPayload = payload;
            const statusFromPayload =
              payload && typeof payload === "object"
                ? Number((payload as { status?: unknown }).status)
                : NaN;
            if (Number.isFinite(statusFromPayload)) {
              errorStatus = statusFromPayload;
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: !done });
            const blocks = buffer.split(/\r?\n\r?\n/);
            buffer = blocks.pop() || "";
            blocks.forEach(processBlock);
          }

          if (done) break;
        }

        if (buffer.trim()) {
          processBlock(buffer);
        }

        return {
          data: normalizeChatCreateResponse(finalPayload),
          errorData: normalizeChatCreateResponse(errorPayload),
          status: errorPayload ? errorStatus : response.status,
        };
      };

      const submitBody = isChatMode
        ? { ...requestBody, stream: true }
        : requestBody;
      const submitAbortController = new AbortController();
      const submitTimeoutId = window.setTimeout(
        () => submitAbortController.abort(),
        120_000
      );
      let res: Response;

      try {
        res = await fetch(endpoint, {
          method: submitMethod,
          headers: {
            "Content-Type": "application/json",
            Accept: isChatMode ? "text/event-stream" : "application/json",
          },
          credentials: "include",
          body: JSON.stringify(submitBody),
          signal: submitAbortController.signal,
        });
      } finally {
        window.clearTimeout(submitTimeoutId);
      }

      let data: ChatCreateResponse | null = null;
      let errorData: ChatCreateResponse | null = null;
      let responseStatus = res.status;
      const isStreamResponse =
        res.headers.get("content-type")?.includes("text/event-stream") || false;

      if (isStreamResponse) {
        const streamedResponse = await readStreamedChatCreateResponse(res);
        data = streamedResponse.data;
        errorData = streamedResponse.errorData;
        responseStatus = streamedResponse.status;
      } else {
        const responseText = await res.text();
        try {
          const rawData: unknown = responseText ? JSON.parse(responseText) : null;
          data = normalizeChatCreateResponse(rawData);
        } catch {
          data = responseText
            ? {
                ok: false,
                error: responseText.slice(0, 500),
              }
            : null;
        }
      }

      const responseOk = isStreamResponse
        ? !errorData && responseStatus < 400
        : res.ok;
      const effectiveErrorData = errorData || data;

      if (!responseOk) {
        const backendErrorText = getBackendErrorText(effectiveErrorData);

        if (isInsufficientPointsResponse(responseStatus, effectiveErrorData)) {
          if (isNaturalChatMode) {
            removeImage(tempChatGroupId);
          } else {
            removeImage(tempGenerationGroupId);
          }

          const message =
            backendErrorText ||
            t("error_messages.insufficient_points");
          setFormError({
            message,
            missingFields: [],
            choices: [],
            reason: "invalid_input",
          });
          showToast(message, true);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("openPaymentDialog"));
          }
          setIsGenerating(false);
          return;
        }

        if (isChatMode) {
          removeImage(tempGenerationGroupId);
          delete taskExpectedCountRef.current[tempGenerationGroupId];

          const chatConversationId =
            effectiveErrorData?.conversationId ||
            activeConversationId ||
            conversationIdRef.current ||
            "";
          const rawChatText = backendErrorText || t("error_messages.generation_failed");
          const lowerChatText = rawChatText.toLowerCase();
          const looksInternal =
            lowerChatText.includes("conversation summary") ||
            lowerChatText.includes("need to confirm if user wants") ||
            lowerChatText.includes("final medium (image or video)");
          const chatText =
            !rawChatText.trim() || looksInternal
              ? locale.startsWith("zh")
                ? "我在，想聊天或創作都可以。"
                : locale.startsWith("ja")
                  ? "います。話したいことや作りたいものをそのまま入力してください。"
                  : "I'm here. Tell me what you want to chat about or create."
              : rawChatText;

          updateImage(tempChatGroupId, {
            id: tempChatGroupId,
            publishedImages: [],
            prompt: trimmedPrompt,
            assistantMessage: "",
            responseType: "chat",
            conversationId: chatConversationId || undefined,
            userMessageId: effectiveErrorData?.userMessageId,
            assistantMessageId: effectiveErrorData?.assistantMessageId,
            kind: "chat",
            loraModel: "chat",
            timestamp: new Date().toISOString(),
            status: TaskStatus.PROMPT_DELIVERING,
          });

          revealChatMessage({
            groupId: tempChatGroupId,
            conversationId: chatConversationId,
            fallbackPrompt: trimmedPrompt,
            targetText: chatText,
            assistantMessageId: effectiveErrorData?.assistantMessageId,
            completeOnFinish: true,
          });
          setIsGenerating(false);
          resetComposer();
          return;
        }

        if (isNaturalChatMode) {
          removeImage(tempChatGroupId);
        } else {
          removeImage(tempGenerationGroupId);
        }

        if (responseStatus === 422 && effectiveErrorData?.ok === false) {
          setFormError({
            message:
              getBackendErrorText(effectiveErrorData) ||
              t(`error_messages.generation_failed`),
            missingFields: Array.isArray(effectiveErrorData.missingFields) ? effectiveErrorData.missingFields : [],
            choices: Array.isArray(effectiveErrorData.choices) ? effectiveErrorData.choices : [],
            reason: effectiveErrorData.reason || "invalid_input",
          });
          setIsGenerating(false);
          return;
        }

        if (responseStatus === 400) {
          setFormError({
            message:
              getBackendErrorText(effectiveErrorData) ||
              "請檢查輸入內容",
            missingFields: [],
            choices: [],
            reason: "invalid_input",
          });
          setIsGenerating(false);
          return;
        }

        if (responseStatus === 502) {
          setFormError({
            message:
              getBackendErrorText(effectiveErrorData) ||
              "外部生成服務暫時失敗，請稍後再試",
            missingFields: [],
            choices: [],
            reason: "unsupported_request",
          });
          setIsGenerating(false);
          return;
        }

        setFormError({
          message:
            getBackendErrorText(effectiveErrorData) ||
            t(`error_messages.generation_failed`),
          missingFields: [],
          choices: [],
          reason: "invalid_input",
        });
        setIsGenerating(false);
        return;
      }

      const resolvedConversationId =
        data?.conversationId || activeConversationId || conversationIdRef.current || undefined;

      if (resolvedConversationId) {
        conversationIdRef.current = resolvedConversationId;
        historyLoadedRef.current = true;
        skipNextHistoryLoadRef.current = resolvedConversationId;
        syncConversationUrl(resolvedConversationId);
        // 若是全新對話（原本 URL 沒有 conversationId），通知側邊欄刷新
        if (!selectedConversationId) {
          window.dispatchEvent(new CustomEvent("conversation-created"));
        }
      }

      const assistantText =
        getResponseMessageText(data?.message);

      if (data?.type === "chat") {
        const chatGroupId = tempChatGroupId;

        removeImage(tempGenerationGroupId);
        delete taskExpectedCountRef.current[tempGenerationGroupId];
        setImages(
          imagesRef.current.filter((group) => {
            if (group.id === tempGenerationGroupId) return false;

            const samePrompt = group.prompt?.trim() === trimmedPrompt;
            const sameConversation =
              !resolvedConversationId ||
              !group.conversationId ||
              group.conversationId === resolvedConversationId;
            const failedEmptyGeneration =
              group.responseType === "generation" &&
              group.status === TaskStatus.FAILED &&
              (group.publishedImages || []).every((image) => !image?.url);

            return !(samePrompt && sameConversation && failedEmptyGeneration);
          })
        );

        updateImage(chatGroupId, {
          id: chatGroupId,
          publishedImages: [],
          prompt: trimmedPrompt,
          assistantMessage: assistantText,
          responseType: "chat",
          conversationId: resolvedConversationId,
          userMessageId: data.userMessageId,
          assistantMessageId: data.assistantMessageId,
          kind: "chat",
          loraModel: "chat",
          timestamp: new Date().toISOString(),
          status: TaskStatus.PROMPT_DELIVERING,
        });

        if (resolvedConversationId) {
          skipNextHistoryLoadRef.current = resolvedConversationId;
        }

        chatDraftsRef.current[chatGroupId] = "";
        if (assistantText) {
          revealChatMessage({
            groupId: chatGroupId,
            conversationId: resolvedConversationId || "",
            fallbackPrompt: trimmedPrompt,
            targetText: assistantText,
            assistantMessageId: data.assistantMessageId,
            completeOnFinish: true,
          });
        }

        if (resolvedConversationId && data.assistantMessageId) {
          void setupChatSSE({
            conversationId: resolvedConversationId,
            groupId: chatGroupId,
            fallbackPrompt: trimmedPrompt,
            assistantMessageId: data.assistantMessageId,
          });
        }

        setIsGenerating(false);
        resetComposer();
        return;
      }

      const hasSubmittedTask = Boolean(data?.taskId);
      const isSuccessfulGenerationResponse =
        data?.type === "generation" || (!!hasSubmittedTask && data?.type !== "chat");

      if (!isSuccessfulGenerationResponse) {
        if (isNaturalChatMode) {
          removeImage(tempChatGroupId);
        } else {
          removeImage(tempGenerationGroupId);
        }
        showToast(t(`error_messages.generation_failed`), true);
        setIsGenerating(false);
        cleanupSSE();
        return;
      }

      if (data) {
        data.type = "generation";
        data.kind = (data.kind || effectiveGenerateType || "image") as "image" | "video" | "audio";
        data.count = resolveGenerationOutputCount(
          data.kind as GenerateType,
          data.kind === "image" ? data.count || imageCount : 1
        );
      }

      const responseData = data!;
      const taskId = responseData.taskId!;
      const pendingCount = resolveGenerationOutputCount(
        (responseData.kind || effectiveGenerateType) as GenerateType,
        responseData.count
      );
      const images = buildTaskImageSlots(taskId, [], pendingCount);
      const nextGenerationGroup: ImageDataGroup = {
        id: taskId,
        publishedImages: images,
        expectedCount: pendingCount,
        resultCount: 0,
        prompt: trimmedPrompt,
        assistantMessage: assistantText,
        responseType: "generation",
        conversationId: resolvedConversationId,
        userMessageId: responseData.userMessageId,
        assistantMessageId: responseData.assistantMessageId,
        kind: resolveGenerationKind(responseData.kind || effectiveGenerateType),
        loraModel:
          selectedCapabilityModel
            ? { id: selectedCapabilityModel.id, title: selectedCapabilityModel.label }
            : resolveGenerationKind(responseData.kind || effectiveGenerateType),
        timestamp: new Date().toISOString(),
        status: TaskStatus.PROMPT_DELIVERING,
        paramsSummary,
        currentLabel:
          resolveGenerationKind(responseData.kind || effectiveGenerateType) === "video"
            ? locale === "zh-TW"
              ? "影片生成中，通常需要 1 到 5 分鐘"
              : locale === "ja"
                ? "動画を生成中です。通常 1 から 5 分ほどかかります"
                : "Generating video. This usually takes 1 to 5 minutes."
            : undefined,
        requestSnapshot,
        images: uploadedImages.length > 0
          ? uploadedImages.map((image) => ({
              file: image.file,
              name: image.name,
              url: image.url,
            }))
          : undefined,
      };

      const hasTaskGroupAlready = imagesRef.current.some((group) => group.id === taskId);

      if (isNaturalChatMode) {
        removeImage(tempChatGroupId);
      }

      if (hasTaskGroupAlready) {
        removeImage(tempGenerationGroupId);
        updateImage(taskId, nextGenerationGroup);
        taskExpectedCountRef.current[taskId] = pendingCount;
      } else {
        updateImage(tempGenerationGroupId, nextGenerationGroup);
        taskExpectedCountRef.current[taskId] = pendingCount;
      }

      void updateUserPoint();
      window.dispatchEvent(new CustomEvent("generation:submitted"));

      if (nextGenerationGroup.kind === "video") {
        window.setTimeout(() => {
          if (isReconnectableGroup(taskId, resolvedConversationId || conversationIdRef.current)) {
            startTaskStatusPolling(taskId, "video-submit-fallback");
          }
        }, 12000);
      }

      if (resolvedConversationId) {
        skipNextHistoryLoadRef.current = resolvedConversationId;
      }

      // 任務已建立後就釋放輸入鎖；SSE/輪詢只負責更新任務卡，不應阻塞下一次操作。
      setIsGenerating(false);
      void setupUserSSE(user?.id || "", taskId).then((sseConnected) => {
        if (sseConnected) return;
        console.warn("SSE connection failed, but task was submitted successfully");
        startTaskStatusPolling(taskId, "submit-sse-failed");
        showToast(t(`error_messages.network_delay`), true);
      });

      resetComposer();
    } catch (err) {
      if (effectiveGenerateType === null && uuidRef.current) {
        removeImage(`chat-${uuidRef.current}`);
      } else if (uuidRef.current) {
        removeImage(`pending-${uuidRef.current}`);
      }
      console.error("Task submission error:", {
        error: err,
        message: err instanceof Error ? err.message : "Unknown error",
        stack: err instanceof Error ? err.stack : undefined,
        timestamp: new Date().toISOString(),
      });

      const submitErrorMessage =
        getSubmitExceptionMessage(err, locale) ||
        t(`error_messages.generation_failed`);

      setFormError({
        message: submitErrorMessage,
        missingFields: [],
        choices: [],
        reason: "invalid_input",
      });
      showToast(submitErrorMessage, true);
      setIsGenerating(false);
      return;
    } finally {
      submitInFlightRef.current = false;
    }
  };

  const isStyleTransferMode = !!(
    selectedImageForGeneration ||
    uploadedImages.length > 0 ||
    pendingReferenceCount > 0 ||
    isUploadingReferences
  );
  const isImageToImageModel =
    generateType === "image" &&
    (uploadedImages.length > 0 || !!selectedImageForGeneration);

  useEffect(() => {
    if (generateType === "audio") {
      if (uploadedImages.length > 0) {
        setUploadedImages([]);
      }
      if (selectedImageForGeneration) {
        setSelectedImageForGeneration(null);
      }
      setPendingReferenceCount(0);
      clearPendingReferencePreviews();
      setShowStyleTransferMenu(false);
      setShowModelWarning(false);
      setShowSelectedImageModelWarning(false);
      return;
    }

    setUploadedImages((prev) => prev.slice(0, effectiveMaxReferenceImages));
  }, [
    effectiveMaxReferenceImages,
    generateType,
    clearPendingReferencePreviews,
    selectedImageForGeneration,
    setSelectedImageForGeneration,
    uploadedImages.length,
  ]);

  useEffect(() => {
    if (generateType !== "video" && isStyleTransferMode && showRatioMenu) {
      setShowRatioMenu(false);
    }
  }, [generateType, isStyleTransferMode, showRatioMenu]);

  useEffect(() => {
    setFormError(null);
  }, [generateType]);

  const missingFieldsKey = formError?.missingFields.join(",") || "";

  useEffect(() => {
    if (!formError?.missingFields.includes("images")) return;
    if (!hasSelectedGalleryImage && uploadedImages.length === 0) return;

    setFormError((prev) => {
      if (!prev || !prev.missingFields.includes("images")) return prev;
      return {
        ...prev,
        missingFields: prev.missingFields.filter((field) => field !== "images"),
        message: "",
      };
    });
    // 🌟 關鍵：拔掉 formError 物件依賴，避免每次 setState 後自己又觸發自己
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingFieldsKey, hasSelectedGalleryImage, uploadedImages.length]);

  const canSubmit =
    !isComposing &&
    !isGenerating &&
    prompt.trim().length > 0;
  const getReferenceSlotLabel = useCallback(
    (index: number, hasPinnedTarget = false) => {
      const effectiveIndex = hasPinnedTarget ? index + 1 : index;

      if (isImageFaceSwapMode) {
        if (effectiveIndex === 0) return locale === "zh-TW" ? "目標圖" : locale === "ja" ? "対象画像" : "Target";
        if (effectiveIndex === 1) return locale === "zh-TW" ? "臉照" : locale === "ja" ? "顔画像" : "Face";
      }

      if (isVideoFaceSwapMode && effectiveIndex === 0) {
        return locale === "zh-TW" ? "臉照" : locale === "ja" ? "顔画像" : "Face";
      }

      if (effectiveIndex === 0) {
        return locale === "zh-TW" ? "主圖" : locale === "ja" ? "メイン" : "Main";
      }

      return "";
    },
    [isImageFaceSwapMode, isVideoFaceSwapMode, locale]
  );
  const errorFields = useMemo(
    () => new Set(formError?.missingFields || []),
    [formError]
  );
  const hasPromptError = errorFields.has("prompt");
  const hasReferenceError = errorFields.has("images");
  const hasCountError = errorFields.has("count");
  const hasAspectRatioError = errorFields.has("aspectRatio");
  const composerErrorTone =
    formError?.reason === "unsupported_request" || formError?.reason === "invalid_input"
      ? "amber"
      : "red";

  const applyPromptValue = useCallback((nextPrompt: string) => {
    setPrompt(nextPrompt);
    if (inputRef.current) {
      inputRef.current.textContent = nextPrompt;
      inputRef.current.focus();
    }
  }, []);

  const retryFromSnapshot = useCallback(
    async (group: ImageDataGroup) => {
      const snapshot = group.requestSnapshot;
      const userId = (user as { id?: string } | null | undefined)?.id || "";

      if (!snapshot || !userId || submitInFlightRef.current) {
        return false;
      }

      submitInFlightRef.current = true;
      setIsGenerating(true);
      setFormError(null);

      const nextUuid = ObjectID().toHexString();
      const retryBody: Record<string, unknown> = {
        ...snapshot.body,
        uuid: nextUuid,
      };
      const tempRetryGroupId = `retry-${nextUuid}`;
      const kind = resolveGenerationKind(String(retryBody.type || group.kind || "image") as SubmitType);
      const expectedCount = resolveGenerationOutputCount(
        kind === "chat" ? "image" : kind,
        Number(retryBody.count) || group.expectedCount || 1
      );
      const retrySnapshot: GenerationRequestSnapshot = {
        ...snapshot,
        uuid: nextUuid,
        body: retryBody,
        createdAt: new Date().toISOString(),
      };

      addImage({
        id: tempRetryGroupId,
        publishedImages: [],
        expectedCount,
        resultCount: 0,
        prompt: String(retryBody.prompt || group.prompt || ""),
        assistantMessage: "",
        responseType: "generation",
        conversationId: String(retryBody.conversationId || group.conversationId || "") || undefined,
        kind,
        loraModel: group.loraModel || kind,
        timestamp: new Date().toISOString(),
        status: TaskStatus.PROMPT_DELIVERING,
        paramsSummary: group.paramsSummary,
        requestSnapshot: retrySnapshot,
        images: group.images,
      });

      try {
        const retryAbortController = new AbortController();
        const retryTimeoutId = window.setTimeout(
          () => retryAbortController.abort(),
          120_000
        );
        let res: Response;

        try {
          res = await fetch(snapshot.endpoint, {
            method: snapshot.method,
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(retryBody),
            signal: retryAbortController.signal,
          });
        } finally {
          window.clearTimeout(retryTimeoutId);
        }
        const data = normalizeChatCreateResponse(await res.json().catch(() => null));

        if (!res.ok || !data?.taskId) {
          if (isInsufficientPointsResponse(res.status, data)) {
            const message =
              getBackendErrorText(data) ||
              t("error_messages.insufficient_points");
            handleFailedTask(tempRetryGroupId, {
              id: tempRetryGroupId,
              status: TaskStatus.FAILED,
              failureMessage: message,
            });
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("openPaymentDialog"));
            }
            return true;
          }

          handleFailedTask(tempRetryGroupId, {
            id: tempRetryGroupId,
            status: TaskStatus.FAILED,
            failureMessage:
              getBackendErrorText(data) ||
              (locale === "zh-TW"
                ? "重試送出失敗，請稍後再試。"
                : locale === "ja"
                  ? "再試行の送信に失敗しました。後でもう一度お試しください。"
                  : "Retry submit failed. Please try again later."),
          });
          return true;
        }

        const taskId = data.taskId;
        const resolvedConversationId =
          data.conversationId ||
          String(retryBody.conversationId || group.conversationId || "") ||
          undefined;
        const nextGroup: ImageDataGroup = {
          id: taskId,
          publishedImages: buildTaskImageSlots(taskId, [], expectedCount),
          expectedCount,
          resultCount: 0,
          prompt: String(retryBody.prompt || group.prompt || ""),
          assistantMessage: getResponseMessageText(data.message),
          responseType: "generation",
          conversationId: resolvedConversationId,
          userMessageId: data.userMessageId,
          assistantMessageId: data.assistantMessageId,
          kind: resolveGenerationKind(data.kind || kind),
          loraModel: group.loraModel || kind,
          timestamp: new Date().toISOString(),
          status: TaskStatus.PROMPT_DELIVERING,
          paramsSummary: group.paramsSummary,
          requestSnapshot: {
            ...retrySnapshot,
            body: {
              ...retrySnapshot.body,
              conversationId: resolvedConversationId,
            },
          },
          images: group.images,
        };

        removeImage(tempRetryGroupId);
        addImage(nextGroup);
        taskExpectedCountRef.current[taskId] = expectedCount;
        void updateUserPoint();
        window.dispatchEvent(new CustomEvent("generation:submitted"));
        if (nextGroup.kind === "video") {
          window.setTimeout(() => {
            if (isReconnectableGroup(taskId, resolvedConversationId || conversationIdRef.current)) {
              startTaskStatusPolling(taskId, "video-retry-fallback");
            }
          }, 12000);
        }
        if (resolvedConversationId) {
          conversationIdRef.current = resolvedConversationId;
          skipNextHistoryLoadRef.current = resolvedConversationId;
          syncConversationUrl(resolvedConversationId);
        }

        setIsGenerating(false);
        void setupUserSSE(userId, taskId).then((connected) => {
          if (connected) return;
          startTaskStatusPolling(taskId, "retry-sse-failed");
          showToast(t(`error_messages.network_delay`), true);
        });
        return true;
      } catch (error) {
        console.error("Retry generation failed:", error);
        handleFailedTask(tempRetryGroupId, {
          id: tempRetryGroupId,
          status: TaskStatus.FAILED,
          failureMessage:
            locale === "zh-TW"
              ? "重試送出失敗，請稍後再試。"
              : locale === "ja"
                ? "再試行の送信に失敗しました。後でもう一度お試しください。"
                : "Retry submit failed. Please try again later.",
        });
        return true;
      } finally {
        submitInFlightRef.current = false;
      }
    },
    [
      addImage,
      handleFailedTask,
      isReconnectableGroup,
      locale,
      removeImage,
      setIsGenerating,
      setupUserSSE,
      startTaskStatusPolling,
      syncConversationUrl,
      t,
      updateUserPoint,
      user,
    ]
  );

  useEffect(() => {
    if (!retryGenerationRequest) {
      return;
    }

    if (retryGenerationRequest.requestSnapshot) {
      void retryFromSnapshot(retryGenerationRequest).finally(() => {
        onRetryGenerationRequestConsumed?.();
      });
      return;
    }

    applyPromptValue(retryGenerationRequest.prompt || "");
    setGenerateType(
      retryGenerationRequest.kind && retryGenerationRequest.kind !== "chat"
        ? retryGenerationRequest.kind
        : "image"
    );
    setSelectedImageForGeneration(null);
    setUploadedImages(
      (retryGenerationRequest.images || [])
        .map((image, index) => ({
          file: image.file,
          name: image.name || `reference-${index + 1}`,
          url: normalizeMediaUrl(image.url),
        }))
        .filter((image) => Boolean(image.file || image.url))
    );
    setFormError(null);
    onRetryGenerationRequestConsumed?.();

    window.setTimeout(() => {
      formRef.current?.requestSubmit();
    }, 0);
  }, [
    applyPromptValue,
    onRetryGenerationRequestConsumed,
    retryFromSnapshot,
    retryGenerationRequest,
    setSelectedImageForGeneration,
  ]);

  const applyComposerChoice = useCallback(
    (choice: string) => {
      const trimmedChoice = choice.trim();
      const currentPrompt = (inputRef.current?.textContent || prompt).trim();

      if (!trimmedChoice) return;

      if (!currentPrompt) {
        applyPromptValue(trimmedChoice);
      } else if (currentPrompt.includes(trimmedChoice)) {
        applyPromptValue(currentPrompt);
      } else {
        const separator = locale === "en" ? ": " : "：";
        applyPromptValue(`${trimmedChoice}${separator}${currentPrompt}`);
      }

      setFormError(null);
    },
    [applyPromptValue, locale, prompt]
  );

  const isExternalFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types || []).includes("Files");

  const handleDragOver = (e: React.DragEvent) => {
    if (draggedReferenceIndex !== null || !isExternalFileDrag(e)) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (draggedReferenceIndex !== null) return;
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (draggedReferenceIndex !== null || !isExternalFileDrag(e)) {
      return;
    }

    e.preventDefault();
    setIsDragOver(false);

    if (effectiveMaxReferenceImages <= 0) {
      return;
    }

    if (selectedImageForGeneration) {
      setSelectedImageForGeneration(null);
      setShowSelectedImageModelWarning(false);
      showToast(t("toast.switched_to_uploaded_image") || "已切換為上傳圖片，已取消已選擇圖片");
    }

    const imageFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.type.startsWith("image/")
    );

    if (imageFiles.length === 0) {
      showToast(t("toast.please_drag_image"), true);
      return;
    }

    const filesToUpload = imageFiles.slice(
      0,
      Math.max(0, effectiveMaxReferenceImages - uploadedImages.length)
    );
    if (filesToUpload.length === 0) {
      showToast(
        t("toast.max_reference_images", {
          count: effectiveMaxReferenceImages,
        }) || `最多只能加入 ${effectiveMaxReferenceImages} 張參考圖片`,
        true
      );
      return;
    }

    showPendingReferencePreviews(filesToUpload);
    setPendingReferenceCount(filesToUpload.length);
    setIsUploadingReferences(true);
    const result = await uploadReferenceImages(filesToUpload);
    setPendingReferenceCount(0);
    setIsUploadingReferences(false);
    clearPendingReferencePreviews();

    if (result.success && result.images.length > 0) {
      setUploadedImages((prev) =>
        [...prev, ...result.images].slice(0, effectiveMaxReferenceImages)
      );

      if (prompt.trim() === "") {
        showToast(t("toast.image_uploaded_style_transfer"), false);
      }
    } else {
      showToast(result.error || t("toast.image_upload_failed"), true);
    }
  };

  const handleStyleTransferFileSelect = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const imageFiles = Array.from(e.target.files || []).filter((file) =>
      file.type.startsWith("image/")
    );
    if (imageFiles.length > 0) {
      if (selectedImageForGeneration) {
        setSelectedImageForGeneration(null);
        setShowSelectedImageModelWarning(false);
        showToast(t("toast.switched_to_uploaded_image") || "已切換為上傳圖片，已取消已選擇圖片");
      }

      const filesToUpload = imageFiles.slice(
        0,
        Math.max(0, effectiveMaxReferenceImages - uploadedImages.length)
      );
      if (filesToUpload.length === 0) {
        showToast(
          t("toast.max_reference_images", {
            count: effectiveMaxReferenceImages,
          }) || `最多只能加入 ${effectiveMaxReferenceImages} 張參考圖片`,
          true
        );
        e.target.value = "";
        return;
      }

      showPendingReferencePreviews(filesToUpload);
      setPendingReferenceCount(filesToUpload.length);
      setIsUploadingReferences(true);
      const result = await uploadReferenceImages(filesToUpload);
      setPendingReferenceCount(0);
      setIsUploadingReferences(false);
      clearPendingReferencePreviews();

      if (result.success && result.images.length > 0) {
        setUploadedImages((prev) =>
          [...prev, ...result.images].slice(0, effectiveMaxReferenceImages)
        );

        if (prompt.trim() === "") {
          showToast(t("toast.image_uploaded_style_transfer"), false);
        }
      } else {
        showToast(result.error || t("toast.image_upload_failed"), true);
      }
    }
    e.target.value = "";
  };

  const moveUploadedReference = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;

      setUploadedImages((prev) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev;
        }

        const next = [...prev];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        return next;
      });
    },
    []
  );

  const handleReferenceTrigger = useCallback(
    (e?: { preventDefault?: () => void }) => {
      const canAttachImage = effectiveMaxReferenceImages > 0;
      const canAttachExtraMedia = canAttachAudio || canAttachMotionVideo;

      if (!canAttachImage && !canAttachExtraMedia) {
        e?.preventDefault?.();
        return;
      }

      setShowStyleTransferMenu(true);
    },
    [canAttachAudio, canAttachMotionVideo, effectiveMaxReferenceImages]
  );

  const uploadReferenceImages = async (
    files: File[]
  ): Promise<{
    success: boolean;
    images: { file: File; name: string; url?: string }[];
    error?: string;
  }> => {
    try {
      const uploaded: { file: File; name: string; url?: string }[] = [];

      for (const originalFile of files) {
        let file = originalFile;

        if (!file.type.startsWith("image/")) {
          return { success: false, images: [], error: "只支援圖片檔案格式" };
        }

        const maxSize = 1 * 1024 * 1024;
        if (file.size > maxSize) {
          const compressionResult = await ImageCompressor.compressImage(file, {
            maxSizeMB: 1,
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 1,
            format: "jpeg",
          });

          file = compressionResult.file;
        }

        const formData = new FormData();
        formData.append("image", file);

        const uploadResponse = await fetch("/api/image-processing/upload", {
          method: "POST",
          credentials: "include",
          body: formData,
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          throw new Error(errorData.error || "圖片上傳失敗");
        }

        const uploadData = await uploadResponse.json();

        if (!uploadData.ok) {
          showToast(t("toast.image_upload_failed"), true);
          return {
            success: false,
            images: [],
            error: t("toast.image_upload_failed"),
          };
        }

        uploaded.push({
          file,
          name: uploadData.imageName,
          url: normalizeMediaUrl(uploadData.url),
        });
      }

      return {
        success: true,
        images: uploaded,
      };
    } catch (error) {
      return {
        success: false,
        images: [],
        error: error instanceof Error ? error.message : "圖片上傳失敗",
      };
    }
  };

  const uploadAudioFile = useCallback(async (
    file: File
  ): Promise<{
    success: boolean;
    url?: string;
    audioName?: string;
    originalName?: string;
    durationSeconds?: number;
    error?: string;
  }> => {
    try {
      const formData = new FormData();
      formData.append("audio", file);

      const uploadResponse = await fetch("/api/image-processing/upload/audio", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      let uploadData: {
        ok?: boolean;
        url?: string;
        audioName?: string;
        originalName?: string;
        durationSeconds?: number;
        error?: string;
        detail?: string;
      } | null = null;

      try {
        uploadData = await uploadResponse.json();
      } catch {
        uploadData = null;
      }

      if (!uploadResponse.ok || !uploadData?.ok) {
        return {
          success: false,
          error:
            uploadData?.detail ||
            uploadData?.error ||
            (locale === "zh-TW"
              ? "音訊上傳失敗"
              : locale === "ja"
                ? "音声のアップロードに失敗しました"
                : "Failed to upload audio"),
        };
      }

      return {
        success: true,
        url: normalizeMediaUrl(uploadData.url),
        audioName: uploadData.audioName,
        originalName: uploadData.originalName,
        durationSeconds: uploadData.durationSeconds,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : locale === "zh-TW"
              ? "音訊上傳失敗"
              : locale === "ja"
                ? "音声のアップロードに失敗しました"
                : "Failed to upload audio",
      };
    }
  }, [locale]);

  const uploadMotionVideoFile = useCallback(async (
    file: File
  ): Promise<{
    success: boolean;
    url?: string;
    videoName?: string;
    originalName?: string;
    error?: string;
  }> => {
    try {
      const formData = new FormData();
      formData.append("video", file);

      const uploadResponse = await fetch("/api/image-processing/upload/video", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      let uploadData: {
        ok?: boolean;
        url?: string;
        videoName?: string;
        originalName?: string;
        error?: string;
        detail?: string;
      } | null = null;

      try {
        uploadData = await uploadResponse.json();
      } catch {
        uploadData = null;
      }

      if (!uploadResponse.ok || !uploadData?.ok) {
        return {
          success: false,
          error:
            uploadData?.detail ||
            uploadData?.error ||
            (locale === "zh-TW"
              ? "動作影片上傳失敗"
              : locale === "ja"
                ? "動画のアップロードに失敗しました"
                : "Failed to upload motion video"),
        };
      }

      return {
        success: true,
        url: normalizeMediaUrl(uploadData.url || uploadData.videoName),
        videoName: uploadData.videoName,
        originalName: uploadData.originalName,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : locale === "zh-TW"
              ? "動作影片上傳失敗"
              : locale === "ja"
                ? "動画のアップロードに失敗しました"
                : "Failed to upload motion video",
      };
    }
  }, [locale]);

  const handleAudioFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) return;

      const isValidAudio =
        file.type.startsWith("audio/") ||
        /\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name);

      if (!isValidAudio) {
        showToast(
          locale === "zh-TW"
            ? "請上傳 mp3 或 wav 音訊檔"
            : locale === "ja"
              ? "mp3 または wav 音声ファイルをアップロードしてください"
              : "Please upload an mp3 or wav audio file",
          true
        );
        return;
      }

      setIsUploadingAudio(true);
      const result = await uploadAudioFile(file);
      setIsUploadingAudio(false);

      if (!result.success || !result.url) {
        showToast(
          result.error ||
            (locale === "zh-TW"
              ? "音訊上傳失敗"
              : locale === "ja"
                ? "音声のアップロードに失敗しました"
                : "Failed to upload audio"),
          true
        );
        return;
      }

      setAudioUrl(result.url);
      setAudioFileName(result.originalName || file.name);
      setMotionVideoUrl("");
      setMotionVideoFileName("");
    },
    [locale, uploadAudioFile]
  );

  const handleMotionVideoFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) return;

      const isValidVideo =
        file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name);

      if (!isValidVideo) {
        showToast(
          locale === "zh-TW"
            ? "請上傳 mp4 或 mov 影片"
            : locale === "ja"
              ? "mp4 または mov 動画をアップロードしてください"
              : "Please upload an mp4 or mov video",
          true
        );
        return;
      }

      if (canAttachMotionVideo) {
        const maxSizeBytes = 100 * 1024 * 1024;
        if (file.size > maxSizeBytes) {
          showToast(
            locale === "zh-TW"
              ? "影片檔案過大，請控制在 100MB 以內"
              : locale === "ja"
                ? "動画ファイルが大きすぎます。100MB以下にしてください"
                : "Video file is too large. Please keep it under 100MB.",
            true
          );
          return;
        }

        try {
          const durationSeconds = await new Promise<number>((resolve, reject) => {
            const video = document.createElement("video");
            const objectUrl = URL.createObjectURL(file);
            video.preload = "metadata";
            video.onloadedmetadata = () => {
              const value = Number(video.duration) || 0;
              URL.revokeObjectURL(objectUrl);
              resolve(value);
            };
            video.onerror = () => {
              URL.revokeObjectURL(objectUrl);
              reject(new Error("video-metadata-read-failed"));
            };
            video.src = objectUrl;
          });

          const minSeconds = Math.max(
            0,
            Number(videoUploadParam?.min) ||
              Number(selectedCapabilityModel?.limits?.minReferenceVideoSeconds) ||
              (isVideoFaceSwapMode ? 1 : 0)
          );
          const maxSeconds = Math.max(
            minSeconds || 0,
            Number(videoUploadParam?.max) ||
              Number(selectedCapabilityModel?.limits?.maxReferenceVideoSeconds) ||
              120
          );

          if (
            durationSeconds > 0 &&
            ((minSeconds > 0 && durationSeconds < minSeconds) ||
              (maxSeconds > 0 && durationSeconds > maxSeconds))
          ) {
            showToast(
              locale === "zh-TW"
                ? `影片長度需介於 ${minSeconds || 1} 到 ${maxSeconds} 秒`
                : locale === "ja"
                  ? `動画の長さは${minSeconds || 1}秒から${maxSeconds}秒の範囲にしてください`
                  : `Video length must be between ${minSeconds || 1} and ${maxSeconds} seconds.`,
              true
            );
            return;
          }
        } catch {
          // 無法讀取 metadata 時不阻擋，交由後端做最終驗證
        }
      }

      setIsUploadingMotionVideo(true);
      const result = await uploadMotionVideoFile(file);
      setIsUploadingMotionVideo(false);

      if (!result.success || !result.url) {
        showToast(
          result.error ||
            (locale === "zh-TW"
              ? "動作影片上傳失敗"
              : locale === "ja"
                ? "動画のアップロードに失敗しました"
                : "Failed to upload motion video"),
          true
        );
        return;
      }

      setMotionVideoUrl(result.url);
      setMotionVideoFileName(result.originalName || file.name);
      setAudioUrl("");
      setAudioFileName("");
    },
    [
      canAttachMotionVideo,
      isVideoFaceSwapMode,
      locale,
      selectedCapabilityModel?.limits?.maxReferenceVideoSeconds,
      selectedCapabilityModel?.limits?.minReferenceVideoSeconds,
      uploadMotionVideoFile,
      videoUploadParam?.max,
      videoUploadParam?.min,
    ]
  );

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const text = e.clipboardData.getData("text/plain");

    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      if (effectiveMaxReferenceImages <= 0) {
        return;
      }
      {
        const remainingSlots = Math.max(0, effectiveMaxReferenceImages - uploadedImages.length);
        if (remainingSlots > 0) {
          const filesToUpload = imageFiles.slice(0, remainingSlots);
          showPendingReferencePreviews(filesToUpload);
          setPendingReferenceCount(filesToUpload.length);
          setIsUploadingReferences(true);
          const result = await uploadReferenceImages(filesToUpload);
          setPendingReferenceCount(0);
          setIsUploadingReferences(false);
          clearPendingReferencePreviews();
          
          if (result.success && result.images.length > 0) {
            setUploadedImages((prev) =>
              [...prev, ...result.images].slice(0, effectiveMaxReferenceImages)
            );
            if (prompt.trim() === "") {
              showToast(t("toast.image_uploaded_style_transfer"), false);
            }
          } else {
            showToast(result.error || t("toast.image_upload_failed"), true);
          }
        } else {
          showToast(
            t("toast.max_reference_images", { count: effectiveMaxReferenceImages }) || 
              `最多只能加入 ${effectiveMaxReferenceImages} 張參考圖片`,
            true
          );
        }
      }
    }

    if (text) {
      document.execCommand("insertText", false, text);
    }
  };

  return (
    <div className="flex w-full flex-col bg-transparent">
      <div className="mx-auto w-full max-w-3xl px-0 py-0 sm:px-4 lg:px-0">
        <form ref={formRef} onSubmit={handleSubmit} className="w-full">
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative z-10 m-auto flex w-full flex-col overflow-visible rounded-[32px]
                   border bg-[#f8fbff] p-4 text-custom-black
                   shadow-[0_18px_40px_rgba(16,36,58,0.08)]
                   transition-all duration-200 cursor-text sm:mx-0
                   hover:border-[#b9d2e7]
                   focus-within:border-[#53c7ff]
                   dark:border-[#223446] dark:bg-[#101a26] dark:text-white
                   dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]
                   dark:hover:border-[#35516b]
                   dark:focus-within:border-[#53c7ff]
                   ${hasPromptError || hasReferenceError || hasCountError || hasAspectRatioError
                ? "border-red-400 ring-1 ring-red-200 dark:border-red-500/70 dark:ring-red-500/20"
                : "border-[#dbe9f4]"
              }
                   ${isDragOver
                ? "border-[#53c7ff]/50 bg-[#eef7fe] dark:bg-[#152331]"
                : ""
              }`}
          >
            <input
              ref={referenceInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleStyleTransferFileSelect}
              className="hidden"
            />
            <input
              ref={audioInputRef}
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg"
              onChange={handleAudioFileSelect}
              className="hidden"
            />
            <input
              ref={motionVideoInputRef}
              type="file"
              accept=".mp4,.mov,video/mp4,video/quicktime"
              onChange={handleMotionVideoFileSelect}
              className="hidden"
            />

            {/* 上半部：圖片預覽區 */}
            <div className="w-full">
              <div className="relative flex min-w-0">
                {hasAttachedMedia && (
                  <div className="flex min-w-0 flex-col gap-2">
                    {isImageFaceSwapMode && (
                      <div className="flex flex-wrap items-center gap-2 pl-1 text-[11px] font-semibold text-[#5f7892] dark:text-[#9bb2c8]">
                        <span className="rounded-full bg-[#e7f2ff] px-2 py-0.5 text-[#0f4f8f] dark:bg-[#17314a] dark:text-[#8fd0ff]">
                          #1 {locale === "zh-TW" ? "目標圖" : locale === "ja" ? "対象画像" : "Target"}
                        </span>
                        <span className="rounded-full bg-[#f4e9ff] px-2 py-0.5 text-[#6a3ea1] dark:bg-[#2a2038] dark:text-[#cdb3ff]">
                          #2 {locale === "zh-TW" ? "臉照" : locale === "ja" ? "顔画像" : "Face"}
                        </span>
                      </div>
                    )}
                    <div className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto overflow-y-hidden whitespace-nowrap pr-1">
                      {selectedImageForGeneration ? (
                        <div
                          className={`relative h-20 w-20 overflow-hidden rounded-xl border shadow-sm ${showSelectedImageModelWarning
                              ? "border-yellow-500 bg-yellow-900/20"
                              : "border-[#ddd2ef] bg-[#f4f0fb] dark:border-[#433357] dark:bg-[#211b2c]"
                            }`}
                        >
                          {isVideoUrl(selectedImageForGeneration.url) ? (
                            <video
                              src={selectedImageForGeneration.url}
                              className={`h-full w-full object-cover object-center ${showSelectedImageModelWarning
                                  ? "opacity-50 brightness-60 saturate-0"
                                  : "opacity-100"
                                }`}
                              muted
                              playsInline
                              autoPlay
                              loop
                            />
                          ) : (
                            <Image
                              src={selectedImageForGeneration.url || ""}
                              alt={t("style_transfer_image_preview")}
                              priority={true}
                              quality={90}
                              sizes="80px"
                              fill
                              className={`object-cover object-center ${showSelectedImageModelWarning
                                  ? "opacity-50 brightness-60 saturate-0"
                                  : "opacity-100"
                                }`}
                            />
                          )}
                          {showSelectedImageModelWarning && (
                            <div className="absolute bottom-1 left-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-xs text-white shadow-sm">
                              <AlertTriangle size={8} />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setSelectedImageForGeneration(null);
                              setShowSelectedImageModelWarning(false);
                            }}
                            type="button"
                            className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-sm transition-colors hover:bg-red-600"
                            title={t("remove_image_switch_prompt")}
                          >
                            <X size={8} />
                          </button>
                          <div className="absolute bottom-1 left-1 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-white backdrop-blur-sm">
                            {isImageFaceSwapMode
                              ? `#1 ${locale === "zh-TW" ? "目標圖" : locale === "ja" ? "対象画像" : "Target"}`
                              : isVideoFaceSwapMode
                                ? `#1 ${locale === "zh-TW" ? "臉照" : locale === "ja" ? "顔画像" : "Face"}`
                                : locale === "zh-TW"
                                  ? "主圖"
                                  : locale === "ja"
                                    ? "メイン"
                                    : "Main"}
                          </div>
                        </div>
                      ) : (
                        previewUrls.map((preview, index) => (
                          <div
                            key={`${preview.name}-${index}`}
                            draggable
                            onDragStart={(e) => {
                              setDraggedReferenceIndex(index);
                              setDraggedOverReferenceIndex(index);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (draggedReferenceIndex !== null) {
                                setDraggedOverReferenceIndex(index);
                              }
                            }}
                            onDragEnd={() => {
                              setDraggedReferenceIndex(null);
                              setDraggedOverReferenceIndex(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (draggedReferenceIndex === null) return;
                              moveUploadedReference(draggedReferenceIndex, index);
                              setDraggedReferenceIndex(null);
                              setDraggedOverReferenceIndex(null);
                            }}
                            className={`relative h-20 w-20 overflow-hidden rounded-2xl border shadow-sm ${showModelWarning
                              ? "border-yellow-500 bg-yellow-900/20"
                              : draggedReferenceIndex === index
                                ? "border-[#53c7ff] bg-[#e8f3fd] opacity-50 dark:border-[#2f4b68] dark:bg-[#122131]"
                                : draggedOverReferenceIndex === index
                                  ? "border-[#53c7ff] bg-[#edf5fd] ring-2 ring-[#53c7ff]/15 dark:border-[#3a5f86] dark:bg-[#17314a]"
                                : "border-[#dbe9f4] bg-[#f4f9fd] dark:border-[#243a52] dark:bg-[#101a26]"
                              }`}
                          >
                            <Image
                              src={preview.url}
                              alt={`${t("style_transfer_image_preview")} ${index + 1}`}
                              priority={true}
                              quality={90}
                              sizes="80px"
                              fill
                              className={`object-cover object-center ${showModelWarning
                                ? "opacity-50 brightness-60 saturate-0"
                                : "opacity-100"
                                }`}
                            />
                            {showModelWarning && index === 0 && (
                              <div className="absolute bottom-1 left-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-xs text-white shadow-sm">
                                <AlertTriangle size={8} />
                              </div>
                            )}
                            <button
                              onClick={() => {
                                setUploadedImages((prev) =>
                                  prev.filter((_, imageIndex) => imageIndex !== index)
                                );
                                setShowModelWarning(false);
                              }}
                              type="button"
                              className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-sm transition-colors hover:bg-red-600"
                              title={t("remove_image_switch_prompt")}
                            >
                              <X size={8} />
                            </button>
                            {getReferenceSlotLabel(index, Boolean(selectedImageForGeneration)) && (
                              <div className="absolute bottom-1 left-1 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-white backdrop-blur-sm">
                                #{index + 1 + (selectedImageForGeneration ? 1 : 0)} {getReferenceSlotLabel(index, Boolean(selectedImageForGeneration))}
                              </div>
                            )}
                            {previewUrls.length > 1 && (
                              <div className="absolute bottom-1 right-1 z-10 rounded-full bg-black/40 p-1 text-white backdrop-blur-sm">
                                <GripVertical size={10} />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                      {(pendingReferencePreviews.length > 0
                        ? pendingReferencePreviews
                        : Array.from({ length: pendingReferenceCount }).map((_, index) => ({
                            id: `pending-reference-${index}`,
                            name: "",
                            url: "",
                          }))
                      ).map((pendingPreview, index) => (
                        <div
                          key={pendingPreview.id}
                          className="relative h-20 w-20 overflow-hidden rounded-2xl border border-[#dbe9f4] bg-[#f4f9fd] shadow-sm dark:border-[#243a52] dark:bg-[#101a26]"
                        >
                          {pendingPreview.url ? (
                            <Image
                              src={pendingPreview.url}
                              alt={pendingPreview.name || `${t("style_transfer_image_preview")} ${index + 1}`}
                              fill
                              unoptimized
                              sizes="80px"
                              className="object-cover object-center opacity-80"
                            />
                          ) : (
                            <div className="absolute inset-0 animate-pulse bg-[#e8f2fb]/80 dark:bg-white/5" />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
                            <div className="flex flex-col items-center gap-1 rounded-xl bg-white/75 px-2 py-1 text-[10px] font-semibold text-[#2c4358] shadow-sm dark:bg-black/45 dark:text-white">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#89a0b5]/30 border-t-[#159cff] dark:border-white/20 dark:border-t-[#53c7ff]" />
                              <span>
                                {locale === "zh-TW"
                                  ? "上傳中"
                                  : locale === "ja"
                                    ? "送信中"
                                    : "Uploading"}
                              </span>
                            </div>
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/12 to-transparent" />
                        </div>
                      ))}
                      {(isUploadingAudio || audioUrl) && canAttachAudio && (
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[#dbe9f4] bg-[#f4f9fd] shadow-sm dark:border-[#243a52] dark:bg-[#101a26]">
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#159cff] dark:text-[#53c7ff]">
                            <Mic size={20} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                            <span className="block truncate">
                              {isUploadingAudio
                                ? locale === "zh-TW"
                                  ? "上傳中"
                                  : locale === "ja"
                                    ? "送信中"
                                    : "Uploading"
                                : audioFileName || "audio"}
                            </span>
                          </div>
                          {!isUploadingAudio && (
                            <button
                              type="button"
                              onClick={() => {
                                setAudioUrl("");
                                setAudioFileName("");
                              }}
                              className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-sm transition-colors hover:bg-red-600"
                              title="移除音訊"
                            >
                              <X size={8} />
                            </button>
                          )}
                        </div>
                      )}
                      {(isUploadingMotionVideo || motionVideoUrl) && canAttachMotionVideo && (
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-[#dbe9f4] bg-[#f4f9fd] shadow-sm dark:border-[#243a52] dark:bg-[#101a26]">
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#159cff] dark:text-[#53c7ff]">
                            <Video size={20} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                            <span className="block truncate">
                              {isUploadingMotionVideo
                                ? locale === "zh-TW"
                                  ? "上傳中"
                                  : locale === "ja"
                                    ? "送信中"
                                    : "Uploading"
                                : motionVideoFileName || "motion"}
                            </span>
                          </div>
                          {!isUploadingMotionVideo && (
                            <button
                              type="button"
                              onClick={() => {
                                setMotionVideoUrl("");
                                setMotionVideoFileName("");
                              }}
                              className="absolute right-1 top-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white shadow-sm transition-colors hover:bg-red-600"
                              title="移除影片"
                            >
                              <X size={8} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    {uploadedImages.length > 0 && !isTextMode && (
                      <div className="pl-1 text-[11px] font-medium text-[#7d97b0] dark:text-[#6f8ba6]">
                        {isImageFaceSwapMode
                          ? locale === "zh-TW"
                            ? "必須 2 張：第 1 張目標圖、第 2 張臉照（可拖曳調整順序）"
                            : locale === "ja"
                              ? "2枚必須：1枚目は対象画像、2枚目は顔画像（ドラッグで順序変更可）"
                              : "Exactly 2 required: #1 target, #2 face (drag to reorder)."
                          : isVideoFaceSwapMode
                            ? locale === "zh-TW"
                              ? "第 1 張是換臉圖，請再上傳 1 支目標影片"
                              : locale === "ja"
                                ? "1枚目は顔画像です。対象動画も1本アップロードしてください"
                                : "Image 1 is face. Please also upload one target video."
                            : locale === "zh-TW"
                              ? "第一張為主要圖，可拖曳調整順序"
                              : locale === "ja"
                                ? "1枚目がメイン画像です。ドラッグで順序変更できます"
                                : "First image is primary. Drag to reorder."}
                      </div>
                    )}
                    {selectedImageForGeneration && !isTextMode && !isImageFaceSwapMode && (
                      <div className="pl-1 text-[11px] font-medium text-[#7d97b0] dark:text-[#6f8ba6]">
                        第一張參考圖會作為主要圖
                      </div>
                    )}
                    {generateType === "video" && (isTalkingAvatarModel || isMotionControlModel) && (
                      <div className="pl-1 text-[11px] font-medium text-[#7d97b0] dark:text-[#6f8ba6]">
                        {isTalkingAvatarModel
                          ? "人物對嘴：1 張人物圖 + 1 段音訊，影片長度會依音訊決定"
                          : "動作控制：1 張人物圖 + 1 支參考影片，參考影片需 3-30 秒，輸出固定 720p"}
                      </div>
                    )}
                    {isImageFaceSwapMode && (
                      <div className="pl-1 text-[11px] font-medium text-[#7d97b0] dark:text-[#6f8ba6]">
                        {locale === "zh-TW"
                          ? "圖片換臉規則：一定要 2 張（第 1 張目標圖、第 2 張臉照）"
                          : locale === "ja"
                            ? "画像フェイススワップ規則：必ず2枚（1枚目=対象、2枚目=顔）"
                            : "Image FaceSwap rule: exactly 2 images (1st target, 2nd face)."}
                      </div>
                    )}
                    {isVideoFaceSwapMode && (
                      <div className="pl-1 text-[11px] font-medium text-[#7d97b0] dark:text-[#6f8ba6]">
                        {locale === "zh-TW"
                          ? "影片換臉：請上傳 1 張換臉圖 + 1 支目標影片"
                          : locale === "ja"
                            ? "動画フェイススワップ：顔画像1枚 + 対象動画1本を追加"
                            : "Video FaceSwap: add 1 swap face image + 1 target video."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 中間：Prompt 輸入與送出按鈕 */}
            <div className="flex items-end gap-3">
              <div className="relative min-w-0 flex-1">
                <div
                  ref={inputRef}
                  contentEditable={true}
                  onInput={handleInput}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  className={`no-scrollbar relative min-h-[28px] max-h-[220px] w-full overflow-y-auto pr-2 text-[15px] font-normal leading-7 opacity-100 outline-none transition-all duration-200 dark:text-white ${
                    hasPromptError ? "text-red-700 dark:text-red-300" : "text-custom-black"
                  }`}
                  data-placeholder={currentPromptPlaceholder}
                />

                {prompt === "" &&
                  !selectedImageForGeneration &&
                  uploadedImages.length === 0 &&
                  !audioUrl &&
                  !motionVideoUrl && (
                  <div className="pointer-events-none absolute left-0 top-0 pr-12 text-[15px] text-[#7d97b0] transition-all duration-200 dark:text-[#6f8ba6]">
                    {currentPromptPlaceholder}
                  </div>
                )}

                {!isTextMode && (selectedImageForGeneration || uploadedImages.length > 0) && selectedModel && prompt === "" && (
                  <div className="pointer-events-none absolute left-0 top-0 pr-12 text-[15px] text-[#7d97b0] transition-all duration-200 dark:text-[#6f8ba6]">
                    {selectedImageForGeneration
                      ? t("selected_image_style_transfer")
                      : t("style_transfer_mode_placeholder")
                    }{" "}
                    {t("optional_prompt_hint")}
                  </div>
                )}
              </div>
            </div>

            {formError && (formError.message || formError.choices.length > 0) && (
              <div
                className={`mt-3 rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                  composerErrorTone === "amber"
                    ? "border-amber-200 bg-amber-50/90 text-amber-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100"
                    : "border-red-200 bg-red-50/90 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      composerErrorTone === "amber"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200"
                        : "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-200"
                    }`}
                  >
                    <AlertTriangle size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
                      {formError.reason === "ambiguous_intent"
                        ? locale === "zh-TW"
                          ? "需要你再確認"
                          : locale === "ja"
                            ? "確認が必要です"
                            : "Needs Clarification"
                        : formError.reason === "unsupported_request"
                          ? locale === "zh-TW"
                            ? "目前不支援"
                            : locale === "ja"
                              ? "現在は未対応です"
                              : "Not Supported"
                          : locale === "zh-TW"
                            ? "請調整輸入內容"
                            : locale === "ja"
                              ? "入力内容を調整してください"
                              : "Adjust Your Input"}
                    </div>
                    {formError.message && (
                      <div className="mt-1 leading-6">{formError.message}</div>
                    )}
                  </div>
                </div>
                {formError.choices.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formError.choices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => applyComposerChoice(choice)}
                        className={`rounded-full border bg-white px-3 py-1.5 text-xs font-medium transition dark:bg-transparent ${
                          composerErrorTone === "amber"
                            ? "border-amber-200 text-amber-800 hover:bg-amber-50 dark:border-amber-400/20 dark:text-amber-100 dark:hover:bg-amber-500/10"
                            : "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-400/20 dark:text-red-200 dark:hover:bg-red-500/10"
                        }`}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 下方工具列 */}
            <div className="mt-3 flex items-center justify-between gap-3 pt-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
                <div className="relative shrink-0" ref={typeButtonRef}>
                  <button
                    onClick={() => setShowTypeMenu((prev) => !prev)}
                    type="button"
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#d6e2ee] bg-white px-3 text-xs font-medium text-[#10243a] transition-all duration-200 hover:border-[#aacbe6] hover:bg-[#eef5fb] dark:border-[#243648] dark:bg-[#101a26] dark:text-white dark:hover:border-[#356089] dark:hover:bg-[#152231]"
                  >
                    <activeModeOption.icon size={14} />
                    <span>{activeModeOption.label}</span>
                  </button>
                </div>

                {generateType && (
                  <div className="relative shrink-0" ref={modelButtonRef}>
                    <button
                      onClick={() => setShowModelMenu((prev) => !prev)}
                      type="button"
                      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all duration-200 ${
                        selectedModel
                          ? "border-[#159cff] bg-[#e9f6ff] text-[#10243a] hover:bg-[#ddf0ff] dark:border-[#53c7ff] dark:bg-[#15283a] dark:text-white dark:hover:bg-[#1a3044]"
                          : "border-[#d6e2ee] bg-white text-[#5d7188] hover:bg-[#eef5fb] hover:text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-[#8ca2b8] dark:hover:bg-[#152231] dark:hover:text-white"
                      }`}
                    >
                      <Sparkles size={14} />
                      <span className="max-w-[9rem] truncate">
                        {selectedCapabilityModel?.label ||
                          selectedModel?.title ||
                          (locale === "zh-TW"
                            ? "選擇模型"
                            : locale === "ja"
                              ? "モデル選択"
                              : "Select model")}
                      </span>
                    </button>
                  </div>
                )}

                {canAttachReferenceImages && (
                  <div className="relative hidden shrink-0 md:block" ref={desktopStyleTransferButtonRef}>
                    <button
                      onClick={handleReferenceTrigger}
                      type="button"
                      className={`relative inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all duration-200 ${
                        hasReferenceError
                          ? "border-red-400 bg-red-50 text-red-600 dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-300"
                          : hasReferenceImages
                            ? "border-[#159cff] bg-[#e9f6ff] text-[#10243a] hover:bg-[#ddf0ff] dark:border-[#53c7ff] dark:bg-[#15283a] dark:text-white dark:hover:bg-[#1a3044]"
                            : effectiveMaxReferenceImages > 0
                              ? "border-[#d6e2ee] bg-white text-[#5d7188] hover:bg-[#eef5fb] hover:text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-[#8ca2b8] dark:hover:bg-[#152231] dark:hover:text-white"
                              : "border-[#dbe5ef] bg-[#f1f6fb] text-[#9aaab9] dark:border-[#243648] dark:bg-[#0c141d] dark:text-[#5c7186]"
                      }`}
                      title={`${t("add_style_transfer_image")} (${effectiveMaxReferenceImages})`}
                    >
                      {hasReferenceImages ? <Palette size={14} /> : <Plus size={14} />}
                      {uploadedImages.length > 0 && (
                        <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#159cff] px-1 text-[10px] font-semibold leading-none text-white dark:bg-[#53c7ff] dark:text-[#10243a]">
                          {uploadedImages.length}
                        </span>
                      )}
                    </button>
                  </div>
                )}

                <div className="hidden md:contents">
                {generateType === "image" && countParam && (
                  <div className="relative shrink-0" ref={desktopCountButtonRef}>
                    <button
                      onClick={() => setShowCountMenu((prev) => !prev)}
                      type="button"
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                        hasCountError
                          ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-300"
                          : "border-[#d6e2ee] bg-white text-[#10243a] hover:border-[#aacbe6] hover:bg-[#eef5fb] dark:border-[#243648] dark:bg-[#101a26] dark:text-white dark:hover:border-[#356089] dark:hover:bg-[#152231]"
                      }`}
                    >
                      <span className="leading-none">
                        {locale === "zh-TW" ? "張數" : locale === "ja" ? "枚数" : "Count"} {imageCount}
                      </span>
                      <ChevronDown size={12} />
                    </button>
                  </div>
                )}

                {aspectRatioParam && (generateType === "image" || showVideoAspectRatio) && (
                  <div className="relative shrink-0" ref={desktopRatioButtonRef}>
                    <button
                      onClick={() => setShowRatioMenu(!showRatioMenu)}
                      type="button"
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-white/20 ${
                        hasAspectRatioError
                          ? "border-red-400 bg-red-50 text-red-700 focus:ring-red-200 dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-300"
                          : "border-[#d6e2ee] bg-white text-[#10243a] hover:border-[#aacbe6] hover:bg-[#eef5fb] focus:ring-[#159cff]/20 dark:border-[#243648] dark:bg-[#101a26] dark:text-white dark:hover:border-[#356089] dark:hover:bg-[#152231]"
                      }`}
                      title={aspectRatioParam.label || (locale === "zh-TW" ? "選擇比例" : locale === "ja" ? "比率を選択" : "Select ratio")}
                    >
                      {isImageToImageModel && generateType === "image" ? (
                        <Palette size={12} className="text-[#159cff] dark:text-[#53c7ff]" />
                      ) : (
                        <RectangleHorizontal size={12} className="text-[#159cff] dark:text-[#53c7ff]" />
                      )}
                      <span className="leading-none">{selectedAspectRatioLabel}</span>
                    </button>
                  </div>
                )}

                {showVideoDuration && (
                  <button
                    type="button"
                    onClick={() => {
                      if (durationOptions.length > 1) {
                        const currentIndex = durationOptions.findIndex(
                          (option) => option.value === selectedDurationValue
                        );
                        const nextOption =
                          durationOptions[
                            currentIndex >= 0
                              ? (currentIndex + 1) % durationOptions.length
                              : 0
                          ];
                        setSelectedDurationValue(nextOption?.value || "");
                        return;
                      }

                      const min = Number(durationParam.min) || 4;
                      const max = Number(durationParam.max) || 15;
                      const current = Number(selectedDurationValue) || min;
                      const next = current >= max ? min : current + 1;
                      setSelectedDurationValue(String(next));
                    }}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d6e2ee] bg-white px-3 py-1.5 text-xs font-medium text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-white"
                  >
                    <span className="leading-none">
                      {selectedDurationValue
                        ? `${selectedDurationValue}s`
                        : durationParam.label}
                    </span>
                  </button>
                )}

                {resolutionParam && (generateType === "image" || showVideoResolution) && (
                  <>
                    <button
	                      type="button"
	                      onClick={() => {
	                        if (resolutionOptions.length <= 1) return;
                        const currentIndex = resolutionOptions.findIndex(
                          (option) => option.value === selectedResolutionValue
                        );
                        const nextOption =
                          resolutionOptions[
                            currentIndex >= 0
                              ? (currentIndex + 1) % resolutionOptions.length
                              : 0
                          ];
                        setSelectedResolutionValue(nextOption?.value || "");
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d6e2ee] bg-white px-3 py-1.5 text-xs font-medium text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-white"
	                    >
	                      <span className="leading-none">
	                        {selectedResolutionValue || resolutionParam.label}
	                      </span>
	                    </button>
                  </>
                )}

                {booleanParams.map((param) => {
                  const checked = Boolean(dynamicParamValues[param.key]);
                  return (
                    <button
                      key={param.key}
                      type="button"
                      onClick={() =>
                        setDynamicParamValues((prev) => ({
                          ...prev,
                          [param.key]: !Boolean(prev[param.key]),
                        }))
                      }
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                        checked
                          ? "border-[#159cff] bg-[#e9f6ff] text-[#10243a] dark:border-[#53c7ff] dark:bg-[#15283a] dark:text-white"
                          : "border-[#d6e2ee] bg-white text-[#5d7188] hover:bg-[#eef5fb] hover:text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-[#8ca2b8] dark:hover:bg-[#152231] dark:hover:text-white"
                      }`}
                    >
                      <span className="leading-none">{param.label || param.key}</span>
                    </button>
                  );
                })}

                {generateType === "audio" &&
                  selectedCapabilityModel?.submit?.modelId === "kie:ElevenLabsVoice" && (
                    <>
                      <label className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#d6e2ee] bg-white px-3 py-1.5 text-xs font-medium text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-white">
                        <span>{locale === "zh-TW" ? "格式" : locale === "ja" ? "形式" : "Format"}</span>
                        <span className="text-[#159cff] dark:text-[#53c7ff]">
                          {String(outputFormatParam?.default || "mp3_44100_128")}
                        </span>
                      </label>
                    </>
                  )}

                </div>

                <div className="flex shrink-0 items-center gap-2 md:hidden">
                  {canAttachReferenceImages && (
                    <div className="relative shrink-0" ref={mobileStyleTransferButtonRef}>
                      <button
                        onClick={handleReferenceTrigger}
                        type="button"
                        className={`relative inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-all duration-200 ${
                          hasReferenceError
                            ? "border-red-400 bg-red-50 text-red-600 dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-300"
                            : hasReferenceImages
                              ? "border-[#159cff] bg-[#e9f6ff] text-[#10243a] hover:bg-[#ddf0ff] dark:border-[#53c7ff] dark:bg-[#15283a] dark:text-white dark:hover:bg-[#1a3044]"
                              : effectiveMaxReferenceImages > 0
                                ? "border-[#d6e2ee] bg-white text-[#5d7188] hover:bg-[#eef5fb] hover:text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-[#8ca2b8] dark:hover:bg-[#152231] dark:hover:text-white"
                                : "border-[#dbe5ef] bg-[#f1f6fb] text-[#9aaab9] dark:border-[#243648] dark:bg-[#0c141d] dark:text-[#5c7186]"
                        }`}
                        title={`${t("add_style_transfer_image")} (${effectiveMaxReferenceImages})`}
                      >
                        {hasReferenceImages ? <Palette size={14} /> : <Plus size={14} />}
                        {uploadedImages.length > 0 && (
                          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#159cff] px-1 text-[10px] font-semibold leading-none text-white dark:bg-[#53c7ff] dark:text-[#10243a]">
                            {uploadedImages.length}
                          </span>
                        )}
                      </button>
                    </div>
                  )}

                  {generateType === "image" && countParam && (
                    <div className="relative shrink-0" ref={mobileCountButtonRef}>
                      <button
                        onClick={() => setShowCountMenu((prev) => !prev)}
                        type="button"
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                          hasCountError
                            ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-300"
                            : "border-[#d6e2ee] bg-white text-[#10243a] hover:border-[#aacbe6] hover:bg-[#eef5fb] dark:border-[#243648] dark:bg-[#101a26] dark:text-white dark:hover:border-[#356089] dark:hover:bg-[#152231]"
                        }`}
                      >
                        <span className="leading-none">{imageCount}</span>
                        <ChevronDown size={12} />
                      </button>
                    </div>
                  )}

                  {aspectRatioParam && (generateType === "image" || showVideoAspectRatio) && (
                    <div className="relative shrink-0" ref={mobileRatioButtonRef}>
                      <button
                        onClick={() => setShowRatioMenu(!showRatioMenu)}
                        type="button"
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                          hasAspectRatioError
                            ? "border-red-400 bg-red-50 text-red-700 dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-300"
                            : "border-[#d6e2ee] bg-white text-[#10243a] hover:border-[#aacbe6] hover:bg-[#eef5fb] dark:border-[#243648] dark:bg-[#101a26] dark:text-white dark:hover:border-[#356089] dark:hover:bg-[#152231]"
                        }`}
                      >
                        <span className="leading-none">{selectedAspectRatioLabel}</span>
                      </button>
                    </div>
                  )}

                  {showVideoDuration && (
                    <button
                      type="button"
                      onClick={() => {
                        if (durationOptions.length > 1) {
                          const currentIndex = durationOptions.findIndex(
                            (option) => option.value === selectedDurationValue
                          );
                          const nextOption =
                            durationOptions[
                              currentIndex >= 0
                                ? (currentIndex + 1) % durationOptions.length
                                : 0
                            ];
                          setSelectedDurationValue(nextOption?.value || "");
                          return;
                        }

                        const min = Number(durationParam.min) || 4;
                        const max = Number(durationParam.max) || 15;
                        const current = Number(selectedDurationValue) || min;
                        const next = current >= max ? min : current + 1;
                        setSelectedDurationValue(String(next));
                      }}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d6e2ee] bg-white px-3 py-1.5 text-xs font-medium text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-white"
                    >
                      <span className="leading-none">
                        {selectedDurationValue
                          ? `${selectedDurationValue}s`
                          : durationParam.label}
                      </span>
                    </button>
                  )}

	                  {resolutionParam && (generateType === "image" || showVideoResolution) && (
	                    <button
	                        type="button"
	                        onClick={() => {
	                          if (resolutionOptions.length <= 1) return;
                          const currentIndex = resolutionOptions.findIndex(
                            (option) => option.value === selectedResolutionValue
                          );
                          const nextOption =
                            resolutionOptions[
                              currentIndex >= 0
                                ? (currentIndex + 1) % resolutionOptions.length
                                : 0
                            ];
                          setSelectedResolutionValue(nextOption?.value || "");
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#d6e2ee] bg-white px-3 py-1.5 text-xs font-medium text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-white"
	                      >
	                        <span className="leading-none">
	                          {selectedResolutionValue || resolutionParam.label}
	                        </span>
	                      </button>
	                  )}

	                  {booleanParams.map((param) => {
	                    const checked = Boolean(dynamicParamValues[param.key]);
	                    return (
	                      <button
	                        key={param.key}
	                        type="button"
	                        onClick={() =>
	                          setDynamicParamValues((prev) => ({
	                            ...prev,
	                            [param.key]: !Boolean(prev[param.key]),
	                          }))
	                        }
	                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
	                          checked
	                            ? "border-[#159cff] bg-[#e9f6ff] text-[#10243a] dark:border-[#53c7ff] dark:bg-[#15283a] dark:text-white"
	                            : "border-[#d6e2ee] bg-white text-[#5d7188] hover:bg-[#eef5fb] hover:text-[#10243a] dark:border-[#243648] dark:bg-[#101a26] dark:text-[#8ca2b8] dark:hover:bg-[#152231] dark:hover:text-white"
	                        }`}
	                      >
	                        <span className="leading-none">{param.label || param.key}</span>
	                      </button>
	                    );
	                  })}

	                </div>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-3 self-end md:self-center">
                <div className="hidden text-[9px] font-bold uppercase tracking-[0.2em] text-[#6d87a2] dark:text-[#6b85a1] lg:block">
                  Enter
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!canSubmit || isGenerating || !formRef.current) return;
                    if (typeof formRef.current.requestSubmit === "function") {
                      formRef.current.requestSubmit();
                    } else {
                      formRef.current.dispatchEvent(
                        new Event("submit", { bubbles: true, cancelable: true })
                      );
                    }
                  }}
                  className={`
                    transition-all duration-200 ease-in-out
                    inline-flex items-center justify-center
                    h-10 w-10 rounded-full
                    focus:outline-none focus:ring-2 focus:ring-[#159cff]/20
                    disabled:pointer-events-none
                    ${isGenerating
                            ? "bg-[#17314a] text-white opacity-100 scale-100 translate-y-0 dark:bg-[#17314a]"
                            : canSubmit
                              ? "bg-black text-white hover:bg-zinc-800 active:scale-95 opacity-100 scale-100 translate-y-0 dark:bg-white dark:text-black dark:hover:bg-zinc-200"
                              : "bg-[#dfeaf4] text-[#7e96ad] opacity-100 scale-100 translate-y-0 dark:bg-[#243648] dark:text-[#7f98b1]"
                          }
                  `}
                  disabled={!canSubmit || isGenerating}
                  aria-label={
                    isGenerating
                      ? t("generating")
                      : (uploadedImages.length > 0 || selectedImageForGeneration)
                        ? t("use_style_transfer_generate")
                        : t("send_message")
                  }
                >
                  {isGenerating ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      viewBox="0 0 256 256"
                    >
                      <path d="M208.49,120.49a12,12,0,0,1-17,0L140,69V216a12,12,0,0,1-24,0V69L64.49,120.49a12,12,0,0,1-17-17l72-72a12,12,0,0,1,17,0l72,72A12,12,0,0,1,208.49,120.49Z"></path>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* 型別選單 */}
      {showTypeMenu &&
        typeof window !== "undefined" &&
        (() => {
          const buttonRect = typeButtonRef.current?.getBoundingClientRect();
          if (!buttonRect) return null;

          return createPortal(
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="fixed z-[9999] min-w-[200px] overflow-hidden rounded-2xl border border-[#dbe9f4] bg-[#f8fbff]/95 p-2 backdrop-blur-md shadow-[0_18px_50px_rgba(16,36,58,0.12)] dark:border-[#223446] dark:bg-[#111b26]/95 dark:shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
                style={{
                  bottom: window.innerHeight - buttonRect.top + 8,
                  left: Math.max(12, Math.min(buttonRect.left, window.innerWidth - 220)),
                }}
                onClick={(e) => e.stopPropagation()}
                data-type-menu
              >
                <div className="flex flex-col gap-2">
                  {renderedModeOptions.map((item) => {
                    const isActive = generateType === item.id;
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.id || "auto"}
                        type="button"
                        onClick={() => {
                          setGenerateType(item.id);
                          setSelectedModel(null);
                          setShowModelMenu(false);
                          setShowTypeMenu(false);
                        }}
                        className={`inline-flex items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-[#10243a] text-white dark:bg-[#edf6ff] dark:text-[#10243a]"
                            : "text-[#5d7188] hover:bg-[#eef5fb] hover:text-[#10243a] dark:text-[#8ca2b8] dark:hover:bg-[#152231] dark:hover:text-white"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          <Icon size={14} />
                          {item.label}
                        </span>
                        {isActive ? (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M20 6L9 17l-5-5"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          );
        })()}

      {/* 參考圖上傳選單 */}
      {showStyleTransferMenu &&
        typeof window !== "undefined" &&
        (() => {
          const buttonRect =
            desktopStyleTransferButtonRef.current?.offsetParent
              ? desktopStyleTransferButtonRef.current.getBoundingClientRect()
              : mobileStyleTransferButtonRef.current?.getBoundingClientRect();
          if (!buttonRect) return null;

          return createPortal(
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="fixed z-[9999] min-w-[220px] overflow-hidden rounded-2xl border border-[#e7ddf4] bg-[#fbf8ff]/95 p-2 backdrop-blur-md shadow-[0_18px_50px_rgba(46,30,78,0.12)] dark:border-[#2b2436] dark:bg-[#18141f]/95 dark:shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
                style={{
                  bottom: window.innerHeight - buttonRect.top + 8,
                  left: Math.min(buttonRect.left, window.innerWidth - 240),
                }}
                onClick={(e) => e.stopPropagation()}
                data-style-transfer-menu
              >
                <div className="px-2 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#89a0b5] dark:text-[#6f8ba6]">
                  {locale === "zh-TW" ? "加入素材" : locale === "ja" ? "素材を追加" : "Add Media"}
                </div>
                <div>
                  {canAttachReferenceImages && effectiveMaxReferenceImages > 0 && (
                    <label
                      className="flex cursor-pointer items-center space-x-3 rounded-xl p-2.5 transition-colors hover:bg-[#eef5fb] dark:hover:bg-[#152231]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf4fa] dark:bg-[#132131]">
                        <Palette size={16} className="text-[#159cff] dark:text-[#53c7ff]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-custom-black dark:text-white">
                          {isTalkingAvatarModel
                            ? locale === "zh-TW"
                              ? "人物圖片"
                              : locale === "ja"
                                ? "人物画像"
                                : "Avatar image"
                            : isMotionControlModel
                              ? locale === "zh-TW"
                                ? "角色圖片"
                                : locale === "ja"
                                  ? "キャラクター画像"
                                  : "Character image"
                              : locale === "zh-TW"
                                ? "上傳圖片"
                                : locale === "ja"
                                  ? "画像を追加"
                                  : "Upload image"}
                        </div>
                        <div className="text-xs text-[#7d97b0] dark:text-[#6f8ba6]">
                          {locale === "zh-TW"
                            ? `最多 ${effectiveMaxReferenceImages} 張`
                            : locale === "ja"
                              ? `最大 ${effectiveMaxReferenceImages} 枚`
                              : `Up to ${effectiveMaxReferenceImages}`}
                        </div>
                      </div>
                      <input
                        ref={referenceInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          handleStyleTransferFileSelect(e);
                          setShowStyleTransferMenu(false);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                  {canAttachAudio && (
                    <label
                      className="flex cursor-pointer items-center space-x-3 rounded-xl p-2.5 transition-colors hover:bg-[#eef5fb] dark:hover:bg-[#152231]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf4fa] dark:bg-[#132131]">
                        <FileAudio size={16} className="text-[#159cff] dark:text-[#53c7ff]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-custom-black dark:text-white">
                          {isTalkingAvatarModel
                            ? locale === "zh-TW"
                              ? "語音 / 音訊"
                              : locale === "ja"
                                ? "音声 / 音源"
                                : "Voice / audio"
                            : locale === "zh-TW"
                              ? "上傳音訊"
                              : locale === "ja"
                                ? "音声を追加"
                                : "Upload audio"}
                        </div>
                        <div className="text-xs text-[#7d97b0] dark:text-[#6f8ba6]">
                          mp3 / wav
                        </div>
                      </div>
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/ogg"
                        onChange={(e) => {
                          handleAudioFileSelect(e);
                          setShowStyleTransferMenu(false);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                  {canAttachMotionVideo && (
                    <label
                      className="flex cursor-pointer items-center space-x-3 rounded-xl p-2.5 transition-colors hover:bg-[#eef5fb] dark:hover:bg-[#152231]"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf4fa] dark:bg-[#132131]">
                        <Video size={16} className="text-[#159cff] dark:text-[#53c7ff]" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-custom-black dark:text-white">
                          {isMotionControlModel
                            ? locale === "zh-TW"
                              ? "動作參考影片"
                              : locale === "ja"
                                ? "動作参照動画"
                                : "Reference motion video"
                            : locale === "zh-TW"
                              ? "上傳動作影片"
                              : locale === "ja"
                                ? "動作動画を追加"
                                : "Upload motion video"}
                        </div>
                        <div className="text-xs text-[#7d97b0] dark:text-[#6f8ba6]">
                          {isMotionControlModel ? "3-30s / mp4 / mov" : "mp4 / mov"}
                        </div>
                      </div>
                      <input
                        ref={motionVideoInputRef}
                        type="file"
                        accept=".mp4,.mov,video/mp4,video/quicktime"
                        onChange={(e) => {
                          handleMotionVideoFileSelect(e);
                          setShowStyleTransferMenu(false);
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          );
        })()}

      {showModelMenu &&
        typeof window !== "undefined" &&
        (() => {
          const buttonRect = modelButtonRef.current?.getBoundingClientRect();
          if (!buttonRect) return null;
          const gap = 10;
          const menuWidth = Math.min(304, window.innerWidth - 24);
          const spaceAbove = buttonRect.top - gap - 12;
          const spaceBelow = window.innerHeight - buttonRect.bottom - gap - 12;
          const openDown = spaceBelow > spaceAbove || spaceAbove < 320;
          const maxMenuHeight = Math.max(
            220,
            Math.min(448, openDown ? spaceBelow : spaceAbove)
          );
          const menuLeft = Math.min(
            Math.max(12, buttonRect.left),
            window.innerWidth - menuWidth - 12
          );

          return createPortal(
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 10 }}
                transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                className="fixed z-[9999] w-[min(304px,calc(100vw-24px))] overflow-hidden rounded-[22px] border border-[#dbe9f4] bg-[#f8fbff] shadow-[0_18px_42px_rgba(16,36,58,0.14)] dark:border-[#1d3147] dark:bg-[#101a26] dark:shadow-[0_20px_44px_rgba(0,0,0,0.42)]"
                style={{
                  ...(openDown
                    ? { top: buttonRect.bottom + gap }
                    : { bottom: window.innerHeight - buttonRect.top + gap }),
                  left: menuLeft,
                  maxHeight: maxMenuHeight,
                }}
                onClick={(e) => e.stopPropagation()}
                data-model-menu
              >
                <div className="border-b border-[#eadff7] px-3 py-2.5 dark:border-white/6">
                  <div className="flex items-center gap-2 text-[#89a0b5] dark:text-[#6f8ba6]">
                    <Sparkles className="h-3.5 w-3.5" />
                    <p className="text-[11px] font-medium">
                      {locale === "zh-TW"
                        ? `選擇${selectedMediaGroup?.label || "模型"}`
                        : locale === "ja"
                          ? `${selectedMediaGroup?.label || "モデル"}を選択`
                          : `Choose ${selectedMediaGroup?.label?.toLowerCase() || "model"}`}
                    </p>
                  </div>
                </div>

                <div
                  className="content-scrollbar overflow-y-auto p-0"
                  style={{ maxHeight: Math.max(140, maxMenuHeight - 92) }}
                >
                  {isLoadingModelMenu ? (
                    <div className="flex items-center justify-center py-10 text-sm text-[#89a0b5] dark:text-[#6f8ba6]">
                      {tm("loading_models")}
                    </div>
                  ) : filteredMenuModels.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-sm text-[#89a0b5] dark:text-[#6f8ba6]">
                      {tm("no_models_found")}
                    </div>
                  ) : (
                    <div className="space-y-0 px-3 py-2">
                      {filteredMenuModels.map((model) => {
                        let coverUrl = "";
                        if (typeof model.cover === "string") {
                          const trimmedCover = model.cover.trim();
                          if (trimmedCover.startsWith("http") || trimmedCover.startsWith("/")) {
                            coverUrl = trimmedCover;
                          } else {
                            try {
                              coverUrl = ((JSON.parse(trimmedCover) as Media)?.url || "");
                            } catch {
                              coverUrl = "";
                            }
                          }
                        } else if (
                          model.cover &&
                          typeof model.cover === "object" &&
                          "url" in (model.cover as Record<string, unknown>)
                        ) {
                          coverUrl = String(
                            (model.cover as Record<string, unknown>).url || ""
                          );
                        }

                        const isSelected = selectedCapabilityModel?.id === model.id;
                        const modelBadges = getModelCapabilityBadges(model);

                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              const nextType = resolveCapabilitySubmitType(model.kind);
                              if (nextType) {
                                setGenerateType(nextType);
                              }
                              setSelectedModel(model as unknown as LoraModel);
                              setFormError(null);
                              setShowModelMenu(false);
                            }}
                            className={`mb-1 flex w-full items-center gap-2.5 rounded-xl pl-1.5 pr-2.5 py-1.5 text-left transition-colors ${
                              isSelected
                                ? "bg-[#edf5fd] dark:bg-white/[0.07]"
                                : "hover:bg-[#f6fbff] dark:hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eef5fb] text-[#159cff] shadow-[inset_0px_2px_3px_0px_rgba(255,255,255,0.2)] dark:bg-white/[0.05] dark:text-[#53c7ff] dark:shadow-[inset_0px_2px_3px_0px_rgba(255,255,255,0.03)]">
                              {coverUrl ? (
                                <Image
                                  src={coverUrl}
                                  alt={model.label}
                                  fill
                                  sizes="36px"
                                  className="object-cover"
                                />
                              ) : (
                                <Sparkles className="h-3.5 w-3.5" />
                              )}
                            </div>

                            <div className="min-w-0 flex flex-1 flex-col gap-1 items-start">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[12px] font-semibold text-[#10243a] dark:text-white">
                                  {model.label}
                                </span>
                                {!model.providerHidden && (
                                  <span className="rounded-full bg-[#eef5fb] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-[#5d7188] dark:bg-white/[0.06] dark:text-[#89a0b5]">
                                    {model.source}
                                  </span>
                                )}
                              </div>
                              <p className="line-clamp-2 text-[10px] leading-[1.25] text-[#7d97b0] dark:text-[#89a0b5]">
                                {model.description?.trim() ||
                                  model.workflow?.trim() ||
                                  model.modelId}
                              </p>
                              {modelBadges.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {modelBadges.map((badge) => (
                                    <span
                                      key={`${model.id}-${badge}`}
                                      className="rounded-full border border-[#d8e7f5] bg-white/70 px-1.5 py-0.5 text-[9px] font-medium leading-none text-[#5f7891] dark:border-white/10 dark:bg-white/[0.04] dark:text-[#9bb2c8]"
                                    >
                                      {badge}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="h-4.5 w-4.5 shrink-0">
                              {isSelected ? (
                                <svg
                                  className="h-full w-full text-[#159cff] dark:text-[#53c7ff]"
                                  width="24"
                                  height="24"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
                                  <path
                                    d="M20 6L9 17l-5-5"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="border-t border-[#eadff7] px-3 py-2 dark:border-white/6">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-[#89a0b5] dark:text-[#6f8ba6]">
                      {filteredMenuModels.length} {tm("models_count")}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModelMenu(false);
                        setIsModelSelectorOpen(true);
                      }}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#eef5fb] text-[#159cff] transition-colors hover:bg-[#e3effa] dark:bg-white/[0.05] dark:text-white dark:hover:bg-white/[0.08]"
                      title={tm("model_gallery_title")}
                      aria-label={tm("model_gallery_title")}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 256 256"
                      >
                        <path d="M216,48H40A16,16,0,0,0,24,64V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V64A16,16,0,0,0,216,48ZM40,64H216V148.69l-44.69-44.68a16,16,0,0,0-22.62,0L96,156.69,75.31,136a16,16,0,0,0-22.62,0L40,148.69ZM40,192V171.31l24-24L96,179.31,148.69,126.63,216,193v1Z"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          );
        })()}

      {/* 張數選擇選單 (Count Menu) */}
      {countParam &&
        generateType === "image" &&
        showCountMenu &&
        typeof window !== "undefined" &&
        (() => {
          const buttonRect =
            desktopCountButtonRef.current?.offsetParent
              ? desktopCountButtonRef.current.getBoundingClientRect()
              : mobileCountButtonRef.current?.getBoundingClientRect();
          if (!buttonRect) return null;
          const gap = 8;
          const menuWidth = 150;
          const estimatedHeight = Math.max(52, countOptions.length * 44 + 8);
          const spaceAbove = buttonRect.top - gap - 12;
          const spaceBelow = window.innerHeight - buttonRect.bottom - gap - 12;
          const openDown = spaceBelow >= estimatedHeight || spaceBelow > spaceAbove;

          return createPortal(
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="fixed z-[9999] min-w-[130px] overflow-hidden rounded-xl border border-[#dbe9f4] bg-custom-white shadow-[0_24px_60px_rgba(16,36,58,0.12)] dark:border-[#1d3147] dark:bg-[#101a26] dark:shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
                style={{
                  ...(openDown
                    ? { top: buttonRect.bottom + gap }
                    : { bottom: window.innerHeight - buttonRect.top + gap }),
                  left: Math.min(Math.max(12, buttonRect.left), window.innerWidth - menuWidth - 12),
                  maxHeight: Math.max(120, openDown ? spaceBelow : spaceAbove),
                }}
                onClick={(e) => e.stopPropagation()}
                data-count-menu
              >
                <div
                  className="p-1 flex flex-col gap-1 overflow-y-auto"
                  style={{ maxHeight: Math.max(112, openDown ? spaceBelow : spaceAbove) }}
                >
                  {countOptions.map((count) => (
                    <button
                      key={count}
                      onClick={() => {
                        setImageCount(count);
                        setShowCountMenu(false);
                      }}
                      className={`
                        flex w-full items-center justify-between rounded-md p-2 text-left transition-colors
                        ${imageCount === count
                          ? "bg-[#e8f3fd] text-[#10243a] dark:bg-[#17314a] dark:text-white"
                          : "text-[#7d97b0] hover:bg-[#eef5fb] hover:text-[#10243a] dark:text-[#6f8ba6] dark:hover:bg-[#132131] dark:hover:text-white"
                        }
                      `}
                    >
                      <span className="text-sm font-medium">
                        {locale === "zh-TW"
                          ? `${count} 張`
                          : locale === "ja"
                            ? `${count} 枚`
                            : `${count} image${count > 1 ? "s" : ""}`}
                      </span>
                      {imageCount === count ? (
                        <span className="h-2 w-2 rounded-full bg-[#159cff] dark:bg-[#53c7ff]" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          );
        })()}

      {aspectRatioParam &&
        (generateType === "video" || generateType === "image") &&
        showRatioMenu &&
        typeof window !== "undefined" &&
        (() => {
          const buttonRect =
            desktopRatioButtonRef.current?.offsetParent
              ? desktopRatioButtonRef.current.getBoundingClientRect()
              : mobileRatioButtonRef.current?.getBoundingClientRect();
          if (!buttonRect) return null;
          const gap = 8;
          const menuWidth = 170;
          const estimatedHeight = Math.max(52, aspectRatioOptions.length * 48 + 8);
          const spaceAbove = buttonRect.top - gap - 12;
          const spaceBelow = window.innerHeight - buttonRect.bottom - gap - 12;
          const openDown = spaceBelow >= estimatedHeight || spaceBelow > spaceAbove;

          return createPortal(
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="fixed z-[9999] min-w-[150px] overflow-hidden rounded-xl border border-[#dbe9f4] bg-custom-white shadow-[0_24px_60px_rgba(16,36,58,0.12)] dark:border-[#1d3147] dark:bg-[#101a26] dark:shadow-[0_24px_60px_rgba(0,0,0,0.48)]"
                style={{
                  ...(openDown
                    ? { top: buttonRect.bottom + gap }
                    : { bottom: window.innerHeight - buttonRect.top + gap }),
                  left: Math.min(Math.max(12, buttonRect.left), window.innerWidth - menuWidth - 12),
                  maxHeight: Math.max(120, openDown ? spaceBelow : spaceAbove),
                }}
                onClick={(e) => e.stopPropagation()}
                data-ratio-menu
              >
                <div
                  className="p-1 flex flex-col gap-1 overflow-y-auto"
                  style={{ maxHeight: Math.max(112, openDown ? spaceBelow : spaceAbove) }}
                >
                  {aspectRatioOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSelectedAspectRatioValue(option.value);
                        setShowRatioMenu(false);
                      }}
                      className={`
                        flex items-center space-x-3 p-2 rounded-md transition-colors w-full text-left
                        ${selectedAspectRatioValue === option.value
                          ? "bg-[#e8f3fd] text-[#10243a] dark:bg-[#17314a] dark:text-white"
                          : "text-[#7d97b0] hover:bg-[#eef5fb] hover:text-[#10243a] dark:text-[#6f8ba6] dark:hover:bg-[#132131] dark:hover:text-white"
                        }
                      `}
                    >
                      <div className="flex items-center justify-center w-6">
                        <RectangleHorizontal size={16} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {option.label || option.value}
                        </div>
                        <div className="text-xs opacity-70">
                          {option.value || aspectRatioParam.placeholder || "Auto"}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>,
            document.body
          );
        })()}
      <style jsx>{`
        .no-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
    </div>
  );
}
