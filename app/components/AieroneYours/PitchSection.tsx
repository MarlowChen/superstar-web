"use client";
import React from "react";
import { useTranslations } from "next-intl";

/**
 * PitchSection — 多語系版本
 * 支援：繁體中文 (zh-TW)、英文 (en)、日文 (ja)
 */
export default function PitchSection() {
  const t = useTranslations("pitch");

  return (
    <section
      aria-labelledby="pitch-title"
      className="w-full max-w-6xl mx-auto px-6 py-10"
    >
      <div className="space-y-6 leading-8 text-[15px] text-slate-200">

        {/* 主標題 */}
        <h1
          id="pitch-title"
          className="text-2xl md:text-3xl font-bold text-white"
        >
          {t("title")}
        </h1>

        {/* 導入段落 */}
        <p>{t("intro_p1")}</p>
        <p>{t("intro_p2")}</p>
        <p>{t("intro_p3")}</p>

        {/* 三大負債 */}
        <p>{t("liabilities_intro")}</p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>{t("liability_1")}</li>
          <li>{t("liability_2")}</li>
          <li>{t("liability_3")}</li>
        </ol>

        {/* 使命宣言 */}
        <p>{t("mission")}</p>

        {/* 價值支柱 I */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          {t("pillar_1_title")}
        </h2>
        <p>{t("pillar_1_intro")}</p>

        <ol className="list-decimal pl-6 space-y-3">
          <li>{t("pillar_1_point_1")}</li>
          <li>{t("pillar_1_point_2")}</li>
          <li>{t("pillar_1_point_3")}</li>
        </ol>

        {/* 價值支柱 II */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          {t("pillar_2_title")}
        </h2>
        <p>{t("pillar_2_intro")}</p>

        {/* 三欄清單 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/60 p-4">
            <div className="text-white font-semibold mb-2">
              {t("workflow_automation_title")}
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("workflow_automation_1")}</li>
              <li>{t("workflow_automation_2")}</li>
              <li>{t("workflow_automation_3")}</li>
            </ul>
          </div>
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/60 p-4">
            <div className="text-white font-semibold mb-2">
              {t("workflow_integration_title")}
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("workflow_integration_1")}</li>
              <li>{t("workflow_integration_2")}</li>
              <li>{t("workflow_integration_3")}</li>
            </ul>
          </div>
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/60 p-4">
            <div className="text-white font-semibold mb-2">
              {t("workflow_quality_title")}
            </div>
            <ul className="list-disc pl-5 space-y-1">
              <li>{t("workflow_quality_1")}</li>
              <li>{t("workflow_quality_2")}</li>
              <li>{t("workflow_quality_3")}</li>
            </ul>
          </div>
        </div>

        {/* 價值支柱 III */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          {t("pillar_3_title")}
        </h2>
        <ol className="list-decimal pl-6 space-y-3">
          <li>{t("pillar_3_point_1")}</li>
          <li>{t("pillar_3_point_2")}</li>
        </ol>

        {/* 模型種類 */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          {t("model_types_title")}
        </h2>
        <ol className="list-decimal pl-6 space-y-3">
          <li>{t("model_type_1")}</li>
          <li>{t("model_type_2")}</li>
          <li>{t("model_type_3")}</li>
          <li>{t("model_type_4")}</li>
          <li>{t("model_type_5")}</li>
        </ol>

        {/* 護城河段落 */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          {t("moat_title")}
        </h2>
        <p>{t("moat_p1")}</p>
        <p>{t("moat_p2")}</p>
        <p>{t("moat_p3")}</p>
        <p>{t("moat_p4")}</p>
        <p>{t("moat_p5")}</p>
        <p>{t("moat_p6")}</p>
      </div>
    </section>
  );
}