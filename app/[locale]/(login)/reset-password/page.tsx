"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

type ResetPasswordResponse = {
  message?: string;
  code?: "WEAK_PASSWORD" | "PASSWORD_MISMATCH" | "INVALID_RESET_TOKEN";
};

export default function ResetPasswordPage() {
  const t = useTranslations("login");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const submitLabel = useMemo(
    () => (isSubmitting ? t("submitting") : t("confirm_reset_password")),
    [isSubmitting, t]
  );

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccessMessage("");

    if (!token) {
      setError(t("reset_password_token_invalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ResetPasswordResponse;

      if (!response.ok) {
        if (data.code === "WEAK_PASSWORD") {
          setError(t("weak_password"));
          return;
        }
        if (data.code === "PASSWORD_MISMATCH") {
          setError(t("password_mismatch"));
          return;
        }
        if (data.code === "INVALID_RESET_TOKEN") {
          setError(t("reset_password_token_invalid"));
          return;
        }
        setError(t("reset_password_failed"));
        return;
      }

      const message = data.message || t("reset_password_success_message");
      setSuccessMessage(message);
      setTimeout(() => {
        router.replace(`/${locale}/login`);
      }, 1200);
    } catch {
      setError(t("reset_password_failed"));
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
          <h2 className="psf-auth-pitch-title">設定新的安全密碼</h2>
          <p className="psf-auth-pitch-sub">
            完成重設後，你可以用新密碼繼續管理作品、模板與 AI 生成任務。
          </p>
          <div className="psf-auth-points">
            <span className="psf-auth-chip">帳號保護</span>
            <span className="psf-auth-chip">自動返回登入</span>
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

          <h1 className="psf-auth-title">{t("reset_password_title")}</h1>
          <p className="psf-auth-subtitle">{t("reset_password_description")}</p>

          <div className="psf-auth-divider" aria-hidden>
            <span>{t("password")}</span>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="psf-auth-field">
            <label htmlFor="new-password">{t("new_password_placeholder")}</label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("new_password_placeholder")}
              required
            />
          </div>

          <div className="psf-auth-field">
            <label htmlFor="confirm-new-password">{t("confirm_new_password_placeholder")}</label>
            <input
              id="confirm-new-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t("confirm_new_password_placeholder")}
              required
            />
          </div>

          {error ? <p className="psf-auth-error">{error}</p> : null}
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
