import Link from "next/link";
import { ArrowRight, Layers3, PlayCircle, Sparkles, Wand2 } from "lucide-react";

type MarketingHomeProps = {
  locale: string;
  hasSession: boolean;
};

type MarketingCopy = {
  badge: string;
  title: string;
  description: string;
  primary: string;
  secondary: string;
  metrics: Array<{ label: string; value: string }>;
  sections: Array<{ title: string; body: string; icon: "spark" | "layers" | "play" | "wand" }>;
};

const copyByLocale: Record<string, MarketingCopy> = {
  "zh-TW": {
    badge: "Aierone Creative System",
    title: "先給你一個像產品首頁的入口，再進登入與創作流程。",
    description:
      "參考 moreu-web 的節奏，首頁先展示產品氣質、能力與進入點。登入則改成完整的 Google 或帳號密碼雙流程。",
    primary: "開始創作",
    secondary: "前往登入",
    metrics: [
      { label: "Image models", value: "12+" },
      { label: "Creative flows", value: "4" },
      { label: "Editing tools", value: "8" },
    ],
    sections: [
      {
        title: "生成入口更清楚",
        body: "把模型、畫風與工作流整理成容易理解的首頁區塊，不再一進站就直接跳登入。",
        icon: "spark",
      },
      {
        title: "登入流程完整",
        body: "提供 Google 快速登入與帳號密碼登入，進站與回跳路徑保持一致。",
        icon: "layers",
      },
      {
        title: "更像真正產品首頁",
        body: "用 hero、能力卡片與 CTA 先建立產品感，再導到 drawing 與 login。",
        icon: "play",
      },
      {
        title: "後續容易再擴充",
        body: "這版是假的首頁，但結構已經能直接延伸成正式 marketing page。",
        icon: "wand",
      },
    ],
  },
  ja: {
    badge: "Aierone Creative System",
    title: "ログインへ直行する前に、まずプロダクトらしいホームを見せる。",
    description:
      "moreu-web の流れを参考に、最初はプロダクトの雰囲気と導線を見せ、ログインは Google とメールの両対応にします。",
    primary: "制作を始める",
    secondary: "ログインへ",
    metrics: [
      { label: "Image models", value: "12+" },
      { label: "Creative flows", value: "4" },
      { label: "Editing tools", value: "8" },
    ],
    sections: [
      {
        title: "入口を整理",
        body: "モデルとワークフローをホームで分かりやすく見せ、いきなりログイン画面にしません。",
        icon: "spark",
      },
      {
        title: "ログイン導線を統一",
        body: "Google とメールログインを両方提供し、遷移後に元の作業へ戻れるようにします。",
        icon: "layers",
      },
      {
        title: "プロダクト感を先に出す",
        body: "hero と機能カードでサービスの性格を見せてから制作画面へ導きます。",
        icon: "play",
      },
      {
        title: "正式版へ伸ばしやすい",
        body: "今回は仮のホームですが、このまま marketing page として拡張できます。",
        icon: "wand",
      },
    ],
  },
  en: {
    badge: "Aierone Creative System",
    title: "Show a product-style landing page first instead of dropping straight into auth.",
    description:
      "This follows the moreu-web rhythm: lead with product atmosphere and entry points, then offer a complete Google or email sign-in flow.",
    primary: "Start creating",
    secondary: "Go to login",
    metrics: [
      { label: "Image models", value: "12+" },
      { label: "Creative flows", value: "4" },
      { label: "Editing tools", value: "8" },
    ],
    sections: [
      {
        title: "A clearer entry",
        body: "Organize models, styles, and workflows into a landing page instead of sending visitors straight to login.",
        icon: "spark",
      },
      {
        title: "A complete auth flow",
        body: "Support fast Google sign-in and standard email sign-in with proper callback handling.",
        icon: "layers",
      },
      {
        title: "More like a real product",
        body: "Use a hero section, capability cards, and strong calls to action before routing people into the studio.",
        icon: "play",
      },
      {
        title: "Easy to expand later",
        body: "This is a temporary landing page, but the structure already works as a real marketing shell.",
        icon: "wand",
      },
    ],
  },
};

const iconMap = {
  spark: Sparkles,
  layers: Layers3,
  play: PlayCircle,
  wand: Wand2,
};

const MarketingHome = ({ locale, hasSession }: MarketingHomeProps) => {
  const copy = copyByLocale[locale] || copyByLocale.en;
  const primaryHref = hasSession ? `/${locale}/drawing` : `/${locale}/login`;
  const secondaryHref = hasSession ? `/${locale}/models` : `/${locale}/login`;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,190,255,0.2),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,191,125,0.2),transparent_28%)]" />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-10">
        <header className="flex items-center justify-between rounded-full border border-white/55 bg-white/60 px-5 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
          <div>
            <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 dark:text-slate-300">
              AIERONE
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/login`}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
            >
              {copy.secondary}
            </Link>
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {copy.primary}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/50 bg-sky-100/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-sky-900 dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200">
              <Sparkles className="h-3.5 w-3.5" />
              {copy.badge}
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[1.02] text-slate-950 dark:text-white sm:text-6xl lg:text-7xl">
                {copy.title}
              </h1>
              <p className="max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300 sm:text-lg">
                {copy.description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href={primaryHref}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {copy.primary}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={secondaryHref}
                className="rounded-full border border-slate-300/70 px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/25 dark:hover:text-white"
              >
                {copy.secondary}
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {copy.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-3xl border border-white/55 bg-white/70 px-5 py-5 shadow-[0_18px_50px_rgba(26,41,63,0.08)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
                >
                  <p className="text-3xl font-semibold text-slate-950 dark:text-white">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {copy.sections.map((section) => {
              const Icon = iconMap[section.icon];

              return (
                <article
                  key={section.title}
                  className="rounded-[28px] border border-white/55 bg-white/72 p-6 shadow-[0_20px_60px_rgba(20,36,60,0.1)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
                >
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
                    {section.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {section.body}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
};

export default MarketingHome;
