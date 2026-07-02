"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import TemplateMediaViewer from "./TemplateMediaViewer";

const isVideoUrl = (url?: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");
const normalizeTemplateMediaUrl = (media?: { url?: string; filename?: string } | null): string => {
  const raw = String(media?.url || media?.filename || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  if (raw.startsWith("media/")) return `/${raw}`;
  return `/media/${raw}`;
};

type TemplateDetail = {
  id: string;
  title: string;
  slug: string;
  category: "image" | "video";
  summary?: string;
  prompt?: string;
  negativePrompt?: string;
  tags?: string[];
  isFeatured?: boolean;
  cover?: {
    url?: string;
    filename?: string;
    alt?: string;
  } | null;
  imageConfig?: {
    referenceImages?: Array<{ id?: string; url?: string; filename?: string }>;
    defaultAspectRatio?: string;
    defaultCount?: number;
    suggestedModel?: string;
  } | null;
  videoConfig?: {
    demoPoster?: { url?: string; filename?: string } | null;
    demoVideo?: { url?: string; filename?: string } | null;
  } | null;
};

const copyByLocale = {
  "zh-TW": {
    back: "返回模板區",
    loading: "載入模板中...",
    notFound: "找不到這個模板",
    prompt: "模板提示詞",
    negativePrompt: "負面提示詞",
    references: "參考素材",
    model: "建議模型",
    aspectRatio: "預設比例",
    count: "預設張數",
    useTemplate: "使用此模板",
    viewDemo: "查看展示",
    enlarge: "放大",
    close: "關閉",
  },
  en: {
    back: "Back to Templates",
    loading: "Loading template...",
    notFound: "Template not found",
    prompt: "Prompt",
    negativePrompt: "Negative Prompt",
    references: "References",
    model: "Suggested Model",
    aspectRatio: "Default Ratio",
    count: "Default Count",
    useTemplate: "Use Template",
    viewDemo: "View Demo",
    enlarge: "Enlarge",
    close: "Close",
  },
  ja: {
    back: "テンプレート一覧へ戻る",
    loading: "テンプレートを読み込み中...",
    notFound: "テンプレートが見つかりません",
    prompt: "プロンプト",
    negativePrompt: "ネガティブプロンプト",
    references: "参考素材",
    model: "推奨モデル",
    aspectRatio: "デフォルト比率",
    count: "デフォルト枚数",
    useTemplate: "このテンプレートを使う",
    viewDemo: "デモを見る",
    enlarge: "拡大",
    close: "閉じる",
  },
} as const;

type DrawingTemplatePayload = {
  source: "template";
  slug: string;
  prompt?: string;
  type?: "image" | "video";
  aspectRatio?: string;
  count?: number;
  modelId?: string;
  selectedImageUrl?: string;
};

const DRAWING_TEMPLATE_STORAGE_KEY = "drawing-template-payload";

export default function TemplateDetailPage({
  locale,
  slug,
}: {
  locale: string;
  slug: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text =
    copyByLocale[locale as keyof typeof copyByLocale] || copyByLocale.en;
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch(`/api/templates/${encodeURIComponent(slug)}`, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Template not found");
        }

        const result = (await response.json()) as TemplateDetail;
        if (!cancelled) {
          setTemplate(result);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setTemplate(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="app-soft-bg min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">
          <div className="app-glass-panel rounded-[28px] px-6 py-10 text-sm text-[#68809f] dark:text-[#aebbd6]">
            {text.loading}
          </div>
        </div>
      </main>
    );
  }

  if (!template) {
    return (
      <main className="app-soft-bg min-h-screen px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto max-w-5xl">
          <div className="app-glass-panel rounded-[28px] px-6 py-10 text-sm text-[#68809f] dark:text-[#aebbd6]">
            {text.notFound}
          </div>
        </div>
      </main>
    );
  }

  const backCategory = searchParams.get("category") || template.category;
  const backHref = `/${locale}/templates?category=${backCategory}`;
  const coverUrl =
    normalizeTemplateMediaUrl(template.cover) ||
    normalizeTemplateMediaUrl(template.videoConfig?.demoPoster) ||
    "/images/logo-small.svg";
  const demoVideoUrl = normalizeTemplateMediaUrl(template.videoConfig?.demoVideo) || "";
  const previewVideoUrl =
    demoVideoUrl ||
    (isVideoUrl(coverUrl) ? coverUrl : "");
  const previewPosterUrl =
    previewVideoUrl && !isVideoUrl(coverUrl) && coverUrl !== "/images/logo-small.svg"
      ? coverUrl
      : undefined;

  const handleUseTemplate = () => {
    const resolvedModelId =
      template.category === "image"
        ? `kie:${template.imageConfig?.suggestedModel || "Banana2Image"}`
        : "";

    const referenceOrCoverUrl =
      normalizeTemplateMediaUrl(template.imageConfig?.referenceImages?.[0]) ||
      normalizeTemplateMediaUrl(template.cover) ||
      normalizeTemplateMediaUrl(template.videoConfig?.demoPoster) ||
      "";

    const payload: DrawingTemplatePayload = {
      source: "template",
      slug: template.slug,
      prompt: template.prompt || "",
      type: template.category,
      aspectRatio: template.imageConfig?.defaultAspectRatio || "",
      count: template.imageConfig?.defaultCount || 1,
      modelId: resolvedModelId,
      selectedImageUrl:
        template.category === "image" ? referenceOrCoverUrl : "",
    };

    try {
      window.sessionStorage.setItem(
        DRAWING_TEMPLATE_STORAGE_KEY,
        JSON.stringify(payload)
      );
    } catch (error) {
      console.error("Failed to store template payload:", error);
    }

    const params = new URLSearchParams({
      templatePrompt: template.prompt || "",
      templateType: template.category,
    });

    if (template.imageConfig?.defaultAspectRatio) {
      params.set("templateAspectRatio", template.imageConfig.defaultAspectRatio);
    }

    if (template.imageConfig?.defaultCount) {
      params.set("templateCount", String(template.imageConfig.defaultCount));
    }

    if (resolvedModelId) {
      params.set("modelId", resolvedModelId);
    }
    if (payload.selectedImageUrl) {
      params.set("selectedImageUrl", payload.selectedImageUrl);
    }

    router.push(`/${locale}/drawing?${params.toString()}`);
  };

  return (
    <main className="app-soft-bg min-h-screen px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <Link
          href={backHref}
          className="inline-flex items-center rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-[#243555] shadow-sm dark:bg-white/[0.05] dark:text-[#eef4ff]"
        >
          {text.back}
        </Link>

        <div className="overflow-hidden rounded-[28px] border border-[rgba(194,206,255,0.72)] bg-white/72 shadow-[0_18px_40px_rgba(145,160,218,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_18px_40px_rgba(0,0,0,0.2)]">
          <div className="relative aspect-[4/5] overflow-hidden bg-[linear-gradient(135deg,rgba(111,222,210,0.14),rgba(142,144,255,0.18))] md:aspect-[16/8]">
            {template.category === "video" && previewVideoUrl ? (
              <video
                src={previewVideoUrl}
                poster={previewPosterUrl}
                className="h-full w-full object-contain"
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <Image
                src={coverUrl}
                alt={template.cover?.alt || template.title}
                fill
                sizes="100vw"
                className="object-contain p-5"
              />
            )}
            <button
              type="button"
              onClick={() => setIsViewerOpen(true)}
              className="absolute right-4 top-4 rounded-full bg-[#07111f]/70 px-4 py-2 text-xs font-medium text-white shadow-lg backdrop-blur transition hover:bg-[#07111f]/85"
            >
              {text.enlarge}
            </button>
          </div>

          <div className="space-y-5 p-6 md:p-8">
            <div>
              <h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#243555] dark:text-[#f1f5ff] md:text-4xl">
                {template.title}
              </h1>
              {template.summary && (
                <p className="mt-3 text-sm leading-7 text-[#68809f] dark:text-[#aebbd6] md:text-base">
                  {template.summary}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {template.tags?.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[rgba(125,144,255,0.12)] px-2.5 py-1 text-[11px] font-medium text-[#5a6fcd] dark:bg-[rgba(125,144,255,0.16)] dark:text-[#c6d1ff]"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <section>
                <h2 className="text-sm font-semibold text-[#243555] dark:text-[#eef4ff]">
                  {text.prompt}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#68809f] dark:text-[#aebbd6]">
                  {template.prompt || "-"}
                </p>
              </section>

              <section>
                <h2 className="text-sm font-semibold text-[#243555] dark:text-[#eef4ff]">
                  {text.negativePrompt}
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#68809f] dark:text-[#aebbd6]">
                  {template.negativePrompt || "-"}
                </p>
              </section>
            </div>

            {template.category === "image" ? (
              <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#68809f] dark:text-[#aebbd6]">
                <div>
                  <div className="opacity-60">{text.references}</div>
                  <div className="mt-1 font-medium text-[#243555] dark:text-[#eef4ff]">
                    {template.imageConfig?.referenceImages?.length || 0}
                  </div>
                </div>
                <div>
                  <div className="opacity-60">{text.aspectRatio}</div>
                  <div className="mt-1 font-medium text-[#243555] dark:text-[#eef4ff]">
                    {template.imageConfig?.defaultAspectRatio || "-"}
                  </div>
                </div>
                <div>
                  <div className="opacity-60">{text.count}</div>
                  <div className="mt-1 font-medium text-[#243555] dark:text-[#eef4ff]">
                    {template.imageConfig?.defaultCount ?? 1}
                  </div>
                </div>
                <div>
                  <div className="opacity-60">{text.model}</div>
                  <div className="mt-1 font-medium text-[#243555] dark:text-[#eef4ff]">
                    {template.imageConfig?.suggestedModel || "-"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-[#68809f] dark:text-[#aebbd6]">
                <div className="opacity-60">{text.viewDemo}</div>
                <div className="mt-1 font-medium text-[#243555] dark:text-[#eef4ff]">
                  {demoVideoUrl || "-"}
                </div>
              </div>
            )}

            <div>
              {template.category === "image" ? (
                <button
                  type="button"
                  onClick={handleUseTemplate}
                  className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#7d90ff,#63cfff)] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-105"
                >
                  {text.useTemplate}
                </button>
              ) : demoVideoUrl ? (
                <a
                  href={demoVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#7d90ff,#63cfff)] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-105"
                >
                  {text.viewDemo}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <TemplateMediaViewer
        open={isViewerOpen}
        src={previewVideoUrl || coverUrl}
        poster={previewPosterUrl}
        kind={template.category === "video" && previewVideoUrl ? "video" : "image"}
        alt={template.title}
        closeLabel={text.close}
        onClose={() => setIsViewerOpen(false)}
      />
    </main>
  );
}
