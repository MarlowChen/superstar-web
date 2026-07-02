"use client";

import { FormEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";

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
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SERVER_URL || "https://api.superstar-ai.xyz"}/auth/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            token,
            password,
            confirmPassword,
          }),
        }
      );

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
    <div className="min-h-screen bg-gradient-to-br from-custom-logo-purple to-custom-light-purple flex items-center justify-center p-4">
      <div className="bg-custom-white dark:bg-custom-black rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-center text-custom-black dark:text-custom-white mb-2">
          {t("reset_password_title")}
        </h1>
        <p className="text-center text-custom-black dark:text-custom-light-purple mb-6">
          {t("reset_password_description")}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("new_password_placeholder")}
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-custom-black dark:text-custom-white outline-none focus:border-custom-logo-purple"
            required
          />

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("confirm_new_password_placeholder")}
            className="w-full rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-black px-4 py-3 text-custom-black dark:text-custom-white outline-none focus:border-custom-logo-purple"
            required
          />

          {error ? <p className="text-sm text-red-500">{error}</p> : null}
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
