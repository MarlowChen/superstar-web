"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import PaymentModelDialog from "../PaymentModelDialog";
import type { User } from "@/payload-types";
import { AuthProvider } from "@/app/context/AuthContext";

/**
 * Design notes
 * ------------
 * The previous version mixed a light <main> background with hard-coded dark
 * section backgrounds (#08111b, #1c1925, #0c1520...). That is why it looked
 * broken in light mode: half the page assumed dark, half assumed light.
 *
 * This rewrite drives ALL colors from CSS variables defined once on the root,
 * with a `.dark` override. Every section reads from those tokens, so light and
 * dark are both coherent. Brand colors are preserved:
 *   brand gradient  #7d90ff -> #63cfff
 *   accent          #159cff / #53c7ff
 *
 * Removed: the fake video play button, the filler "highlight number" bento
 * grid, and duplicated per-locale showcase data that only differed by quotes.
 */

type LandingHomeProps = {
  locale: string;
  initialUser?: User | null;
  hasAuthCookie?: boolean;
};

type Lane = {
  tag: string;
  title: string;
  models: string;
  body: string;
  action: string;
  href: string;
  mediaSrc: string;
  mediaPosition?: string;
};

type Copy = {
  badge: string;
  heroTitle: string;
  heroHighlight: string;
  heroSub: string;
  signUp: string;
  launch: string;
  navModels: string;
  navPricing: string;
  navStart: string;
  modelsLabel: string;
  modelsTitle: string;
  lanes: Lane[];
  ribbon: string[];
  privacyLabel: string;
  privacyTitle: string;
  privacyBody: string;
  privacyPoints: string[];
  pricingTitle: string;
  pricingBody: string;
};

const SHOWCASE_IMAGES = [
  "https://nyc3.digitaloceanspaces.com/aierone/media/Gemini_Generated_Image_dzpjifdzpjifdzpj.png",
  "https://nyc3.digitaloceanspaces.com/aierone/media/Gemini_Generated_Image_h64h00h64h00h64h.png",
  "https://nyc3.digitaloceanspaces.com/aierone/media/Gemini_Generated_Image_9246av9246av9246.png",
  "https://nyc3.digitaloceanspaces.com/aierone/media/cVORvgBkLS0B-k0f.png",
  "https://nyc3.digitaloceanspaces.com/aierone/media/XVqm8VtuT7D8dl8-.png",
  "https://nyc3.digitaloceanspaces.com/aierone/media/Gemini_Generated_Image_pn5cqlpn5cqlpn5c.png",
  "https://nyc3.digitaloceanspaces.com/aierone/media/CWRKJ9IiAl3oBkHj.png",
];

const LANE_MEDIA = {
  image: "/images/banner/aierone-C1-6952635f1744b72df18e6cbf.jpg",
  video: "https://nyc3.digitaloceanspaces.com/aierone/media/%E4%B8%AD%E9%9A%8E%E4%B8%BB%E7%AE%A1.mp4",
  lipsync: "https://nyc3.digitaloceanspaces.com/aierone/media/u32emj8n.mp4",
} as const;

const isVideoMedia = (src: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(src);

const copyByLocale: Record<string, Copy> = {
  "zh-TW": {
    badge: "AI 圖片、影片、對嘴與內容創作平台",
    heroTitle: "從靈感到成片，更快完成",
    heroHighlight: "你的 AI 創作流程",
    heroSub:
      "超星 AI 平台整合圖片生成、影片製作、聲音與對嘴等創作工具，讓品牌素材、短影音、角色內容與社群貼文都能在同一個工作台完成。",
    signUp: "開始創作",
    launch: "探索功能",
    navModels: "功能",
    navPricing: "方案",
    navStart: "開始創作",
    modelsLabel: "Creative tools",
    modelsTitle: "從圖片、影片到對嘴，快速選擇你要完成的創作任務。",
    lanes: [
      { tag: "圖片", title: "生成圖片", models: "商品圖 · 角色圖 · 社群素材", body: "用自然語言生成圖片，也能帶參考圖進行修改、延伸、換風格，快速做出可用素材。", action: "開始生成圖片", href: "/drawing?tool=image", mediaSrc: LANE_MEDIA.image },
      { tag: "影片", title: "製作影片", models: "圖生影片 · 文生影片 · 短影音", body: "把圖片或提示詞轉成影片，適合廣告素材、社群短片、角色動態與產品展示。", action: "開始製作影片", href: "/drawing?tool=video", mediaSrc: LANE_MEDIA.video },
      { tag: "對嘴", title: "AI 對嘴與數位人", models: "Lip sync · Talking avatar · Voice", body: "先用固定入口預留對嘴、數位人、聲音生成與角色講話流程，之後可直接換成正式 URL。", action: "查看對嘴功能", href: "/drawing?tool=lipsync", mediaSrc: LANE_MEDIA.lipsync, mediaPosition: "center top" },
    ],
    ribbon: ["AI Image", "Image to Video", "Text to Video", "Lip Sync", "Voice", "Avatar", "Creative Workflow", "Superstar AI"],
    privacyLabel: "Workflow",
    privacyTitle: "不是只放模型，而是把創作流程接起來。",
    privacyBody:
      "你需要的是從圖片、影片、聲音到後續編輯都能順手銜接。超星 AI 平台會把不同生成能力整理成可理解、可重複使用的創作路徑。",
    privacyPoints: ["圖片生成", "影片製作", "AI 對嘴", "工作流整合"],
    pricingTitle: "升級你的方案",
    pricingBody: "選擇最適合你的創作節奏，從免費體驗到完整生成、儲存與商業使用權。",
  },
  ja: {
    badge: "画像・動画・リップシンク対応の AI 制作プラットフォーム",
    heroTitle: "アイデアから完成素材まで、もっと速く",
    heroHighlight: "AI 制作フローを",
    heroSub:
      "超星 AI 平台は画像生成、動画制作、音声、リップシンクをひとつのワークスペースにまとめ、SNS・広告・キャラクター素材を効率よく作れます。",
    signUp: "作成を始める",
    launch: "機能を見る",
    navModels: "機能",
    navPricing: "プラン",
    navStart: "作成を始める",
    modelsLabel: "Creative tools",
    modelsTitle: "画像・動画・リップシンクから、作りたい内容をすぐ選べます。",
    lanes: [
      { tag: "画像", title: "画像生成", models: "商品画像 · キャラクター · SNS 素材", body: "自然言語や参照画像から、生成・編集・スタイル変更まで素早く作れます。", action: "画像を作る", href: "/drawing?tool=image", mediaSrc: LANE_MEDIA.image },
      { tag: "動画", title: "動画制作", models: "画像から動画 · テキストから動画 · ショート動画", body: "画像やプロンプトから動画素材を作成。広告、SNS、商品紹介に使いやすい入口です。", action: "動画を作る", href: "/drawing?tool=video", mediaSrc: LANE_MEDIA.video },
      { tag: "リップシンク", title: "AI リップシンク", models: "Lip sync · Talking avatar · Voice", body: "リップシンク、デジタルヒューマン、音声生成の入口を固定で用意。後で正式 URL に差し替え可能です。", action: "機能を見る", href: "/drawing?tool=lipsync", mediaSrc: LANE_MEDIA.lipsync, mediaPosition: "center top" },
    ],
    ribbon: ["AI Image", "Image to Video", "Text to Video", "Lip Sync", "Voice", "Avatar", "Creative Workflow", "Superstar AI"],
    privacyLabel: "Workflow",
    privacyTitle: "モデル一覧ではなく、制作フローとしてつなげる。",
    privacyBody:
      "必要なのは、画像・動画・音声・編集が自然につながること。超星 AI 平台は複数の生成機能を理解しやすい制作ルートに整理します。",
    privacyPoints: ["画像生成", "動画制作", "AI リップシンク", "ワークフロー統合"],
    pricingTitle: "プランをアップグレード",
    pricingBody: "無料体験から完全な生成・保存・商用利用まで、制作ペースに合うプランを選べます。",
  },
  en: {
    badge: "AI image, video, lip-sync, and content creation platform",
    heroTitle: "Go from idea to finished assets with",
    heroHighlight: "one AI creation workflow",
    heroSub:
      "Superstar AI brings image generation, video creation, voice, and lip-sync tools into one workspace for social content, product visuals, avatars, and campaign assets.",
    signUp: "Start creating",
    launch: "Explore tools",
    navModels: "Tools",
    navPricing: "Pricing",
    navStart: "Start creating",
    modelsLabel: "Creative tools",
    modelsTitle: "Choose the creative job you need: images, videos, or lip-sync.",
    lanes: [
      { tag: "Image", title: "Generate images", models: "Product shots · Characters · Social assets", body: "Create from prompts, edit with references, extend images, and switch styles without leaving the workspace.", action: "Generate images", href: "/drawing?tool=image", mediaSrc: LANE_MEDIA.image },
      { tag: "Video", title: "Create videos", models: "Image to video · Text to video · Short-form clips", body: "Turn prompts or still images into motion for ads, social posts, product demos, and character content.", action: "Create videos", href: "/drawing?tool=video", mediaSrc: LANE_MEDIA.video },
      { tag: "Lip sync", title: "AI lip-sync and avatars", models: "Lip sync · Talking avatar · Voice", body: "A hard-coded feature entry for lip-sync, avatars, and voice workflows, ready for you to swap in final URLs later.", action: "View lip-sync tools", href: "/drawing?tool=lipsync", mediaSrc: LANE_MEDIA.lipsync, mediaPosition: "center top" },
    ],
    ribbon: ["AI Image", "Image to Video", "Text to Video", "Lip Sync", "Voice", "Avatar", "Creative Workflow", "Superstar AI"],
    privacyLabel: "Workflow",
    privacyTitle: "Not just models. A connected creation workflow.",
    privacyBody:
      "The useful product is not a long model list. It is a clear path from image to video to voice to editing, so creators can finish real deliverables faster.",
    privacyPoints: ["Image generation", "Video creation", "AI lip-sync", "Workflow integration"],
    pricingTitle: "Upgrade your plan",
    pricingBody: "Choose the plan that fits your pace, from free creation to full generation, storage, and commercial rights.",
  },
};

function getCopy(locale: string): Copy {
  return copyByLocale[locale] ?? copyByLocale.en;
}

function localeHref(locale: string, path: string) {
  return `/${locale}${path}`;
}

export default function LandingHome({
  locale,
  initialUser = null,
  hasAuthCookie = false,
}: LandingHomeProps) {
  const t = getCopy(locale);
  const paymentT = useTranslations("payment");
  const [user, setUser] = useState<User | null>(initialUser);
  const [activePricingTab, setActivePricingTab] = useState<"yearly" | "monthly">("monthly");
  const [openPaymentModel, setOpenPaymentModel] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    if (initialUser) {
      setUser(initialUser);
      return;
    }
    const syncHomepageUser = async () => {
      try {
        const response = await fetch("/api/auth/me", { credentials: "include" });
        if (!response.ok || isCancelled) return;
        const data = await response.json();
        if (!isCancelled) setUser(data?.user ?? data ?? null);
      } catch {
        if (!isCancelled) setUser(null);
      }
    };
    syncHomepageUser();
    return () => {
      isCancelled = true;
    };
  }, [initialUser]);

  const extractPriceValue = (rawPrice: string) =>
    rawPrice.includes("/") ? rawPrice.split("/")[0].trim() : rawPrice.trim();

  const pricingDuration = locale === "zh-TW" || locale === "ja" ? "/月" : "/month";
  const dashboardHref = localeHref(locale, "/drawing");
  const modelsHref = localeHref(locale, "/models");
  const loginHref = localeHref(locale, "/login");

  const dashboardLabel =
    locale === "zh-TW" ? "進入工作台" : locale === "ja" ? "ワークスペースへ" : "Go to workspace";
  const signedInFallback =
    locale === "zh-TW" ? "已登入" : locale === "ja" ? "ログイン済み" : "Signed in";
  const accountLabel =
    user?.name?.trim() ||
    user?.username?.trim() ||
    user?.email?.trim() ||
    (hasAuthCookie ? signedInFallback : "");
  const loginLabel = locale === "zh-TW" ? "登入" : locale === "ja" ? "ログイン" : "Sign in";
  const isAuthenticated = Boolean(user || hasAuthCookie);

  const handleStartCreating = () => {
    window.location.href = isAuthenticated ? dashboardHref : modelsHref;
  };

  const planFeatures = {
    standard:
      locale === "zh-TW"
        ? ["每日 10 點", "1024 x 1024 圖像品質", "具浮水印下載", "無商業使用權"]
        : locale === "ja"
          ? ["毎日 10 ポイント", "1024 x 1024 画質", "透かし付きダウンロード", "商用利用不可"]
          : ["10 credits per day", "1024 x 1024 image quality", "Watermarked downloads", "No commercial rights"],
    plus:
      locale === "zh-TW"
        ? ["每月 1,000 點", "無浮水印下載", "收藏與儲存空間", "商業使用權"]
        : locale === "ja"
          ? ["毎月 1,000 ポイント", "透かしなしダウンロード", "保存とライブラリ機能", "商用利用権"]
          : ["1,000 credits monthly", "Watermark-free downloads", "Save and library access", "Commercial rights"],
    pro:
      locale === "zh-TW"
        ? ["每月 4,000 點", "無浮水印下載", "AI 優化與編輯功能", "商業使用權"]
        : locale === "ja"
          ? ["毎月 4,000 ポイント", "透かしなしダウンロード", "AI 編集機能", "商用利用権"]
          : ["4,000 credits monthly", "Watermark-free downloads", "AI editing tools", "Commercial rights"],
    max:
      locale === "zh-TW"
        ? ["每月 10,000 點", "完整創作空間", "客製模型優惠", "商業使用權"]
        : locale === "ja"
          ? ["毎月 10,000 ポイント", "フルクリエイティブ環境", "カスタムモデル特典", "商用利用権"]
          : ["10,000 credits monthly", "Full creative workspace", "Model customization perks", "Commercial rights"],
  };

  const homepagePlans = [
    {
      id: "standard",
      name: paymentT("standard_plan_name"),
      tagline: locale === "zh-TW" ? "免費體驗基礎功能" : locale === "ja" ? "無料で基本機能を試す" : "Free daily credits to try basics",
      price: extractPriceValue(paymentT("standard_plan_price")),
      originalPrice: null as string | null,
      buttonText: locale === "zh-TW" ? "開始創作" : "Start for free",
      features: planFeatures.standard,
      isPopular: false,
      accent: "default" as const,
    },
    {
      id: "plus",
      name: paymentT("plus_plan_name"),
      tagline: locale === "zh-TW" ? "適合日常創作" : locale === "ja" ? "人気機能を開放" : "Our most popular features",
      price: extractPriceValue(activePricingTab === "yearly" ? paymentT("plus_plan_yearly_price") : paymentT("plus_plan_price")),
      originalPrice: activePricingTab === "yearly" ? extractPriceValue(paymentT("plus_plan_monthly_price")) : null,
      buttonText: "Get Plus",
      features: planFeatures.plus,
      isPopular: false,
      accent: "default" as const,
    },
    {
      id: "pro",
      name: paymentT("pro_plan_name"),
      tagline: locale === "zh-TW" ? "進階功能與更多點數" : locale === "ja" ? "高度な機能と割引" : "Advanced features and credit discounts",
      price: extractPriceValue(activePricingTab === "yearly" ? paymentT("pro_plan_yearly_price") : paymentT("pro_plan_price")),
      originalPrice: activePricingTab === "yearly" ? extractPriceValue(paymentT("pro_plan_monthly_price")) : null,
      buttonText: "Get Pro",
      features: planFeatures.pro,
      isPopular: true,
      accent: "pro" as const,
    },
    {
      id: "max",
      name: paymentT("max_plan_name"),
      tagline: locale === "zh-TW" ? "完整功能與更高額度" : locale === "ja" ? "フルアクセスと高い上限" : "Full access, higher credit discounts",
      price: extractPriceValue(activePricingTab === "yearly" ? paymentT("max_plan_yearly_price") : paymentT("max_plan_price")),
      originalPrice: activePricingTab === "yearly" ? extractPriceValue(paymentT("max_plan_monthly_price")) : null,
      buttonText: "Get Max",
      features: planFeatures.max,
      isPopular: false,
      accent: "max" as const,
    },
  ];

  // marquee image columns (duplicated for seamless loop)
  const marqueeA = [...SHOWCASE_IMAGES, ...SHOWCASE_IMAGES];

  return (
    <main className="psf-home min-h-screen">
      {/* ---------------------------------------------------------------- nav */}
      <header className="psf-nav">
        <div className="psf-nav-inner">
          <Link
            href={localeHref(locale, "")}
            className="psf-brand"
            style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 14 }}
          >
            <Image
              src="/images/logo-small.svg"
              alt="超星AI平台"
              width={32}
              height={32}
              className="psf-brand-mark"
              priority
            />
            <span>超星AI平台</span>
          </Link>

          <nav className="psf-nav-links">
            <a href="#models">{t.navModels}</a>
            <a href="#pricing">{t.navPricing}</a>
          </nav>

          <div className="psf-nav-actions">
            {isAuthenticated ? (
              <>
                <Link href={dashboardHref} className="psf-account-pill" title={accountLabel}>
                  <span className="psf-account-avatar" aria-hidden>
                    {accountLabel.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="psf-account-name">{accountLabel}</span>
                </Link>
                <Link href={dashboardHref} className="psf-btn psf-btn-primary">
                  {dashboardLabel}
                </Link>
              </>
            ) : (
              <>
                <Link href={loginHref} className="psf-btn psf-btn-ghost">
                  {loginLabel}
                </Link>
                <button type="button" onClick={handleStartCreating} className="psf-btn psf-btn-primary">
                  {t.navStart}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------- hero */}
      <section className="psf-hero">
        <div className="psf-hero-glow" aria-hidden />
        <div className="psf-hero-copy">
          <span className="psf-badge">
            <span className="psf-badge-dot" />
            {t.badge}
          </span>

          <h1 className="psf-hero-title">
            {t.heroTitle} <span className="psf-grad-text">{t.heroHighlight}</span>
          </h1>

          <p className="psf-hero-sub">{t.heroSub}</p>

          <div className="psf-hero-cta">
            <button type="button" onClick={handleStartCreating} className="psf-btn psf-btn-primary psf-btn-lg">
              {isAuthenticated ? dashboardLabel : t.signUp}
            </button>
            <Link href={modelsHref} className="psf-btn psf-btn-outline psf-btn-lg">
              {t.launch} <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>

        {/* real product = real images, not a fake play button */}
        <div className="psf-hero-gallery" aria-hidden>
          <div className="psf-marquee psf-marquee-up">
            {marqueeA.map((src, i) => (
              <div key={`g1-${i}`} className="psf-shot">
                <Image src={src} alt="" fill sizes="220px" className="psf-shot-img" />
              </div>
            ))}
          </div>
          <div className="psf-marquee psf-marquee-down">
            {[...marqueeA].reverse().map((src, i) => (
              <div key={`g2-${i}`} className="psf-shot">
                <Image src={src} alt="" fill sizes="220px" className="psf-shot-img" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ribbon */}
      <div className="psf-ribbon">
        <div className="psf-ribbon-track">
          {[...t.ribbon, ...t.ribbon].map((item, i) => (
            <span key={`${item}-${i}`} className="psf-ribbon-item">
              <span className="psf-ribbon-dot" />
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------- models */}
      <section id="models" className="psf-section">
        <div className="psf-shell">
          <p className="psf-eyebrow">{t.modelsLabel}</p>
          <h2 className="psf-h2">{t.modelsTitle}</h2>

          <div className="psf-lanes">
            {t.lanes.map((lane) => {
              const hasVideoMedia = isVideoMedia(lane.mediaSrc);

              return (
                <article key={lane.title} className="psf-lane">
                  <div className="psf-lane-thumb">
                    {hasVideoMedia ? (
                      <video
                        src={lane.mediaSrc}
                        className="psf-lane-media"
                        style={{ objectPosition: lane.mediaPosition || "center center" }}
                        aria-label={lane.title}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      <Image
                        src={lane.mediaSrc}
                        alt={lane.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 360px"
                        className="psf-lane-media"
                        style={{ objectPosition: lane.mediaPosition || "center center" }}
                      />
                    )}
                    <span className="psf-lane-tag">{lane.tag}</span>
                  </div>
                  <div className="psf-lane-body">
                    <h3 className="psf-lane-title">{lane.title}</h3>
                    <p className="psf-lane-models">{lane.models}</p>
                    <p className="psf-lane-text">{lane.body}</p>
                    <Link href={localeHref(locale, lane.href)} className="psf-lane-link">
                      {lane.action} <span aria-hidden>↗</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ privacy */}
      <section id="privacy" className="psf-section">
        <div className="psf-shell">
          <div className="psf-privacy">
            <p className="psf-eyebrow">{t.privacyLabel}</p>
            <h2 className="psf-h2 psf-h2-tight">{t.privacyTitle}</h2>
            <p className="psf-privacy-body">{t.privacyBody}</p>
            <div className="psf-chips">
              {t.privacyPoints.map((point) => (
                <span key={point} className="psf-chip">{point}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ pricing */}
      <section id="pricing" className="psf-section">
        <div className="psf-shell">
          <div className="psf-pricing-head">
            <h2 className="psf-h2">{paymentT("upgrade_your_plan")}</h2>
            <p className="psf-pricing-sub">{t.pricingBody}</p>

            <div className="psf-toggle">
              <button
                type="button"
                onClick={() => setActivePricingTab("monthly")}
                className={activePricingTab === "monthly" ? "is-active" : ""}
              >
                {paymentT("monthly_subscription")}
              </button>
              <button
                type="button"
                onClick={() => setActivePricingTab("yearly")}
                className={activePricingTab === "yearly" ? "is-active" : ""}
              >
                {paymentT("yearly_subscription")}
              </button>
              <span className="psf-toggle-badge">{paymentT("discount_off")}</span>
            </div>
          </div>

          <div className="psf-plans">
            {homepagePlans.map((plan) => (
              <div
                key={plan.name}
                className={`hondolab-plan${plan.isPopular ? " is-popular" : ""}`}
              >
                {plan.isPopular ? <span className="psf-plan-flag">{paymentT("popular")}</span> : null}

                <h3 className="psf-plan-name">{plan.name}</h3>
                {plan.tagline ? <p className="psf-plan-tagline">{plan.tagline}</p> : null}

                <div className="psf-plan-price">
                  <span className="psf-plan-amount">{plan.price}</span>
                  <span className="psf-plan-period">{pricingDuration}</span>
                </div>
                {plan.originalPrice ? (
                  <p className="psf-plan-original">
                    {paymentT("original_price")} <s>{plan.originalPrice}</s>
                  </p>
                ) : (
                  <p className="psf-plan-original psf-plan-original-empty">&nbsp;</p>
                )}

                <ul className="psf-plan-features">
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check className="psf-plan-check" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    if (plan.id === "standard") {
                      handleStartCreating();
                      return;
                    }
                    setOpenPaymentModel(true);
                  }}
                  className={`hondolab-btn psf-plan-btn ${
                    plan.isPopular ? "psf-btn-primary" : "psf-btn-soft"
                  }`}
                >
                  {plan.buttonText}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- footer */}
      <footer className="psf-footer">
        <div className="psf-shell psf-footer-inner">
          <Link
            href={localeHref(locale, "")}
            className="psf-brand psf-brand-sm"
            style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 14 }}
          >
            <Image src="/images/logo-small.svg" alt="超星AI平台" width={24} height={24} />
            <span>超星AI平台</span>
          </Link>
          <p className="psf-footer-note">© {new Date().getFullYear()} 超星AI平台</p>
        </div>
      </footer>

      {openPaymentModel ? (
        <AuthProvider initialUser={initialUser}>
          <PaymentModelDialog
            path={`/${locale}`}
            isOpen={openPaymentModel}
            onClose={() => setOpenPaymentModel(false)}
            onSelectPlan={() => setOpenPaymentModel(false)}
            setIsDialogOpen={() => {}}
            onStandardPlanClick={() => handleStartCreating()}
          />
        </AuthProvider>
      ) : null}

      <style jsx>{`
        /* ============================================================ tokens */
        .psf-home {
          /* light (default) */
          --bg: #f6f8fd;
          --bg-soft: #eef2fb;
          --surface: #ffffff;
          --surface-2: #f3f6fc;
          --border: rgba(34, 50, 74, 0.1);
          --border-strong: rgba(34, 50, 74, 0.16);
          --text: #1b2740;
          --text-soft: #5c6c88;
          --text-faint: #8a99b3;
          --brand-a: #7d90ff;
          --brand-b: #63cfff;
          --accent: #159cff;
          --accent-strong: #007edb;
          --accent-tint: rgba(21, 156, 255, 0.1);
          --shadow: 0 18px 40px -24px rgba(34, 50, 74, 0.4);
          --shadow-lg: 0 30px 60px -30px rgba(34, 50, 74, 0.45);

          background: var(--bg);
          color: var(--text);
          overflow-x: hidden;
          font-feature-settings: "cv11", "ss01";
        }
        :global(.dark) .psf-home {
          --bg: #0a121e;
          --bg-soft: #0c1622;
          --surface: #101c2b;
          --surface-2: #0d1825;
          --border: rgba(255, 255, 255, 0.08);
          --border-strong: rgba(255, 255, 255, 0.14);
          --text: #eef7ff;
          --text-soft: #a6bed2;
          --text-faint: #6f87a0;
          --accent-tint: rgba(21, 156, 255, 0.16);
          --shadow: 0 18px 50px -28px rgba(0, 0, 0, 0.8);
          --shadow-lg: 0 40px 80px -40px rgba(0, 0, 0, 0.9);
        }

        .psf-shell {
          margin: 0 auto;
          width: 100%;
          max-width: 1160px;
          padding: 0 24px;
        }

        /* ============================================================ buttons */
        .psf-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border-radius: 999px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 600;
          line-height: 1;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease,
            box-shadow 0.18s ease, filter 0.18s ease;
          white-space: nowrap;
        }
        .psf-btn > span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          line-height: 1;
        }
        .psf-btn-lg {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 14px 28px;
          font-size: 15px;
        }
        .psf-btn-primary {
          background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
          color: #fff;
          box-shadow: 0 12px 28px -12px rgba(125, 144, 255, 0.6);
        }
        .psf-btn-primary:hover {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .psf-btn-ghost {
          background: transparent;
          color: var(--text);
          border-color: var(--border-strong);
        }
        .psf-btn-ghost:hover {
          background: var(--surface-2);
        }
        .psf-btn-outline {
          background: var(--surface);
          color: var(--text);
          border-color: var(--border-strong);
        }
        .psf-btn-outline:hover {
          transform: translateY(-1px);
          border-color: var(--accent);
          color: var(--accent);
        }
        .psf-btn-soft {
          background: var(--surface-2);
          color: var(--text);
          border-color: var(--border);
        }
        .psf-btn-soft:hover {
          background: var(--accent-tint);
          color: var(--accent-strong);
        }

        /* ================================================================ nav */
        .psf-nav {
          position: sticky;
          top: 0;
          z-index: 50;
          background: color-mix(in srgb, var(--bg) 72%, transparent);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid var(--border);
        }
        .psf-nav-inner {
          margin: 0 auto;
          max-width: 1160px;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .psf-brand {
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 36px;
          font-size: 20px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--text);
        }
        .psf-brand-mark {
          display: block;
          width: 32px;
          height: 32px;
          object-fit: contain;
          flex: 0 0 auto;
        }
        .psf-nav-links {
          display: none;
          gap: 4px;
        }
        .psf-nav-links a {
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--text-soft);
          transition: background 0.18s ease, color 0.18s ease;
        }
        .psf-nav-links a:hover {
          background: var(--surface-2);
          color: var(--text);
        }
        .psf-nav-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .psf-account-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          max-width: 190px;
          min-height: 38px;
          padding: 5px 12px 5px 6px;
          border-radius: 999px;
          color: var(--text);
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow-soft);
        }
        .psf-account-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          flex: 0 0 auto;
          border-radius: 999px;
          color: #041124;
          font-size: 13px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--brand-b), var(--accent));
        }
        .psf-account-name {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 14px;
          font-weight: 700;
          line-height: 1;
        }
        @media (min-width: 900px) {
          .psf-nav-links {
            display: flex;
          }
        }

        /* =============================================================== hero */
        .psf-hero {
          position: relative;
          max-width: 1160px;
          margin: 0 auto;
          padding: 72px 24px 56px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 40px;
          align-items: center;
        }
        .psf-hero-glow {
          position: absolute;
          top: -160px;
          left: 50%;
          transform: translateX(-50%);
          width: 720px;
          height: 720px;
          max-width: 120vw;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(99, 207, 255, 0.22) 0%,
            rgba(125, 144, 255, 0.12) 36%,
            transparent 70%
          );
          pointer-events: none;
          z-index: 0;
        }
        .psf-hero-copy {
          position: relative;
          z-index: 1;
        }
        .psf-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          background: var(--surface);
          border: 1px solid var(--border);
          font-size: 13px;
          font-weight: 500;
          color: var(--text-soft);
          box-shadow: var(--shadow);
        }
        .psf-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 0 4px var(--accent-tint);
        }
        .psf-hero-title {
          margin: 24px 0 0;
          font-size: clamp(38px, 6.4vw, 66px);
          font-weight: 700;
          line-height: 1.04;
          letter-spacing: -0.04em;
          max-width: 16ch;
        }
        .psf-grad-text {
          background: linear-gradient(120deg, var(--brand-a), var(--accent), var(--brand-b));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .psf-hero-sub {
          margin: 22px 0 0;
          max-width: 46ch;
          font-size: clamp(16px, 2.2vw, 19px);
          line-height: 1.6;
          color: var(--text-soft);
        }
        .psf-hero-cta {
          margin-top: 32px;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }

        .psf-hero-gallery {
          position: relative;
          z-index: 1;
          display: none;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          height: 520px;
          overflow: hidden;
          mask-image: linear-gradient(to bottom, transparent, #000 12%, #000 88%, transparent);
        }
        .psf-marquee {
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: psf-scroll-y 38s linear infinite;
        }
        .psf-marquee-down {
          animation-direction: reverse;
          animation-duration: 46s;
        }
        .psf-shot {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 5;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
          background: var(--surface-2);
          flex-shrink: 0;
        }
        :global(.psf-shot-img) {
          object-fit: cover;
        }
        @media (min-width: 980px) {
          .psf-hero {
            grid-template-columns: 1.05fr 0.95fr;
            padding-top: 96px;
          }
          .psf-hero-gallery {
            display: grid;
          }
        }

        /* ============================================================= ribbon */
        .psf-ribbon {
          overflow: hidden;
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--bg-soft);
          mask-image: linear-gradient(to right, transparent, #000 8%, #000 92%, transparent);
          padding: 18px 0;
        }
        .psf-ribbon-track {
          display: flex;
          width: max-content;
          gap: 44px;
          animation: psf-scroll-x 26s linear infinite;
        }
        .psf-ribbon-item {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-faint);
          white-space: nowrap;
        }
        .psf-ribbon-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
        }

        /* ============================================================ section */
        .psf-section {
          padding: 88px 0;
        }
        .psf-eyebrow {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--text-faint);
          margin: 0;
        }
        .psf-h2 {
          margin: 14px 0 0;
          font-size: clamp(28px, 4.4vw, 46px);
          font-weight: 700;
          line-height: 1.1;
          letter-spacing: -0.035em;
          max-width: 18ch;
        }
        .psf-h2-tight {
          max-width: 14ch;
        }

        /* ============================================================== lanes */
        .psf-lanes {
          margin-top: 48px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 720px) {
          .psf-lanes {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        .psf-lane {
          display: flex;
          flex-direction: column;
          border-radius: 22px;
          background: var(--surface);
          border: 1px solid var(--border);
          overflow: hidden;
          box-shadow: var(--shadow);
          transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
        }
        .psf-lane:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--border-strong);
        }
        .psf-lane-thumb {
          position: relative;
          aspect-ratio: 3 / 2;
          overflow: hidden;
          background: var(--surface-2);
        }
        :global(.psf-lane-media) {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.4s ease;
        }
        .psf-lane:hover :global(.psf-lane-media) {
          transform: scale(1.06);
        }
        .psf-lane-tag {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 5px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          background: rgba(10, 18, 30, 0.55);
          backdrop-filter: blur(8px);
        }
        .psf-lane-body {
          padding: 22px;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .psf-lane-title {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .psf-lane-models {
          margin: 6px 0 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
        }
        .psf-lane-text {
          margin: 14px 0 0;
          font-size: 14px;
          line-height: 1.65;
          color: var(--text-soft);
          flex: 1;
        }
        .psf-lane-link {
          margin-top: 18px;
          align-self: flex-start;
          background: none;
          border: none;
          padding: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--accent);
          cursor: pointer;
          display: inline-flex;
          gap: 5px;
          text-decoration: none;
          transition: gap 0.18s ease;
        }
        .psf-lane-link:hover {
          gap: 9px;
        }

        /* ============================================================ privacy */
        .psf-privacy {
          border-radius: 28px;
          padding: clamp(28px, 5vw, 56px);
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--brand-a) 14%, var(--surface)),
            var(--surface)
          );
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
        }
        .psf-privacy-body {
          margin: 20px 0 0;
          max-width: 60ch;
          font-size: clamp(15px, 2vw, 17px);
          line-height: 1.75;
          color: var(--text-soft);
        }
        .psf-chips {
          margin-top: 26px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .psf-chip {
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          background: var(--surface-2);
          border: 1px solid var(--border);
        }

        /* ============================================================ pricing */
        .psf-pricing-head {
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .psf-pricing-head .psf-h2 {
          max-width: none;
        }
        .psf-pricing-sub {
          margin: 14px 0 0;
          max-width: 52ch;
          font-size: 15px;
          line-height: 1.6;
          color: var(--text-soft);
        }
        .psf-toggle {
          margin-top: 28px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px;
          border-radius: 16px;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .psf-toggle button {
          border: none;
          background: transparent;
          padding: 9px 22px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-soft);
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease;
        }
        .psf-toggle button.is-active {
          background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
          color: #fff;
        }
        .psf-toggle-badge {
          margin-left: 4px;
          padding: 6px 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          color: var(--accent-strong);
          background: var(--accent-tint);
        }

        .psf-plans {
          margin-top: 48px;
          display: grid;
          grid-template-columns: 1fr;
          gap: 18px;
        }
        @media (min-width: 640px) {
          .psf-plans {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1080px) {
          .psf-plans {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .psf-plan {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 30px 26px;
          border-radius: 24px;
          background: var(--surface);
          border: 1px solid var(--border);
          box-shadow: var(--shadow);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .psf-plan:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg);
        }
        .psf-plan.is-popular {
          border-color: transparent;
          background: linear-gradient(var(--surface), var(--surface)) padding-box,
            linear-gradient(135deg, var(--brand-a), var(--brand-b)) border-box;
          border: 1.5px solid transparent;
        }
        .psf-plan-flag {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          padding: 5px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
          box-shadow: 0 8px 18px -8px rgba(125, 144, 255, 0.8);
        }
        .psf-plan-name {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .psf-plan-tagline {
          margin: 8px 0 0;
          font-size: 13px;
          line-height: 1.5;
          color: var(--text-soft);
          min-height: 38px;
        }
        .psf-plan-price {
          margin-top: 22px;
          display: flex;
          align-items: flex-end;
          gap: 6px;
        }
        .psf-plan-amount {
          font-size: 44px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.04em;
        }
        .is-popular .psf-plan-amount {
          background: linear-gradient(120deg, var(--brand-a), var(--brand-b));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .psf-plan-period {
          padding-bottom: 4px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-soft);
        }
        .psf-plan-original {
          margin: 10px 0 0;
          font-size: 13px;
          color: var(--text-faint);
        }
        .psf-plan-original-empty {
          visibility: hidden;
        }
        .psf-plan-features {
          margin: 24px 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex: 1;
        }
        .psf-plan-features li {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          font-size: 14px;
          line-height: 1.45;
          color: var(--text);
        }
        :global(.psf-plan-check) {
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          margin-top: 1px;
          color: var(--accent);
        }
        .psf-plan-btn {
          margin-top: 26px;
          width: 100%;
          padding: 13px;
          font-size: 15px;
        }

        /* ============================================================= footer */
        .psf-footer {
          border-top: 1px solid var(--border);
          padding: 32px 0;
          background: var(--bg-soft);
        }
        .psf-footer-inner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .psf-brand-sm {
          display: flex;
          align-items: center;
          min-height: 28px;
          font-size: 16px;
        }
        .psf-brand-sm :global(img) {
          width: 24px;
          height: 24px;
        }
        .psf-footer-note {
          margin: 0;
          font-size: 13px;
          color: var(--text-faint);
        }

        /* ========================================================= keyframes */
        @keyframes psf-scroll-x {
          to {
            transform: translateX(-50%);
          }
        }
        @keyframes psf-scroll-y {
          to {
            transform: translateY(-50%);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .psf-ribbon-track,
          .psf-marquee {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
