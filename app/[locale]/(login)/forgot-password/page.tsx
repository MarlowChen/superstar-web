"use client";

import { FormEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL || "https://api.superstar-ai.xyz"}/auth/forgot-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email: email.trim() }),
        }
      );

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
    <div className="min-h-screen bg-gradient-to-br from-custom-logo-purple to-custom-light-purple flex items-center justify-center p-4">
      <div className="bg-custom-white dark:bg-custom-black rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-custom-black dark:text-custom-white mb-2">
          {t("forgot_password")}
        </h1>
        <p className="text-center text-custom-black dark:text-custom-light-purple mb-6">
          {t("forgot_password_description")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("email_placeholder_v2")}
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-custom-black dark:text-custom-white outline-none focus:border-custom-logo-purple"
            required
          />

          {error ? (
            <p className="text-sm text-red-500">
              {error}
              {retryAfterSec ? ` (${retryAfterSec}s)` : ""}
            </p>
          ) : null}

          {successMessage ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {successMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-custom-logo-purple py-3 px-4 font-medium text-white transition hover:bg-custom-logo-purple-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>

        <button
          type="button"
          onClick={() => router.push(`/${locale}/login`)}
          className="mt-5 w-full text-sm font-medium text-custom-logo-purple transition hover:opacity-80"
        >
          {t("back_to_login")}
        </button>
      </div>
    </div>
  );
}
