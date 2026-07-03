"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TemplateMediaViewer from "./TemplateMediaViewer";

const isVideoUrl = (url?: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");
const normalizeTemplateMediaUrl = (media?: { url?: string; filename?: string } | null): string => {
  const raw = String(media?.url || media?.filename || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  if (raw.startsWith("media/")) return `/${raw}`;
  return `/media/${raw}`;
};

const normalizeCategory = (value: string | null): TemplateCategory =>
  value === "video" ? "video" : "image";

type TemplateCategory = "image" | "video";

type TemplateListItem = {
  id: string;
  title: string;
  slug: string;
  category: TemplateCategory;
  summary?: string;
  prompt?: string;
  tags?: string[];
  isFeatured?: boolean;
  cover?: {
    url?: string;
    filename?: string;
    alt?: string;
  } | null;
  imageConfig?: {
    referenceImageCount?: number;
    defaultAspectRatio?: string;
    defaultCount?: number;
    suggestedModel?: string;
  } | null;
  videoConfig?: {
    demoPoster?: {
      url?: string;
      filename?: string;
    } | null;
    demoVideo?: {
      url?: string;
      filename?: string;
    } | null;
  } | null;
};

type TemplateListResponse = {
  docs?: TemplateListItem[];
  totalDocs?: number;
  totalPages?: number;
};

type DrawingTemplatePayload = {
  source: "template";
  slug: string;
  prompt?: string;
  type?: "image" | "video";
  aspectRatio?: string;
  count?: number;
  modelId?: string;
  /** 封面或參考圖，供首頁／繪圖預填 */
  selectedImageUrl?: string;
};

const DRAWING_TEMPLATE_STORAGE_KEY = "drawing-template-payload";

const copyByLocale = {
  "zh-TW": {
    title: "模板區",
    subtitle: "快速瀏覽圖片與影片模板，先選方向，再進入生成流程。",
    image: "圖片模板",
    video: "影片模板",
    featured: "精選",
    empty: "目前沒有模板",
    loading: "載入模板中...",
    retry: "重新整理",
    useTemplate: "使用此模板",
    previewOnly: "查看展示",
    enlarge: "放大",
    close: "關閉",
    references: "參考圖",
    ratio: "比例",
    count: "張數",
    model: "建議模型",
    prompt: "模板提示詞",
  },
  en: {
    title: "Templates",
    subtitle: "Browse image and video templates, then jump into the right generation flow.",
    image: "Image Templates",
    video: "Video Templates",
    featured: "Featured",
    empty: "No templates yet",
    loading: "Loading templates...",
    retry: "Refresh",
    useTemplate: "Use Template",
    previewOnly: "View Demo",
    enlarge: "Enlarge",
    close: "Close",
    references: "Refs",
    ratio: "Ratio",
    count: "Count",
    model: "Model",
    prompt: "Prompt",
  },
  ja: {
    title: "テンプレート",
    subtitle: "画像と動画のテンプレートを見て、すぐに生成フローへ進めます。",
    image: "画像テンプレート",
    video: "動画テンプレート",
    featured: "注目",
    empty: "テンプレートはまだありません",
    loading: "テンプレートを読み込み中...",
    retry: "再読み込み",
    useTemplate: "このテンプレートを使う",
    previewOnly: "デモを見る",
    enlarge: "拡大",
    close: "閉じる",
    references: "参照画像",
    ratio: "比率",
    count: "枚数",
    model: "推奨モデル",
    prompt: "テンプレートプロンプト",
  },
} as const;

export default function TemplatesPage({ locale }: { locale: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text =
    copyByLocale[locale as keyof typeof copyByLocale] || copyByLocale.en;
  const [category, setCategory] = useState<TemplateCategory>(() =>
    normalizeCategory(searchParams.get("category"))
  );
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerMedia, setViewerMedia] = useState<{
    src: string;
    poster?: string;
    kind: "image" | "video";
    alt: string;
  } | null>(null);

  useEffect(() => {
    setCategory(normalizeCategory(searchParams.get("category")));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/templates?category=${category}&page=1&limit=24&locale=${encodeURIComponent(locale)}`,
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to load templates: ${response.status}`);
        }

        const result = (await response.json()) as TemplateListResponse;

        if (!cancelled) {
          setTemplates(Array.isArray(result.docs) ? result.docs : []);
        }
      } catch (fetchError) {
        console.error(fetchError);
        if (!cancelled) {
          setTemplates([]);
          setError(text.empty);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [category, locale, text.empty]);

  const emptyMessage = useMemo(() => {
    if (loading) {
      return text.loading;
    }

    return error || text.empty;
  }, [error, loading, text.empty, text.loading]);

  const handleUseTemplate = (template: TemplateListItem) => {
    const resolvedModelId =
      template.category === "image"
        ? `kie:${template.imageConfig?.suggestedModel || "Banana2Image"}`
        : "";

    const coverOrPosterUrl =
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
        template.category === "image" ? coverOrPosterUrl : undefined,
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

  const handleCategoryChange = (nextCategory: TemplateCategory) => {
    setCategory(nextCategory);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("category", nextCategory);
    router.replace(`/${locale}/templates?${nextParams.toString()}`, { scroll: false });
  };

  return (
    <main className="app-soft-bg min-h-screen overflow-y-auto px-4 pb-6 pt-20 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-[#243555] dark:text-[#f1f5ff] md:text-4xl">
              {text.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-[#68809f] dark:text-[#aebbd6] md:text-base">
              {text.subtitle}
            </p>
          </div>

          <div className="inline-flex rounded-full border border-[rgba(194,206,255,0.72)] bg-white/70 p-1 dark:border-white/10 dark:bg-white/[0.04]">
            <button
              type="button"
              onClick={() => handleCategoryChange("image")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === "image"
                  ? "bg-[linear-gradient(135deg,#7d90ff,#63cfff)] text-white shadow-[0_8px_20px_rgba(125,144,255,0.22)]"
                  : "text-[#607394] hover:bg-white dark:text-[#aebbd6] dark:hover:bg-white/[0.06]"
              }`}
            >
              {text.image}
            </button>
            <button
              type="button"
              onClick={() => handleCategoryChange("video")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                category === "video"
                  ? "bg-[linear-gradient(135deg,#7d90ff,#63cfff)] text-white shadow-[0_8px_20px_rgba(125,144,255,0.22)]"
                  : "text-[#607394] hover:bg-white dark:text-[#aebbd6] dark:hover:bg-white/[0.06]"
              }`}
            >
              {text.video}
            </button>
          </div>
        </div>

        {templates.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[24px] border border-dashed border-[rgba(194,206,255,0.72)] bg-white/45 px-6 text-center dark:border-white/10 dark:bg-white/[0.03]">
            <p className="text-sm text-[#68809f] dark:text-[#aebbd6]">
              {emptyMessage}
            </p>
            {!loading && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 rounded-full bg-[linear-gradient(135deg,#7d90ff,#63cfff)] px-4 py-2 text-sm font-medium text-white"
              >
                {text.retry}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template, templateIndex) => {
              const coverUrl =
                normalizeTemplateMediaUrl(template.cover) ||
                normalizeTemplateMediaUrl(template.videoConfig?.demoPoster) ||
                "/images/logo-small.svg";
              const demoVideoUrl =
                normalizeTemplateMediaUrl(template.videoConfig?.demoVideo) || "";
              const previewVideoUrl =
                demoVideoUrl ||
                (isVideoUrl(coverUrl) ? coverUrl : "");
              const previewPosterUrl =
                previewVideoUrl && !isVideoUrl(coverUrl) && coverUrl !== "/images/logo-small.svg"
                  ? coverUrl
                  : undefined;
              const detailHref = `/${locale}/templates/${template.slug}?category=${template.category}`;

              return (
                <article
                  key={template.id}
                  onClick={() => {
                    if (template.category === "video") {
                      router.push(detailHref);
                    }
                  }}
                  className="overflow-hidden rounded-[24px] border border-[rgba(194,206,255,0.72)] bg-white/72 shadow-[0_18px_40px_rgba(145,160,218,0.12)] backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_18px_40px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex flex-col md:flex-row">
                    <div className="relative aspect-[4/3] w-full overflow-hidden bg-[linear-gradient(135deg,rgba(111,222,210,0.14),rgba(142,144,255,0.18))] sm:aspect-[16/10] md:aspect-auto md:min-h-[220px] md:w-[280px] md:flex-none">
                      {template.category === "video" && previewVideoUrl ? (
                        <video
                          src={previewVideoUrl}
                          poster={previewPosterUrl}
                          className="h-full w-full object-contain"
                          muted
                          controls
                          playsInline
                          preload="metadata"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <Image
                          src={coverUrl}
                          alt={template.cover?.alt || template.title}
                          fill
                          sizes="(max-width: 768px) 100vw, 280px"
                          priority={templateIndex === 0}
                          className="object-contain p-4"
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewerMedia({
                            src: previewVideoUrl || coverUrl,
                            poster: previewPosterUrl,
                            kind: template.category === "video" && previewVideoUrl ? "video" : "image",
                            alt: template.title,
                          })
                        }}
                        className="absolute right-3 top-3 rounded-full bg-[#07111f]/70 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur transition hover:bg-[#07111f]/85"
                      >
                        {text.enlarge}
                      </button>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col p-5 md:p-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[rgba(125,144,255,0.12)] px-2.5 py-1 text-[11px] font-medium text-[#5a6fcd] dark:bg-[rgba(125,144,255,0.16)] dark:text-[#c6d1ff]">
                          {template.category === "image" ? text.image : text.video}
                        </span>
                        {template.isFeatured && (
                          <span className="rounded-full bg-[#ffffffd4] px-2.5 py-1 text-[11px] font-medium text-[#4d5fd1] dark:bg-white/[0.08] dark:text-[#d9e2ff]">
                            {text.featured}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-3 text-lg font-semibold tracking-normal text-[#243555] dark:text-[#f1f5ff]">
                        {template.title}
                      </h2>
                      {template.summary && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#68809f] dark:text-[#aebbd6]">
                          {template.summary}
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-2">
                        {template.tags?.slice(0, 4).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-[rgba(125,144,255,0.12)] px-2.5 py-1 text-[11px] font-medium text-[#5a6fcd] dark:bg-[rgba(125,144,255,0.16)] dark:text-[#c6d1ff]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#607394] dark:text-[#aebbd6]">
                        {template.category === "image" ? (
                          <>
                            <span>
                              <span className="opacity-60">{text.references}:</span>{" "}
                              <span className="font-medium text-[#243555] dark:text-[#eef4ff]">
                                {template.imageConfig?.referenceImageCount ?? 0}
                              </span>
                            </span>
                            <span>
                              <span className="opacity-60">{text.ratio}:</span>{" "}
                              <span className="font-medium text-[#243555] dark:text-[#eef4ff]">
                                {template.imageConfig?.defaultAspectRatio || "-"}
                              </span>
                            </span>
                            <span>
                              <span className="opacity-60">{text.count}:</span>{" "}
                              <span className="font-medium text-[#243555] dark:text-[#eef4ff]">
                                {template.imageConfig?.defaultCount ?? 1}
                              </span>
                            </span>
                          </>
                        ) : (
                          <span className="line-clamp-1">
                            <span className="opacity-60">{text.prompt}:</span>{" "}
                            <span className="font-medium text-[#243555] dark:text-[#eef4ff]">
                              {template.prompt || "-"}
                            </span>
                          </span>
                        )}
                      </div>

                      {category === "image" && template.imageConfig?.suggestedModel && (
                        <div className="mt-2 text-sm text-[#607394] dark:text-[#aebbd6]">
                          <span className="opacity-60">{text.model}:</span>{" "}
                          <span className="font-medium text-[#243555] dark:text-[#eef4ff]">
                            {template.imageConfig.suggestedModel}
                          </span>
                        </div>
                      )}

                      <div className="mt-auto flex flex-wrap gap-3 pt-5">
                        {template.category === "image" ? (
                          <button
                            type="button"
                            onClick={() => handleUseTemplate(template)}
                            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#7d90ff,#63cfff)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105"
                          >
                            {text.useTemplate}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(detailHref);
                            }}
                            className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#7d90ff,#63cfff)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-105"
                          >
                            {text.previewOnly}
                          </button>
                        )}
                        {template.category === "image" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(detailHref);
                            }}
                            className="inline-flex items-center justify-center rounded-full border border-[rgba(194,206,255,0.72)] bg-white/70 px-4 py-2 text-sm font-medium text-[#4c5f81] transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-[#dbe6ff] dark:hover:bg-white/[0.08]"
                          >
                            {text.previewOnly}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      <TemplateMediaViewer
        open={!!viewerMedia}
        src={viewerMedia?.src || ""}
        poster={viewerMedia?.poster}
        kind={viewerMedia?.kind || "image"}
        alt={viewerMedia?.alt || text.previewOnly}
        closeLabel={text.close}
        onClose={() => setViewerMedia(null)}
      />
    </main>
  );
}
