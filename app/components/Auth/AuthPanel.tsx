"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { FaGoogle } from "react-icons/fa";

import { useAuth } from "@/app/hooks/useAuth";

type Variant = "page" | "dialog";

type AuthPanelProps = {
  variant?: Variant;
  callbackUrl?: string;
  onSuccess?: () => void;
};

type AuthCopy = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  googleHint: string;
  home: string;
};

const AUTH_COPY: Record<string, AuthCopy> = {
  "zh-TW": {
    eyebrow: "Hondolab Access",
    title: "把生成、編輯與收藏整理成同一個創作入口。",
    description:
      "先登入，再回到原本的工作流繼續操作。你可以用 Google 快速登入，也可以用帳號密碼進入。",
    bullets: ["Google 一鍵登入", "帳號密碼登入", "登入後回到原頁"],
    googleHint: "Google 會走最快的登入流程，省掉另外記一組密碼。",
    home: "返回首頁",
  },
  ja: {
    eyebrow: "Hondolab Access",
    title: "生成、編集、保存をひとつの制作入口にまとめる。",
    description:
      "ログイン後は元の制作フローへ戻ります。Google でも、メールとパスワードでもサインインできます。",
    bullets: ["Google ですぐログイン", "メールとパスワード", "ログイン後は元のページへ戻る"],
    googleHint: "Google なら最短で入れます。別のパスワードを覚える必要はありません。",
    home: "ホームへ戻る",
  },
  en: {
    eyebrow: "Hondolab Access",
    title: "Keep generation, editing, and saved work inside one creative entry point.",
    description:
      "Sign in first, then return to the exact flow you came from. Use Google for speed or email and password for a standard account flow.",
    bullets: [
      "One-click Google sign in",
      "Email and password sign in",
      "Return to the original page after auth",
    ],
    googleHint: "Google is the fastest route in if you do not want another password.",
    home: "Back home",
  },
};

const isSafePath = (value: string, locale: string) => {
  if (!value.startsWith("/")) {
    return false;
  }

  const blockedPrefixes = [
    `/${locale}/login`,
    "/api/auth/google-url",
    "/api/auth-google",
  ];

  return !blockedPrefixes.some((prefix) => value.startsWith(prefix));
};

const normalizeCallbackUrl = (
  value: string | null | undefined,
  locale: string,
  fallbackPath?: string
) => {
  const fallback = fallbackPath || `/${locale}/drawing`;

  if (!value) {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
      return isSafePath(path, locale) ? path : fallback;
    } catch {
      return fallback;
    }
  }

  return isSafePath(trimmed, locale) ? trimmed : fallback;
};

const AuthPanel = ({
  variant = "page",
  callbackUrl,
  onSuccess,
}: AuthPanelProps) => {
  const { login, register, loading, user } = useAuth();
  const t = useTranslations("login");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const copy = AUTH_COPY[locale] || AUTH_COPY.en;
  const fallbackPath =
    pathname && pathname !== `/${locale}/login`
      ? pathname
      : `/${locale}/drawing`;
  const rawCallbackUrl = callbackUrl ?? searchParams.get("callbackUrl") ?? pathname;
  const finalCallbackUrl = normalizeCallbackUrl(rawCallbackUrl, locale, fallbackPath);
  const isRegister = mode === "register";
  const submitLabel = useMemo(
    () => (isRegister ? t("submit_register") : t("submit_sign_in")),
    [isRegister, t]
  );

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    onSuccess?.();
    router.replace(finalCallbackUrl);
    router.refresh();
  }, [finalCallbackUrl, loading, onSuccess, router, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError(t("password_mismatch"));
          return;
        }

        await register({
          email,
          password,
          confirmPassword,
          name: name.trim() || undefined,
          username: username.trim() || undefined,
        });
      } else {
        await login(email, password, finalCallbackUrl);
      }

      onSuccess?.();
      router.replace(finalCallbackUrl);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : isRegister
            ? t("register_error")
            : t("login_error");
      setError(message);
    }
  };

  const handleGoogleLogin = () => {
    window.location.assign(
      `/api/auth/google-url?locale=${encodeURIComponent(locale)}&callbackUrl=${encodeURIComponent(finalCallbackUrl)}`
    );
  };

  const wrapperClassName =
    variant === "page"
      ? "relative overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-[0_30px_120px_rgba(29,50,84,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-[#091220]/85"
      : "relative overflow-hidden rounded-[28px] border border-white/45 bg-white/90 shadow-[0_24px_80px_rgba(18,31,52,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-[#091220]";
  const gridClassName =
    variant === "page"
      ? "grid lg:grid-cols-[1.08fr_0.92fr]"
      : "grid lg:grid-cols-[0.9fr_1.1fr]";

  return (
    <div className={wrapperClassName}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(39,177,255,0.2),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,186,120,0.24),transparent_34%)]" />
      <div className={gridClassName}>
        <div className="relative border-b border-slate-200/70 p-8 lg:border-b-0 lg:border-r lg:border-slate-200/70 lg:p-12 dark:border-white/10">
          <div className="flex h-full flex-col justify-between gap-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/50 bg-sky-100/70 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-sky-900 dark:border-sky-300/20 dark:bg-sky-400/10 dark:text-sky-200">
                <Sparkles className="h-3.5 w-3.5" />
                {copy.eyebrow}
              </div>
              <div className="space-y-3">
                <h1 className="max-w-xl text-4xl font-semibold leading-tight text-slate-950 dark:text-white lg:text-5xl">
                  {copy.title}
                </h1>
                <p className="max-w-lg text-sm leading-7 text-slate-600 dark:text-slate-300 lg:text-base">
                  {copy.description}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {copy.bullets.map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-4 text-sm text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  {item}
                </div>
              ))}
            </div>

            {variant === "page" ? (
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/${locale}`}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300/70 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/25 dark:hover:text-white"
                >
                  {copy.home}
                </Link>
                <Link
                  href={`/${locale}/drawing`}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
                >
                  Studio
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="mx-auto flex h-full w-full max-w-md flex-col justify-center">
            <div className="mb-6 grid grid-cols-2 rounded-full bg-slate-900/5 p-1 dark:bg-white/10">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  !isRegister
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 dark:text-slate-200"
                }`}
              >
                {t("sign_in")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  isRegister
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 dark:text-slate-200"
                }`}
              >
                {t("register")}
              </button>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <FaGoogle className="h-4 w-4" />
                {t("continue_with_google")}
              </button>
              <p className="text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
                {copy.googleHint}
              </p>
            </div>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
              <span>{t("or")}</span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {isRegister ? (
                <>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("name_placeholder")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={t("username_placeholder")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  />
                </>
              ) : null}

              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("email_placeholder_v2")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                required
              />

              {!isRegister ? (
                <div className="-mt-1 text-right">
                  <button
                    type="button"
                    onClick={() => router.push(`/${locale}/forgot-password`)}
                    className="text-sm font-medium text-sky-700 transition hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                  >
                    {t("forgot_password")}
                  </button>
                </div>
              ) : null}

              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("password_placeholder")}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                required
              />

              {isRegister ? (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder={t("confirm_password_placeholder")}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5 dark:text-white"
                  required
                />
              ) : null}

              {error ? <p className="text-sm text-red-500">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {loading ? t("submitting") : submitLabel}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPanel;
