"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/app/hooks/useAuth";

type Mode = "login" | "register";

type Copy = {
  title: string;
  registerTitle: string;
  subtitle: string;
  registerSubtitle: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  confirmPassword: string;
  confirmPasswordPlaceholder: string;
  name: string;
  namePlaceholder: string;
  username: string;
  usernamePlaceholder: string;
  forgot: string;
  submit: string;
  submitRegister: string;
  submitting: string;
  noAccount: string;
  hasAccount: string;
  signUp: string;
  signIn: string;
  or: string;
  google: string;
  back: string;
  pitchTitle: string;
  pitchBody: string;
  points: string[];
  missingLogin: string;
  missingRegister: string;
  passwordMismatch: string;
  loginError: string;
  registerError: string;
};

const copyByLocale: Record<string, Copy> = {
  "zh-TW": {
    title: "歡迎回來",
    registerTitle: "建立帳號",
    subtitle: "登入以繼續你的創作",
    registerSubtitle: "註冊後即可開始使用超星 AI 平台",
    email: "電子郵件",
    emailPlaceholder: "you@example.com",
    password: "密碼",
    passwordPlaceholder: "輸入密碼",
    confirmPassword: "確認密碼",
    confirmPasswordPlaceholder: "再次輸入密碼",
    name: "名稱",
    namePlaceholder: "小音",
    username: "使用者名稱",
    usernamePlaceholder: "xiouxi",
    forgot: "忘記密碼？",
    submit: "登入",
    submitRegister: "註冊",
    submitting: "處理中…",
    noAccount: "還沒有帳號？",
    hasAccount: "已經有帳號？",
    signUp: "註冊",
    signIn: "登入",
    or: "或",
    google: "使用 Google 繼續",
    back: "返回首頁",
    pitchTitle: "整合優質模型，更快做出驚艷的 AI 圖像",
    pitchBody: "從動漫、寫實到彈性編輯，一個簡單直覺、兼顧隱私的創作入口。",
    points: ["以開源為主", "模型整合", "高隱私"],
    missingLogin: "請輸入電子郵件與密碼",
    missingRegister: "請完整填寫電子郵件、密碼與確認密碼",
    passwordMismatch: "兩次輸入的密碼不一致",
    loginError: "登入失敗，請確認帳號密碼",
    registerError: "註冊失敗，請稍後再試",
  },
  ja: {
    title: "おかえりなさい",
    registerTitle: "アカウント作成",
    subtitle: "ログインして制作を続ける",
    registerSubtitle: "登録して超星 AI 平台を使い始めましょう",
    email: "メールアドレス",
    emailPlaceholder: "you@example.com",
    password: "パスワード",
    passwordPlaceholder: "パスワードを入力",
    confirmPassword: "パスワード確認",
    confirmPasswordPlaceholder: "もう一度入力",
    name: "名前",
    namePlaceholder: "名前",
    username: "ユーザー名",
    usernamePlaceholder: "username",
    forgot: "パスワードをお忘れですか？",
    submit: "ログイン",
    submitRegister: "登録",
    submitting: "処理中…",
    noAccount: "アカウントがありませんか？",
    hasAccount: "すでにアカウントをお持ちですか？",
    signUp: "登録",
    signIn: "ログイン",
    or: "または",
    google: "Google で続行",
    back: "ホームへ戻る",
    pitchTitle: "優れたモデルを統合し、もっと早く驚くほどの AI 画像を",
    pitchBody: "アニメ、写実、編集まで。直感的でプライバシーに配慮した創作入口。",
    points: ["オープンソース中心", "モデル統合", "高いプライバシー"],
    missingLogin: "メールとパスワードを入力してください",
    missingRegister: "メール、パスワード、確認用パスワードを入力してください",
    passwordMismatch: "パスワードが一致しません",
    loginError: "ログインに失敗しました。入力を確認してください",
    registerError: "登録に失敗しました。しばらくしてからもう一度お試しください",
  },
  en: {
    title: "Welcome back",
    registerTitle: "Create account",
    subtitle: "Sign in to continue creating",
    registerSubtitle: "Create an account to start using Superstar AI",
    email: "Email",
    emailPlaceholder: "you@example.com",
    password: "Password",
    passwordPlaceholder: "Enter your password",
    confirmPassword: "Confirm password",
    confirmPasswordPlaceholder: "Enter password again",
    name: "Name",
    namePlaceholder: "Your name",
    username: "Username",
    usernamePlaceholder: "username",
    forgot: "Forgot password?",
    submit: "Sign in",
    submitRegister: "Sign up",
    submitting: "Working…",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    signUp: "Sign up",
    signIn: "Sign in",
    or: "or",
    google: "Continue with Google",
    back: "Back to home",
    pitchTitle: "Integrate great models, create stunning AI images faster",
    pitchBody: "From anime to realistic to flexible editing, one intuitive, privacy-minded entry point.",
    points: ["Open-source first", "Model integration", "Higher privacy"],
    missingLogin: "Enter your email and password",
    missingRegister: "Enter email, password, and password confirmation",
    passwordMismatch: "Passwords do not match",
    loginError: "Sign in failed. Check your email and password.",
    registerError: "Registration failed. Please try again.",
  },
};

function getCopy(locale: string): Copy {
  return copyByLocale[locale] ?? copyByLocale.en;
}

function isSafeCallbackUrl(value: string | null, locale: string) {
  if (!value) return false;
  return value.startsWith(`/${locale}/`) || value === `/${locale}`;
}

const Login = () => {
  const locale = useLocale();
  const t = getCopy(locale);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localeHref = (path: string) => `/${locale}${path}`;
  const callbackUrl = searchParams.get("callbackUrl");
  const finalCallbackUrl: string = isSafeCallbackUrl(callbackUrl, locale)
    ? callbackUrl || localeHref("/drawing")
    : localeHref("/drawing");
  const isRegister = mode === "register";

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
  };

  const handleGoogleLogin = () => {
    window.location.assign(
      `/api/auth/google-url?locale=${encodeURIComponent(locale)}&callbackUrl=${encodeURIComponent(finalCallbackUrl)}`
    );
  };

  const handleSubmit = async () => {
    setError(null);

    if (!email.trim() || !password) {
      setError(isRegister ? t.missingRegister : t.missingLogin);
      return;
    }

    if (isRegister && !confirmPassword) {
      setError(t.missingRegister);
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    try {
      setLoading(true);

      if (isRegister) {
        await register({
          email: email.trim(),
          password,
          confirmPassword,
          name: name.trim() || undefined,
          username: username.trim() || undefined,
        });
      } else {
        await login(email.trim(), password, finalCallbackUrl);
      }

      router.replace(finalCallbackUrl);
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : isRegister
            ? t.registerError
            : t.loginError
      );
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading) {
      void handleSubmit();
    }
  };

  return (
    <main className="psf-auth">
      <aside className="psf-auth-pitch" aria-hidden>
        <div className="psf-auth-glow" />
        <Link
          href={localeHref("")}
          className="psf-auth-brand"
          style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <Image src="/images/logo-small.svg" alt="超星AI平台" width={26} height={26} />
          <span>超星AI平台</span>
        </Link>
        <div className="psf-auth-pitch-body">
          <h2 className="psf-auth-pitch-title">{t.pitchTitle}</h2>
          <p className="psf-auth-pitch-sub">{t.pitchBody}</p>
          <div className="psf-auth-points">
            {t.points.map((point) => (
              <span key={point} className="psf-auth-chip">
                {point}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <section className="psf-auth-panel">
        <div className="psf-auth-card">
          <Link
            href={localeHref("")}
            className="psf-auth-brand psf-auth-brand-mobile"
            style={{ display: "inline-flex", flexDirection: "row", alignItems: "center", gap: 14 }}
          >
            <Image src="/images/logo-small.svg" alt="超星AI平台" width={24} height={24} />
            <span>超星AI平台</span>
          </Link>

          <h1 className="psf-auth-title">{isRegister ? t.registerTitle : t.title}</h1>
          <p className="psf-auth-subtitle">
            {isRegister ? t.registerSubtitle : t.subtitle}
          </p>

          <button
            type="button"
            className="psf-auth-oauth"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
            {t.google}
          </button>

          <div className="psf-auth-divider">
            <span>{t.or}</span>
          </div>

          <div className="psf-auth-tabs" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              className={mode === "login" ? "is-active" : ""}
              onClick={() => switchMode("login")}
            >
              {t.signIn}
            </button>
            <button
              type="button"
              className={mode === "register" ? "is-active" : ""}
              onClick={() => switchMode("register")}
            >
              {t.signUp}
            </button>
          </div>

          <div className="psf-auth-field">
            <label htmlFor="psf-email">{t.email}</label>
            <input
              id="psf-email"
              type="email"
              autoComplete="email"
              value={email}
              placeholder={t.emailPlaceholder}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>

          {isRegister ? (
            <div className="psf-auth-grid">
              <div className="psf-auth-field">
                <label htmlFor="psf-name">{t.name}</label>
                <input
                  id="psf-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  placeholder={t.namePlaceholder}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
              <div className="psf-auth-field">
                <label htmlFor="psf-username">{t.username}</label>
                <input
                  id="psf-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  placeholder={t.usernamePlaceholder}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
            </div>
          ) : null}

          <div className="psf-auth-field">
            <div className="psf-auth-label-row">
              <label htmlFor="psf-pw">{t.password}</label>
              {!isRegister ? (
                <Link href={localeHref("/forgot-password")} className="psf-auth-forgot">
                  {t.forgot}
                </Link>
              ) : null}
            </div>
            <div className="psf-auth-pw">
              <input
                id="psf-pw"
                type={showPw ? "text" : "password"}
                autoComplete={isRegister ? "new-password" : "current-password"}
                value={password}
                placeholder={t.passwordPlaceholder}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                type="button"
                className="psf-auth-pw-toggle"
                onClick={() => setShowPw((value) => !value)}
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {isRegister ? (
            <div className="psf-auth-field">
              <label htmlFor="psf-confirm-pw">{t.confirmPassword}</label>
              <div className="psf-auth-pw">
                <input
                  id="psf-confirm-pw"
                  type={showConfirmPw ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  placeholder={t.confirmPasswordPlaceholder}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={onKeyDown}
                />
                <button
                  type="button"
                  className="psf-auth-pw-toggle"
                  onClick={() => setShowConfirmPw((value) => !value)}
                  aria-label={showConfirmPw ? "Hide password" : "Show password"}
                >
                  {showConfirmPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="psf-auth-error">{error}</p> : null}

          <button
            type="button"
            className="psf-auth-submit"
            onClick={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="psf-spin" />
                {t.submitting}
              </>
            ) : isRegister ? (
              t.submitRegister
            ) : (
              t.submit
            )}
          </button>

          <p className="psf-auth-foot">
            {isRegister ? t.hasAccount : t.noAccount}{" "}
            <button
              type="button"
              className="psf-auth-foot-link"
              onClick={() => switchMode(isRegister ? "login" : "register")}
            >
              {isRegister ? t.signIn : t.signUp}
            </button>
          </p>

          <Link href={localeHref("")} className="psf-auth-back">
            ← {t.back}
          </Link>
        </div>
      </section>

      <style jsx>{`
        .psf-auth {
          --bg: #f6f8fd;
          --surface: #ffffff;
          --surface-2: #f3f6fc;
          --border: rgba(34, 50, 74, 0.12);
          --border-strong: rgba(34, 50, 74, 0.2);
          --text: #1b2740;
          --text-soft: #5c6c88;
          --text-faint: #8a99b3;
          --brand-a: #7d90ff;
          --brand-b: #63cfff;
          --accent: #159cff;
          --accent-strong: #007edb;
          --accent-tint: rgba(21, 156, 255, 0.1);
          --danger: #e5484d;

          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr;
          background: var(--bg);
          color: var(--text);
        }
        :global(.dark) .psf-auth {
          --bg: #0a121e;
          --surface: #101c2b;
          --surface-2: #0d1825;
          --border: rgba(255, 255, 255, 0.1);
          --border-strong: rgba(255, 255, 255, 0.2);
          --text: #eef7ff;
          --text-soft: #a6bed2;
          --text-faint: #6f87a0;
          --accent-tint: rgba(21, 156, 255, 0.18);
        }
        @media (min-width: 900px) {
          .psf-auth {
            grid-template-columns: 1.05fr 1fr;
          }
        }

        .psf-auth-pitch {
          display: none;
          position: relative;
          overflow: hidden;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          background: linear-gradient(150deg, #0c1622, #101c2b 60%, #0a121e);
          color: #eef7ff;
        }
        @media (min-width: 900px) {
          .psf-auth-pitch {
            display: flex;
          }
        }
        .psf-auth-glow {
          position: absolute;
          top: -180px;
          right: -120px;
          width: 560px;
          height: 560px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(99, 207, 255, 0.32),
            rgba(125, 144, 255, 0.16) 40%,
            transparent 70%
          );
          pointer-events: none;
        }
        .psf-auth-brand {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 14px;
          min-height: 30px;
          font-size: 18px;
          font-weight: 700;
          line-height: 1;
          letter-spacing: -0.02em;
          color: inherit;
        }
        .psf-auth-brand :global(img) {
          display: block;
          width: 26px;
          height: 26px;
          object-fit: contain;
          flex: 0 0 auto;
        }
        .psf-auth-pitch-body {
          position: relative;
          z-index: 1;
          max-width: 30ch;
        }
        .psf-auth-pitch-title {
          font-size: clamp(28px, 3vw, 40px);
          font-weight: 700;
          line-height: 1.12;
          letter-spacing: -0.035em;
          margin: 0;
        }
        .psf-auth-pitch-sub {
          margin: 18px 0 0;
          font-size: 16px;
          line-height: 1.6;
          color: #a6bed2;
        }
        .psf-auth-points {
          margin-top: 28px;
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
        }
        .psf-auth-chip {
          padding: 8px 15px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          color: #eef7ff;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .psf-auth-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 22px;
        }
        .psf-auth-card {
          width: 100%;
          max-width: 430px;
        }
        .psf-auth-brand-mobile {
          display: flex;
          align-items: center;
          gap: 10px;
          min-height: 28px;
          font-size: 17px;
          font-weight: 700;
          line-height: 1;
          color: var(--text);
          margin-bottom: 28px;
        }
        @media (min-width: 900px) {
          .psf-auth-brand-mobile {
            display: none;
          }
        }
        .psf-auth-title {
          margin: 0;
          font-size: 30px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }
        .psf-auth-subtitle {
          margin: 8px 0 0;
          font-size: 15px;
          color: var(--text-soft);
        }
        .psf-auth-oauth {
          margin-top: 28px;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          background: var(--surface);
          border: 1px solid var(--border-strong);
          cursor: pointer;
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .psf-auth-oauth:hover:not(:disabled) {
          background: var(--surface-2);
          transform: translateY(-1px);
        }
        .psf-auth-oauth:disabled {
          opacity: 0.6;
          cursor: default;
        }
        .psf-auth-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 22px 0;
          color: var(--text-faint);
          font-size: 13px;
        }
        .psf-auth-divider::before,
        .psf-auth-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .psf-auth-tabs {
          margin: 0 0 22px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 6px;
          border-radius: 14px;
          background: var(--surface-2);
          border: 1px solid var(--border);
        }
        .psf-auth-tabs button {
          border: 0;
          border-radius: 10px;
          padding: 10px;
          color: var(--text-soft);
          background: transparent;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
        }
        .psf-auth-tabs button.is-active {
          color: var(--text);
          background: var(--surface);
          box-shadow: 0 10px 24px -18px rgba(34, 50, 74, 0.5);
        }
        .psf-auth-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 12px;
        }
        @media (min-width: 560px) {
          .psf-auth-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .psf-auth-field {
          margin-bottom: 16px;
        }
        .psf-auth-field label {
          display: block;
          margin-bottom: 7px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }
        .psf-auth-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .psf-auth-forgot {
          font-size: 13px;
          font-weight: 600;
          color: var(--accent);
        }
        .psf-auth-forgot:hover {
          color: var(--accent-strong);
        }
        .psf-auth-field input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 15px;
          color: var(--text);
          background: var(--surface);
          border: 1px solid var(--border-strong);
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .psf-auth-field input::placeholder {
          color: var(--text-faint);
        }
        .psf-auth-field input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 4px var(--accent-tint);
        }
        .psf-auth-pw {
          position: relative;
        }
        .psf-auth-pw input {
          padding-right: 46px;
        }
        .psf-auth-pw-toggle {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          display: flex;
          padding: 6px;
          border: none;
          background: transparent;
          color: var(--text-faint);
          cursor: pointer;
          border-radius: 8px;
        }
        .psf-auth-pw-toggle:hover {
          color: var(--text);
          background: var(--surface-2);
        }
        .psf-auth-error {
          margin: 0 0 14px;
          font-size: 13px;
          color: var(--danger);
        }
        .psf-auth-submit {
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 13px;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          border: none;
          cursor: pointer;
          background: linear-gradient(135deg, var(--brand-a), var(--brand-b));
          box-shadow: 0 14px 30px -14px rgba(125, 144, 255, 0.7);
          transition: transform 0.18s ease, filter 0.18s ease;
        }
        .psf-auth-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .psf-auth-submit:disabled {
          opacity: 0.75;
          cursor: default;
        }
        :global(.psf-spin) {
          animation: psf-spin 0.8s linear infinite;
        }
        .psf-auth-foot {
          margin: 22px 0 0;
          text-align: center;
          font-size: 14px;
          color: var(--text-soft);
        }
        .psf-auth-foot-link {
          border: 0;
          padding: 0;
          background: transparent;
          font: inherit;
          font-weight: 700;
          color: var(--accent);
          cursor: pointer;
        }
        .psf-auth-foot-link:hover {
          color: var(--accent-strong);
        }
        .psf-auth-back {
          display: block;
          margin-top: 24px;
          text-align: center;
          font-size: 13px;
          color: var(--text-faint);
        }
        .psf-auth-back:hover {
          color: var(--text-soft);
        }
        @keyframes psf-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
};

export default Login;
