import React, { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Info, Search, Sparkles } from "lucide-react";
import { useDebounce } from "use-debounce";
import { useLocale, useTranslations } from "next-intl";
import { LoraCategory, LoraModel, Media } from "@/payload-types";

type MediaTab = "image" | "video" | "text" | "audio";
type ModelTab = "all" | "anime" | "realistic" | "edit";

interface LoraModelSelectionProps {
  onSelectModel: (model: LoraModel) => void;
  toggleSelectedModel: (model: LoraModel) => void;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  isImageToImageMode?: boolean;
}

interface CategoryShape {
  id?: string | null;
  name?: string | { [key: string]: string } | null;
}

type CapabilityMediaKind = "chat" | "text" | "image" | "video" | "audio" | string;

type CapabilityModel = {
  id: string;
  label?: string;
  title?: string;
  description?: string;
  modelId?: string;
  providerModel?: string;
  kind?: CapabilityMediaKind;
  cover?: string | Media | null;
  categories?: string[];
  tags?: string[];
  workflow?: string;
  source?: string;
  inputs?: {
    images?: boolean;
    audio?: boolean;
    video?: boolean;
    text?: boolean;
  };
  limits?: {
    maxReferenceImages?: number | null;
  };
  submit?: {
    modelId?: string;
    providerModel?: string;
    endpoint?: string;
    type?: string;
  };
  ui?: {
    modelHint?: string;
  };
};

type CapabilityResponse = {
  media?: Array<{
    kind: CapabilityMediaKind;
    label?: string;
    models?: CapabilityModel[];
  }>;
};

const LoraModelSelection: React.FC<LoraModelSelectionProps> = ({
  onSelectModel,
  toggleSelectedModel,
  isImageToImageMode = false,
}) => {
  const t = useTranslations("models");
  const locale = useLocale();
  const modelGalleryTitle =
    locale === "zh-TW" ? "模型倉庫" : locale === "ja" ? "モデルギャラリー" : t("model_gallery_title");
  const [models, setModels] = useState<LoraModel[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm] = useDebounce(searchTerm, 250);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMediaTab, setActiveMediaTab] = useState<MediaTab>("image");
  const [activeTab, setActiveTab] = useState<ModelTab>(
    isImageToImageMode ? "edit" : "all"
  );

  useEffect(() => {
    setActiveTab(isImageToImageMode ? "edit" : "all");
  }, [isImageToImageMode]);

  const normalizeCapabilityModel = useCallback((model: CapabilityModel): LoraModel => {
    const categoryNames = Array.from(
      new Set([...(model.categories || []), ...(model.tags || [])].filter(Boolean))
    );
    const maxReferenceImages = Number(model.limits?.maxReferenceImages) || (model.inputs?.images ? 1 : 0);
    const title = model.label || model.title || model.id;

    return {
      ...(model as unknown as Record<string, unknown>),
      id: model.id,
      title,
      label: title,
      modelId: model.modelId || model.submit?.modelId || model.id,
      kind: model.kind || "image",
      description: model.description || model.ui?.modelHint || model.workflow || "",
      cover: model.cover as unknown as string,
      loraCategories: JSON.stringify(categoryNames.map((name) => ({ id: name, name }))),
      maxReferenceImages,
    } as unknown as LoraModel;
  }, []);

  const getModelCapabilities = useCallback(
    (model?: { maxReferenceImages?: number | null; inputs?: { images?: boolean }; limits?: { maxReferenceImages?: number | null } }) => {
      const maxReferenceImages =
        Number(model?.maxReferenceImages) ||
        Number(model?.limits?.maxReferenceImages) ||
        (model?.inputs?.images ? 1 : 0);
      return {
        canImageToImage: maxReferenceImages > 0,
        maxReferenceImages,
      };
    },
    []
  );

  const parseModelCategories = useCallback((input: string | LoraCategory[] | null | undefined) => {
    const recursiveParse = (value: string | LoraCategory[] | null | undefined): LoraCategory[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value;

      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
        if (typeof parsed === "string") return recursiveParse(parsed);
      } catch {
        return [];
      }

      return [];
    };

    return recursiveParse(input);
  }, []);

  const getModelType = useCallback(
    (model: LoraModel): ModelTab => {
      if (
        getModelCapabilities(
          model as LoraModel & { maxReferenceImages?: number | null }
        ).canImageToImage
      ) {
        return "edit";
      }

      const has2DCategory = parseModelCategories(model.loraCategories as string).some(
        (category: CategoryShape) => {
          const categoryId = String(category?.id || "").trim().toLowerCase();
          const categoryName =
            typeof category?.name === "string"
              ? category.name
              : (category?.name?.[locale] as string) ||
                Object.values(category?.name || {})[0] ||
                "";

          return categoryId === "2d" || String(categoryName).trim().toLowerCase() === "2d";
        }
      );

      return has2DCategory ? "anime" : "realistic";
    },
    [getModelCapabilities, locale, parseModelCategories]
  );

  const getCoverUrl = useCallback((model: LoraModel) => {
    const cover = model.cover as string | Media | null | undefined;
    if (!cover) return "";
    if (typeof cover !== "string") return cover.url || "";
    if (/^https?:\/\//i.test(cover) || cover.startsWith("/")) return cover;

    try {
      const parsed = JSON.parse(cover) as Media;
      return parsed?.url || "";
    } catch {
      return "";
    }
  }, []);

  const getSummary = useCallback(
    (model: LoraModel, type: ModelTab) => {
      if (model.description?.trim()) return model.description.trim();

      if (type === "anime") return "適合日系動漫、角色插畫與風格一致的畫面表現";
      if (type === "edit") return "支援參考圖輸入，可做圖生圖與圖片編輯延伸";
      return "適合寫實場景、人物商品與高完成度商業視覺";
    },
    []
  );

  const getModelMediaTab = useCallback((model: LoraModel): MediaTab => {
    const kind = String((model as LoraModel & { kind?: string }).kind || "image").toLowerCase();
    if (kind === "chat" || kind === "text") return "text";
    if (kind === "audio") return "audio";
    if (kind === "video") return "video";
    return "image";
  }, []);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/models/capabilities?locale=${encodeURIComponent(locale)}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) throw new Error(`Failed to fetch model capabilities (${response.status})`);

      const data = (await response.json()) as CapabilityResponse;
      const capabilityModels = (data.media || [])
        .filter((group) => ["image", "video", "text", "chat", "audio"].includes(String(group.kind)))
        .flatMap((group) =>
          (group.models || []).map((model) => ({
            ...model,
            kind: model.kind || group.kind,
          }))
        )
        .filter((model) => model.id);

      setModels(capabilityModels.map(normalizeCapabilityModel));
    } catch (fetchError) {
      console.error("[LoraModelSelection] Failed to fetch capabilities", fetchError);
      setError("Failed to fetch models");
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [locale, normalizeCapabilityModel]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const mediaTabs = useMemo(() => {
    const countByKind = (kind: MediaTab) =>
      models.filter((model) => getModelMediaTab(model) === kind).length;

    return [
      { key: "image" as const, label: locale === "zh-TW" ? "圖片" : locale === "ja" ? "画像" : "Images", count: countByKind("image") },
      { key: "video" as const, label: locale === "zh-TW" ? "影片" : locale === "ja" ? "動画" : "Videos", count: countByKind("video") },
      { key: "text" as const, label: locale === "zh-TW" ? "文字" : locale === "ja" ? "テキスト" : "Text", count: countByKind("text") },
      { key: "audio" as const, label: locale === "zh-TW" ? "聲音" : locale === "ja" ? "音声" : "Audio", count: countByKind("audio") },
    ].filter((tab) => tab.count > 0 || tab.key === activeMediaTab);
  }, [activeMediaTab, getModelMediaTab, locale, models]);

  const mediaModels = useMemo(
    () => models.filter((model) => getModelMediaTab(model) === activeMediaTab),
    [activeMediaTab, getModelMediaTab, models]
  );

  const tabs = useMemo(() => {
    const counts = {
      all: mediaModels.length,
      anime: 0,
      realistic: 0,
      edit: 0,
    };

    mediaModels.forEach((model) => {
      counts[getModelType(model)] += 1;
    });

    return [
      { key: "all" as const, label: t("all"), count: counts.all },
      { key: "anime" as const, label: t("anime"), count: counts.anime },
      { key: "realistic" as const, label: t("realistic_tab"), count: counts.realistic },
      { key: "edit" as const, label: t("edit"), count: counts.edit },
    ];
  }, [getModelType, mediaModels, t]);

  const filteredModels = useMemo(() => {
    const keyword = debouncedSearchTerm.trim().toLowerCase();

    return mediaModels
      .filter((model) =>
        activeMediaTab !== "image" || activeTab === "all" ? true : getModelType(model) === activeTab
      )
      .filter((model) => {
        if (!keyword) return true;
        const searchable = [
          model.title,
          model.description,
          (model as LoraModel & { label?: string }).label,
          (model as LoraModel & { modelId?: string }).modelId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return searchable.includes(keyword);
      })
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }));
  }, [activeMediaTab, activeTab, debouncedSearchTerm, getModelType, mediaModels]);

  return (
    <div className="mx-auto w-full max-w-6xl p-3 sm:p-4">
      <div className="mb-4 flex items-center gap-2 px-1">
        <Sparkles className="h-4 w-4 text-custom-logo-purple dark:text-custom-logo-purple-dark" />
        <div className="text-sm font-semibold text-[#6f6584] dark:text-[#9b92ad]">
          {modelGalleryTitle}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-[28px] border border-[#ddd2ef] bg-[#fbf8ff] p-4 shadow-[0_18px_50px_rgba(46,30,78,0.08)] dark:border-[#2b2436] dark:bg-[#17141d] dark:shadow-[0_18px_50px_rgba(0,0,0,0.38)]">
          <div className="mb-4 flex flex-wrap gap-2">
            {mediaTabs.map((tab) => {
              const isActive = activeMediaTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveMediaTab(tab.key);
                    setActiveTab(tab.key === "image" && isImageToImageMode ? "edit" : "all");
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? "bg-[#2f2740] text-white shadow-[0_10px_30px_rgba(47,39,64,0.18)] dark:bg-white dark:text-[#17121f]"
                      : "bg-white text-[#675b82] hover:bg-[#f1eafb] dark:bg-white/[0.05] dark:text-[#b2a9c1] dark:hover:bg-white/[0.08] dark:hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${isActive ? "bg-black/10 text-inherit" : "bg-[#f2ecfb] text-[#8d83a0] dark:bg-white/6 dark:text-[#91889f]"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8c839c]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={t("search_model_placeholder")}
                className="w-full rounded-2xl border border-[#e3d9f1] bg-white py-3 pl-12 pr-4 text-base text-[#2f2740] outline-none transition-all duration-200 placeholder:text-[#9084a8] focus:border-[#8f7fff] focus:ring-4 focus:ring-[#8f7fff]/12 dark:border-white/6 dark:bg-white/5 dark:text-white dark:placeholder:text-[#7c738d] dark:focus:border-[#6d55a8] dark:focus:bg-white/[0.07]"
              />
            </div>

            {activeMediaTab === "image" && (
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-[#2f2740] text-white shadow-[0_10px_30px_rgba(47,39,64,0.18)] dark:bg-white dark:text-[#17121f]"
                          : "bg-white text-[#675b82] hover:bg-[#f1eafb] dark:bg-white/[0.05] dark:text-[#b2a9c1] dark:hover:bg-white/[0.08] dark:hover:text-white"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          isActive
                            ? "bg-black/10 text-inherit dark:bg-black/8"
                            : "bg-[#f2ecfb] text-[#8d83a0] dark:bg-white/6 dark:text-[#91889f]"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-[#ddd2ef] bg-[#fbf8ff] dark:border-[#2b2436] dark:bg-[#17141d]">
            <div className="flex flex-col items-center gap-3 text-[#8d83a0] dark:text-[#a39aae]">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-current/20 border-t-current" />
              <div className="text-sm font-medium">{t("loading_models")}</div>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-6 text-sm text-red-500 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="rounded-[28px] border border-[#ddd2ef] bg-[#fbf8ff] px-5 py-12 text-center dark:border-[#2b2436] dark:bg-[#17141d]">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f1eafb] text-[#8f7fff] dark:bg-white/6 dark:text-[#9d90be]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="mb-2 text-lg font-semibold text-[#2f2740] dark:text-white">
              {t("no_models_found")}
            </div>
            <div className="text-sm text-[#7a6f90] dark:text-[#978ea8]">
              {t("no_models_subtitle")}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredModels.map((model) => {
              const type = getModelType(model);
              const coverUrl = getCoverUrl(model);

              return (
                <div
                  key={model.id}
                  className="group overflow-hidden rounded-[28px] border border-[#ddd2ef] bg-white shadow-[0_18px_50px_rgba(46,30,78,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(46,30,78,0.14)] dark:border-[#2b2436] dark:bg-[#17141d] dark:shadow-[0_18px_50px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_24px_70px_rgba(0,0,0,0.46)]"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f2ebfb] dark:bg-[#211b2c]">
                    {coverUrl ? (
                      <Image
                        src={coverUrl}
                        alt={model.title}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#8f84a5] dark:text-[#7d738e]">
                        <Sparkles className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute left-4 top-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          type === "anime"
                            ? "bg-white/92 text-[#6f58a8] dark:bg-[#2b2338]/92 dark:text-[#cdb8f2]"
                            : type === "edit"
                              ? "bg-white/92 text-[#37638f] dark:bg-[#22303c]/92 dark:text-[#b7d5f4]"
                              : "bg-white/92 text-[#7a5b39] dark:bg-[#2b251d]/92 dark:text-[#dfc3a3]"
                        }`}
                      >
                        {t(type)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-5">
                    <div>
                      <h3 className="mb-1 line-clamp-1 text-xl font-semibold text-[#2f2740] dark:text-white">
                        {model.title}
                      </h3>
                      <p className="line-clamp-2 text-sm leading-6 text-[#7a6f90] dark:text-[#978ea8]">
                        {getSummary(model, type)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => toggleSelectedModel(model)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f4effa] text-[#6f58a8] transition-colors duration-200 hover:bg-[#ebe3f7] dark:bg-white/[0.05] dark:text-[#b8b0c7] dark:hover:bg-white/[0.08] dark:hover:text-white"
                        aria-label={t("view_details")}
                      >
                        <Info size={17} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectModel(model)}
                        className="inline-flex items-center justify-center rounded-2xl bg-[#2f2740] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#43365f] dark:bg-white dark:text-[#18131f] dark:hover:bg-[#f2ecff]"
                      >
                        {t("select")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default LoraModelSelection;
