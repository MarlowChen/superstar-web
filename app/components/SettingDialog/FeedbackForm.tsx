import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/app/context/AuthContext";
import { MessageSquare, Send, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface FeedbackFormProps {
  onSuccess?: () => void;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ onSuccess }) => {
  const t = useTranslations("settings.feedback");
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    content: "",
    category: "",
  });
  
  const [errors, setErrors] = useState<{
    content?: string;
    category?: string;
  }>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"success" | "error" | null>(null);
  const [submitMessage, setSubmitMessage] = useState("");

  // 回饋分類選項
  const categories = [
    { value: "bug", label: t("categories.bug") },
    { value: "feature", label: t("categories.feature") },
    { value: "experience", label: t("categories.experience") },
    { value: "optimization", label: t("categories.optimization") },
    { value: "other", label: t("categories.other") },
  ];

  // 驗證表單
  const validateForm = (): boolean => {
    const newErrors: typeof errors = {};

    if (!formData.content.trim()) {
      newErrors.content = t("validation.content_required");
    } else if (formData.content.trim().length < 10) {
      newErrors.content = t("validation.content_min_length");
    } else if (formData.content.trim().length > 2000) {
      newErrors.content = t("validation.content_max_length");
    }

    if (!formData.category) {
      newErrors.category = t("validation.category_required");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 處理表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 檢查用戶是否登入
    if (!user) {
      setSubmitStatus("error");
      setSubmitMessage(t("validation.login_required"));
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);
    setSubmitMessage("");

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          userId: user.id,
          username: user.name || user.email,
          email: user.email,
          content: formData.content.trim(),
          category: formData.category,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || t("submit_error"));
      }

      // 成功提交
      setSubmitStatus("success");
      setSubmitMessage(t("submit_success"));
      
      // 重置表單
      setFormData({ content: "", category: "" });
      setErrors({});
      
      // 3秒後清除成功訊息
      setTimeout(() => {
        setSubmitStatus(null);
        setSubmitMessage("");
      }, 3000);

      // 調用成功回調
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("提交回饋失敗:", error);
      setSubmitStatus("error");
      setSubmitMessage(
        error instanceof Error ? error.message : t("submit_error")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 如果用戶未登入，顯示提示訊息
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 bg-custom-light-purple dark:bg-custom-light-purple-dark rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-custom-black dark:text-custom-black-dark mb-2">
          {t("login_required_title")}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-md">
          {t("login_required_message")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 表單標題 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-custom-logo-purple/10 dark:bg-custom-logo-purple-dark/10 rounded-lg flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-custom-logo-purple dark:text-custom-logo-purple-dark" />
          </div>
          <h2 className="text-xl font-bold text-custom-black dark:text-custom-black-dark">
            {t("title")}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t("description")}
        </p>
      </div>

      {/* 用戶資訊卡片 */}
      <div className="bg-custom-gray dark:bg-custom-gray-dark rounded-xl p-4 mb-6 border border-custom-light-purple dark:border-custom-light-purple-dark">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-custom-logo-purple dark:bg-custom-logo-purple-dark rounded-full flex items-center justify-center">
            <span className="text-custom-white text-sm font-medium">
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-custom-black dark:text-custom-black-dark">
              {user.name || t("user_info.username")}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        </div>
      </div>

      {/* 表單 */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 回饋分類 */}
        <div>
          <label
            htmlFor="category"
            className="block text-sm font-medium text-custom-black dark:text-custom-black-dark mb-2"
          >
            {t("form.category")}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <select
            id="category"
            value={formData.category}
            onChange={(e) => {
              setFormData({ ...formData, category: e.target.value });
              if (errors.category) {
                setErrors({ ...errors, category: undefined });
              }
            }}
            className={`w-full px-4 py-3 bg-custom-white dark:bg-custom-white-dark border rounded-lg transition-colors duration-200 ${
              errors.category
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-custom-light-purple dark:border-custom-light-purple-dark focus:border-custom-logo-purple dark:focus:border-custom-logo-purple-dark focus:ring-2 focus:ring-custom-logo-purple/20 dark:focus:ring-custom-logo-purple-dark/20"
            } text-custom-black dark:text-custom-black-dark outline-none`}
          >
            <option value="">{t("form.category_placeholder")}</option>
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          {errors.category && (
            <p className="mt-1 text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.category}
            </p>
          )}
        </div>

        {/* 回饋內容 */}
        <div>
          <label
            htmlFor="content"
            className="block text-sm font-medium text-custom-black dark:text-custom-black-dark mb-2"
          >
            {t("form.content")}
            <span className="text-red-500 ml-1">*</span>
          </label>
          <textarea
            id="content"
            value={formData.content}
            onChange={(e) => {
              setFormData({ ...formData, content: e.target.value });
              if (errors.content) {
                setErrors({ ...errors, content: undefined });
              }
            }}
            rows={8}
            maxLength={2000}
            placeholder={t("form.content_placeholder")}
            className={`w-full px-4 py-3 bg-custom-white dark:bg-custom-white-dark border rounded-lg transition-colors duration-200 resize-none ${
              errors.content
                ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                : "border-custom-light-purple dark:border-custom-light-purple-dark focus:border-custom-logo-purple dark:focus:border-custom-logo-purple-dark focus:ring-2 focus:ring-custom-logo-purple/20 dark:focus:ring-custom-logo-purple-dark/20"
            } text-custom-black dark:text-custom-black-dark placeholder-gray-400 dark:placeholder-gray-500 outline-none`}
          />
          <div className="flex items-center justify-between mt-1">
            {errors.content ? (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.content}
              </p>
            ) : (
              <div />
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formData.content.length}/2000
            </p>
          </div>
        </div>

        {/* 提交狀態訊息 */}
        {submitStatus && (
          <div
            className={`flex items-center gap-2 p-4 rounded-lg ${
              submitStatus === "success"
                ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                : "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
            }`}
          >
            {submitStatus === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
            )}
            <p
              className={`text-sm ${
                submitStatus === "success"
                  ? "text-green-700 dark:text-green-300"
                  : "text-red-700 dark:text-red-300"
              }`}
            >
              {submitMessage}
            </p>
          </div>
        )}

        {/* 提交按鈕 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-custom-logo-purple hover:bg-custom-logo-purple-hover dark:bg-custom-logo-purple-dark dark:hover:bg-custom-logo-purple-hover-dark text-custom-white rounded-lg font-medium transition-colors duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>{t("form.submitting")}</span>
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              <span>{t("form.submit")}</span>
            </>
          )}
        </button>
      </form>

      {/* 提示資訊 */}
      <div className="mt-6 p-4 bg-custom-gray dark:bg-custom-gray-dark rounded-lg border border-custom-light-purple dark:border-custom-light-purple-dark">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {t("form.note")}
        </p>
      </div>
    </div>
  );
};

export default FeedbackForm;
