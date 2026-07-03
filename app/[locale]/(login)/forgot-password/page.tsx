"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

type ForgotPasswordResponse = {
  message?: string;
  retryAfterSec?: number;
};

export default function ForgotPasswordPage() {
  const t = useTranslations("login");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [retryAfterSec, setRetryAfterSec] = useState<number | null>(null);

  const submitLabel = useMemo(
    () => (isSubmitting ? t("submitting") : t("send_reset_password_email")),
    [isSubmitting, t]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccessMessage("");
    setRetryAfterSec(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = (await response.json().catch(() => ({}))) as ForgotPasswordResponse;

      if (response.status === 429) {
        setRetryAfterSec(Number(data.retryAfterSec) || null);
        setError(t("forgot_password_rate_limited"));
        return;
      }

      if (response.status === 400) {
        setError(t("invalid_email"));
        return;
      }

      if (!response.ok) {
        setError(t("forgot_password_failed"));
        return;
      }

      setSuccessMessage(
        data.message || t("forgot_password_success_fixed_message")
      );
    } catch {
      setError(t("forgot_password_failed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="psf-auth">
      <aside className="psf-auth-pitch" aria-hidden>
        <div className="psf-auth-glow" />
        <div className="psf-auth-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo-small.svg" alt="" width={30} height={30} style={{ width: 30, height: 30 }} />
          <span>超星AI平台</span>
        </div>
        <div className="psf-auth-pitch-body">
          <h2 className="psf-auth-pitch-title">找回你的創作入口</h2>
          <p className="psf-auth-pitch-sub">
            我們會寄出安全連結，讓你重新設定密碼後回到圖片、影片與模板創作流程。
          </p>
          <div className="psf-auth-points">
            <span className="psf-auth-chip">安全驗證</span>
            <span className="psf-auth-chip">快速回到工作台</span>
          </div>
        </div>
      </aside>

      <section className="psf-auth-panel">
        <div className="psf-auth-card">
          <div className="psf-auth-brand-mobile">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo-small.svg" alt="超星AI平台" width={28} height={28} style={{ width: 28, height: 28 }} />
            <span>超星AI平台</span>
          </div>

          <h1 className="psf-auth-title">{t("forgot_password")}</h1>
          <p className="psf-auth-subtitle">{t("forgot_password_description")}</p>

          <div className="psf-auth-divider" aria-hidden>
            <span>{t("email")}</span>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="psf-auth-field">
            <label htmlFor="forgot-email">{t("email")}</label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email_placeholder_v2")}
              required
            />
          </div>

          {error ? (
            <p className="psf-auth-error">
              {error}
              {retryAfterSec ? ` (${retryAfterSec}s)` : ""}
            </p>
          ) : null}

          {successMessage ? (
            <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="psf-auth-submit"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 psf-spin" /> : null}
            {submitLabel}
          </button>
        </form>

          <p className="psf-auth-foot">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/login`)}
              className="psf-auth-foot-link"
            >
              {t("back_to_login")}
            </button>
          </p>

          <Link href={`/${locale}`} className="psf-auth-back">
            ← 返回首頁
          </Link>
        </div>
      </section>
    </main>
  );
}
