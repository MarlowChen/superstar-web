"use client";

import { FormEvent, useLayoutEffect, useMemo, useState } from "react";
import Image from "next/image";
import { ArrowUp, Check, ImagePlus, Mic, Music2, Sparkles, Video, X } from "lucide-react";

const DRAWING_TEMPLATE_STORAGE_KEY = "drawing-template-payload";

type HomeInitialTemplate = {
  prompt?: string;
  type?: "image" | "video" | "audio";
  aspectRatio?: string;
  count?: number;
  modelId?: string;
  selectedImageUrl?: string;
};

type HomeWorkspaceProps = {
  locale: string;
  initialTemplate?: HomeInitialTemplate;
};

type GenerateType = "image" | "video" | "audio";
type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";
type Duration = "4" | "5" | "8";

type LocaleCopy = {
  greeting: string;
  subtitle: string;
  suggestedModelHint: string;
  placeholder: Record<GenerateType, string>;
  typeLabel: string;
  types: Record<GenerateType, string>;
  reference: string;
  count: string;
  aspectRatio: string;
  size: string;
  duration: string;
  fixedLens: string;
  generateAudio: string;
  allowNsfw: string;
  send: string;
  starters: Record<GenerateType, string[]>;
};

const copyByLocale: Record<string, LocaleCopy> = {
  "zh-TW": {
    greeting: "今天想生成什麼內容？",
    subtitle: "先選擇生成類型，再輸入需求。模型由系統自動判斷。",
    suggestedModelHint: "此模板建議模型",
    placeholder: {
      image: "描述你想生成的角色、場景、服裝、鏡頭或整體風格",
      video: "描述你想生成的影片內容、鏡頭運動、節奏或場景氛圍",
      audio: "描述你想生成的音效、情緒、節奏或使用情境",
    },
    typeLabel: "生成類型",
    types: {
      image: "圖片",
      video: "影片",
      audio: "聲音",
    },
    reference: "參考圖",
    count: "張數",
    aspectRatio: "比例",
    size: "尺寸",
    duration: "時長",
    fixedLens: "固定鏡頭",
    generateAudio: "含音訊",
    allowNsfw: "NSFW",
    send: "送出",
    starters: {
      image: [
        "生成一張電影感角色海報",
        "做一張日系插畫風的角色立繪",
        "生成雜誌感商品主視覺",
        "幫我整理成高品質繪圖 prompt",
      ],
      video: [
        "生成一段電影感城市夜景運鏡",
        "做一段角色緩慢轉身的短影片",
        "生成產品展示的廣告鏡頭",
        "幫我整理成可用的影片生成 prompt",
      ],
      audio: [
        "生成神秘感環境音效",
        "做一段賽博龐克科技提示音",
        "生成低沉震撼的轉場音效",
        "幫我整理成可用的音效 prompt",
      ],
    },
  },
  ja: {
    greeting: "今日は何を生成しますか？",
    subtitle: "まず生成タイプを選び、内容を入力してください。モデルはシステムが自動判断します。",
    suggestedModelHint: "このテンプレートの推奨モデル",
    placeholder: {
      image: "生成したいキャラクター、シーン、衣装、カメラ、全体のスタイルを書いてください",
      video: "生成したい動画の内容、カメラワーク、テンポ、シーンの雰囲気を書いてください",
      audio: "生成したい効果音、感情、テンポ、使用シーンを書いてください",
    },
    typeLabel: "生成タイプ",
    types: {
      image: "画像",
      video: "動画",
      audio: "音声",
    },
    reference: "参照画像",
    count: "枚数",
    aspectRatio: "比率",
    size: "サイズ",
    duration: "長さ",
    fixedLens: "固定カメラ",
    generateAudio: "音声付き",
    allowNsfw: "NSFW",
    send: "送信",
    starters: {
      image: [
        "映画のようなキャラクターポスターを生成したい",
        "アニメ風の立ち絵を作りたい",
        "雑誌広告のような商品ビジュアルを生成したい",
        "高品質な画像生成 prompt に整理してほしい",
      ],
      video: [
        "映画のような夜景のカメラムーブを生成したい",
        "キャラクターがゆっくり振り向く短い動画を作りたい",
        "商品紹介の広告カットを作りたい",
        "動画生成用の prompt に整理してほしい",
      ],
      audio: [
        "神秘的な環境音を生成したい",
        "サイバーパンク風のUI効果音を作りたい",
        "重低音のあるトランジションSEを生成したい",
        "音声生成用の prompt に整理してほしい",
      ],
    },
  },
  en: {
    greeting: "What do you want to generate today?",
    subtitle: "Choose the type first, then describe what you need. The system decides the model automatically.",
    suggestedModelHint: "Suggested model for this template",
    placeholder: {
      image: "Describe the character, scene, outfit, camera angle, or overall style you want to generate",
      video: "Describe the video, motion, camera movement, pacing, or scene mood you want to generate",
      audio: "Describe the sound effect, mood, rhythm, or use case you want to generate",
    },
    typeLabel: "Type",
    types: {
      image: "Image",
      video: "Video",
      audio: "Audio",
    },
    reference: "Reference",
    count: "Count",
    aspectRatio: "Ratio",
    size: "Size",
    duration: "Duration",
    fixedLens: "Fixed Lens",
    generateAudio: "With Audio",
    allowNsfw: "NSFW",
    send: "Send",
    starters: {
      image: [
        "Generate a cinematic character poster",
        "Create an anime-style character illustration",
        "Generate a magazine-style product visual",
        "Turn my idea into a strong image prompt",
      ],
      video: [
        "Generate a cinematic night city shot",
        "Create a short turn-around character video",
        "Generate a product ad motion shot",
        "Turn my idea into a usable video prompt",
      ],
      audio: [
        "Generate a mysterious ambient sound effect",
        "Create a cyberpunk UI sound",
        "Generate a deep cinematic transition hit",
        "Turn my idea into a usable audio prompt",
      ],
    },
  },
};

const typeIcons = {
  image: Sparkles,
  video: Video,
  audio: Music2,
};

const aspectRatioOptions: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];

function coerceAspectRatio(value: string | undefined): AspectRatio {
  if (!value) {
    return "1:1";
  }
  const trimmed = value.trim() as AspectRatio;
  if (aspectRatioOptions.includes(trimmed)) {
    return trimmed;
  }
  if (value === "2:3" || value === "4:5" || value === "9:21") {
    return "3:4";
  }
  if (value === "3:2" || value === "5:4" || value === "21:9") {
    return "4:3";
  }
  return "1:1";
}

function coerceCount(value: number | undefined): (typeof countOptions)[number] {
  const n = typeof value === "number" && !Number.isNaN(value) ? Math.floor(value) : 4;
  return Math.min(4, Math.max(1, n)) as (typeof countOptions)[number];
}

function formatModelIdLabel(modelId: string): string {
  return modelId.replace(/^kie:/i, "").trim() || modelId;
}
const imageSizes = [
  { label: "1024×1024", width: 1024, height: 1024 },
  { label: "832×1216", width: 832, height: 1216 },
  { label: "1216×832", width: 1216, height: 832 },
];
const countOptions = [1, 2, 3, 4] as const;
const durationOptions: Duration[] = ["4", "5", "8"];

function ToggleChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
        active
          ? "border-[#cbbbe9] bg-[#efe8f8] text-[#3f305f] dark:border-[#4b3c64] dark:bg-[#261f32] dark:text-white"
          : "border-[#ddd2ef] bg-[#f8f5fc] text-[#4a3b67] hover:bg-[#efe8f8] dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-white dark:hover:bg-[#221c2d]"
      }`}
    >
      {active && <Check className="h-4 w-4" />}
      <span>{label}</span>
    </button>
  );
}

export default function HomeWorkspace({
  locale,
  initialTemplate,
}: HomeWorkspaceProps) {
  const copy = copyByLocale[locale] ?? copyByLocale.en;
  const resolvedInitialType: GenerateType =
    initialTemplate?.type === "video"
      ? "video"
      : initialTemplate?.type === "audio"
        ? "audio"
        : "image";

  const [prompt, setPrompt] = useState(initialTemplate?.prompt ?? "");
  const [type, setType] = useState<GenerateType>(resolvedInitialType);
  const [count, setCount] = useState<(typeof countOptions)[number]>(
    resolvedInitialType === "image"
      ? coerceCount(initialTemplate?.count)
      : 4
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
    coerceAspectRatio(initialTemplate?.aspectRatio)
  );
  const [referenceImageUrl, setReferenceImageUrl] = useState(
    initialTemplate?.selectedImageUrl?.trim() || ""
  );
  const [templateModelId, setTemplateModelId] = useState(
    initialTemplate?.modelId?.trim() || ""
  );
  const [size, setSize] = useState(imageSizes[0]);
  const [duration, setDuration] = useState<Duration>("4");
  const [allowNsfw, setAllowNsfw] = useState(false);
  const [fixedLens, setFixedLens] = useState(false);
  const [generateAudio, setGenerateAudio] = useState(false);
  const shouldDebugTemplateFlow = Boolean(
    initialTemplate?.prompt ||
      initialTemplate?.type ||
      initialTemplate?.aspectRatio ||
      initialTemplate?.count ||
      initialTemplate?.modelId ||
      initialTemplate?.selectedImageUrl
  );

  const debugTemplateFlow = (...args: unknown[]) => {
    if (!shouldDebugTemplateFlow) return;
    console.log("[HomeWorkspace][template-flow]", ...args);
  };

  const canSubmit = useMemo(() => prompt.trim().length > 0, [prompt]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.sessionStorage.getItem(DRAWING_TEMPLATE_STORAGE_KEY);
      debugTemplateFlow("mount", {
        pathname: window.location.pathname,
        search: window.location.search,
        initialTemplate,
        hasSessionPayload: Boolean(raw),
      });

      if (raw) {
        const payload = JSON.parse(raw) as {
          prompt?: string;
          type?: string;
          aspectRatio?: string;
          count?: number;
          selectedImageUrl?: string;
          modelId?: string;
        };
        debugTemplateFlow("restored-session-payload", payload);
        // 不在此清除：繪圖頁 PromptForm 仍須讀取同一筆 payload 以套用 modelId（如 Banana2Image）

        const fromStorageUrl =
          typeof payload.selectedImageUrl === "string"
            ? payload.selectedImageUrl.trim()
            : "";
        if (fromStorageUrl && !(initialTemplate?.selectedImageUrl ?? "").trim()) {
          setReferenceImageUrl(fromStorageUrl);
        }

        const fromModelId =
          typeof payload.modelId === "string" ? payload.modelId.trim() : "";
        if (fromModelId && !(initialTemplate?.modelId ?? "").trim()) {
          setTemplateModelId(fromModelId);
        }

        if (payload.prompt && !(initialTemplate?.prompt ?? "").trim()) {
          setPrompt(payload.prompt);
        }
        if (payload.type === "video" || payload.type === "audio" || payload.type === "image") {
          if (!initialTemplate?.type) {
            setType(payload.type);
          }
        }
        if (payload.aspectRatio && !initialTemplate?.aspectRatio) {
          setAspectRatio(coerceAspectRatio(payload.aspectRatio));
        }
        if (
          typeof payload.count === "number" &&
          !Number.isNaN(payload.count) &&
          initialTemplate?.count == null
        ) {
          setCount(coerceCount(payload.count));
        }
      }
    } catch {
      /* ignore */
    }

    const q = new URLSearchParams(window.location.search);
    const hasTemplateQuery =
      q.get("templatePrompt") ||
      q.get("templateType") ||
      q.get("templateAspectRatio") ||
      q.get("templateCount") ||
      q.get("modelId") ||
      q.get("selectedImageUrl");
    if (hasTemplateQuery) {
      debugTemplateFlow("clearing-template-query-from-home", {
        pathname: window.location.pathname,
        search: window.location.search,
      });
      window.history.replaceState({}, "", `/${locale}`);
    }
  }, [
    locale,
    initialTemplate?.prompt,
    initialTemplate?.modelId,
    initialTemplate?.selectedImageUrl,
    initialTemplate?.aspectRatio,
    initialTemplate?.count,
    initialTemplate?.type,
  ]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!canSubmit) {
      return;
    }

    const refImages =
      referenceImageUrl.trim().length > 0 ? [referenceImageUrl.trim()] : [];
    const modelIdForRequest = templateModelId.trim();

    const requestBody =
      type === "image"
        ? {
            type,
            prompt: prompt.trim(),
            images: refImages,
            count,
            aspectRatio,
            width: size.width,
            height: size.height,
            allowNsfw,
            ...(modelIdForRequest ? { modelId: modelIdForRequest } : {}),
          }
        : type === "video"
          ? {
              type,
              prompt: prompt.trim(),
              images: refImages,
              aspectRatio,
              duration,
              fixedLens,
              generateAudio,
              allowNsfw,
              ...(modelIdForRequest ? { modelId: modelIdForRequest } : {}),
            }
          : {
              type,
              prompt: prompt.trim(),
              allowNsfw,
            };

    window.dispatchEvent(
      new CustomEvent("openLoginDialog", {
        detail: { requestBody },
      }),
    );
  };

  return (
    <main className="min-h-screen overflow-y-auto bg-[#f6f1fb] px-4 pt-4 dark:bg-[#120f16]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-7xl flex-col">
        <div className="flex h-full w-full flex-1 flex-col items-center justify-center px-4 pb-[16vh]">
          <div className="mb-6 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-normal text-[#2f2740] dark:text-white md:text-4xl">
              {copy.greeting}
            </h2>
            <p className="mt-2 text-sm leading-7 text-[#7a6f90] dark:text-[#978ea8] md:text-base">
              {copy.subtitle}
            </p>
            {templateModelId ? (
              <p className="mt-2 text-xs font-medium text-[#6d5bd0] dark:text-[#b8a8e8] md:text-sm">
                {copy.suggestedModelHint}：{formatModelIdLabel(templateModelId)}
              </p>
            ) : null}
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full max-w-4xl rounded-[32px] border border-[#ddd2ef] bg-white px-4 pb-4 pt-3 text-custom-black shadow-[0_12px_36px_rgba(46,30,78,0.08)] dark:border-[#2b2436] dark:bg-[#18141f] dark:text-white dark:shadow-[0_18px_36px_rgba(0,0,0,0.34)]"
          >
            <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
              <span className="mr-1 text-xs font-medium uppercase tracking-[0.12em] text-[#8a7ca5] dark:text-[#8f86a3]">
                {copy.typeLabel}
              </span>
              {(["image", "video", "audio"] as GenerateType[]).map((item) => {
                const Icon = typeIcons[item];
                const active = type === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setType(item)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${
                      active
                        ? "border-[#c9bbe8] bg-[#efe8f8] text-[#352656] dark:border-[#4b3c64] dark:bg-[#261f32] dark:text-white"
                        : "border-[#ddd2ef] bg-[#faf8fd] text-[#5e4f7f] hover:bg-[#f2ebf9] dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-[#c7bddb] dark:hover:bg-[#221c2d]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{copy.types[item]}</span>
                  </button>
                );
              })}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy.placeholder[type]}
              className="min-h-[118px] w-full resize-none border-0 bg-transparent px-2 py-3 text-[16px] leading-7 text-[#241a38] outline-none placeholder:text-[#9386aa] dark:text-white dark:placeholder:text-[#7f7590]"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {type !== "audio" && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd2ef] bg-[#f8f5fc] text-[#6f6486] transition hover:bg-[#efe8f8] dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-[#b8b0c7] dark:hover:bg-[#221c2d]"
                      aria-label={copy.reference}
                    >
                      <ImagePlus className="h-4 w-4" />
                    </button>
                    {referenceImageUrl ? (
                      <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[#ddd2ef] dark:border-[#2a2436]">
                        <Image
                          src={referenceImageUrl}
                          alt={copy.reference}
                          fill
                          className="object-cover"
                          sizes="40px"
                          unoptimized={
                            referenceImageUrl.startsWith("http://") ||
                            referenceImageUrl.startsWith("https://")
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setReferenceImageUrl("")}
                          className="absolute right-0 top-0 rounded-bl-md bg-black/55 p-0.5 text-white"
                          aria-label="Remove reference"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {type === "image" && (
                  <select
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value) as (typeof countOptions)[number])}
                    className="rounded-full border border-[#ddd2ef] bg-[#f8f5fc] px-4 py-2 text-sm text-[#4a3b67] outline-none dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-white"
                  >
                    {countOptions.map((item) => (
                      <option key={item} value={item}>
                        {copy.count}: {item}
                      </option>
                    ))}
                  </select>
                )}

                {type !== "audio" && (
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                    className="rounded-full border border-[#ddd2ef] bg-[#f8f5fc] px-4 py-2 text-sm text-[#4a3b67] outline-none dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-white"
                  >
                    {aspectRatioOptions.map((item) => (
                      <option key={item} value={item}>
                        {copy.aspectRatio}: {item}
                      </option>
                    ))}
                  </select>
                )}

                {type === "image" && (
                  <select
                    value={size.label}
                    onChange={(e) => {
                      const nextSize = imageSizes.find((item) => item.label === e.target.value);
                      if (nextSize) {
                        setSize(nextSize);
                      }
                    }}
                    className="rounded-full border border-[#ddd2ef] bg-[#f8f5fc] px-4 py-2 text-sm text-[#4a3b67] outline-none dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-white"
                  >
                    {imageSizes.map((item) => (
                      <option key={item.label} value={item.label}>
                        {copy.size}: {item.label}
                      </option>
                    ))}
                  </select>
                )}

                {type === "video" && (
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value as Duration)}
                    className="rounded-full border border-[#ddd2ef] bg-[#f8f5fc] px-4 py-2 text-sm text-[#4a3b67] outline-none dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-white"
                  >
                    {durationOptions.map((item) => (
                      <option key={item} value={item}>
                        {copy.duration}: {item}s
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {type === "video" && (
                  <ToggleChip
                    active={fixedLens}
                    label={copy.fixedLens}
                    onClick={() => setFixedLens((prev) => !prev)}
                  />
                )}
                {type === "video" && (
                  <ToggleChip
                    active={generateAudio}
                    label={copy.generateAudio}
                    onClick={() => setGenerateAudio((prev) => !prev)}
                  />
                )}
                <ToggleChip
                  active={allowNsfw}
                  label={copy.allowNsfw}
                  onClick={() => setAllowNsfw((prev) => !prev)}
                />
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ddd2ef] bg-[#f8f5fc] text-[#6f6486] transition hover:bg-[#efe8f8] dark:border-[#2a2436] dark:bg-[#1c1725] dark:text-[#b8b0c7] dark:hover:bg-[#221c2d]"
                  aria-label="Mic"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#6d5bd0] text-white transition hover:bg-[#5f4dc1] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canSubmit}
                  aria-label={copy.send}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>

          <div className="mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-3">
            {copy.starters[type].map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => setPrompt(starter)}
                className="rounded-full border border-[#ddd2ef] bg-white px-4 py-2 text-sm text-[#5e4f7f] transition hover:border-[#c8b7e7] hover:bg-[#faf8fd] dark:border-[#2b2436] dark:bg-[#18141f] dark:text-[#c7bddb] dark:hover:bg-[#1e1828]"
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
