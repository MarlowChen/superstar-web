"use client";
import React from "react";

/**
 * PitchSection — 文案完全照原稿，不增不減
 * - 僅做語義化標記與排版優化（不影響文字內容）
 * - 手機到桌機皆易讀（行寬/行距/段落間距）
 */
export default function PitchSection() {
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
          Hondolab Yours：為您打造專屬AI模型與數位資產
        </h1>

        {/* 導入段落 */}
        <p>
          AI生成的浪潮已然來臨，但它也帶來一個根本性困境：您是在建立「資產」還是在積累「負債」？
        </p>
        <p>
          當您的團隊將珍貴的原創角色、創作手稿、品牌設計上傳至ChatGPT、Midjourney等通用模型時，您就是在用自己最寶貴的數據，去訓練一個不屬於您、不受您控制的「公共大腦」。
        </p>
        <p>
          一旦進入這些通用大模型，您的原創內容就是別人的訓練資料。這不是協作，這是數位資產的單向流失。
        </p>

        {/* 三大負債 */}
        <p>通用大模型是「公共廣場」，它們帶來三大負債：</p>
        <ol className="list-decimal pl-6 space-y-1">
          <li>IP 負債： 您的數據被「吞噬與消化」，資產歸屬變得模糊。</li>
          <li>風格負債： 您的品牌視覺與風格特色被「AI平均感」稀釋，失去獨特性。</li>
          <li>流程負債： 您的團隊被迫適應AI工具的僵化流程，而非相反。</li>
        </ol>

        {/* 使命宣言 */}
        <p>
          Hondolab Yours 的使命，是將您的「AI負債」轉化為「專有AI資產」。我們不提供SaaS服務，我們為您鑄造專屬於您的數位資產。
        </p>

        {/* 價值支柱 I */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          價值支柱 I：絕對的資產安全與主權
        </h2>
        <p>您的原創內容，永遠是您的。我們透過「本地部署」與「數據隔離」兩大策略，確保您的資產主權。</p>

        <ol className="list-decimal pl-6 space-y-3">
          <li>
            本地部署與主權： 您的數據與原創素材無需上網。我們開發的特殊訓練策略（QAT量化技術），能將您的專屬模型改造至極致，使其能輕易在一部Nvidia RTX 3060的消費級筆電上順暢運行。這實現了完全離線操作，徹底杜絕竊取風險，這是大型通用模型無法做到的。
          </li>
          <li>
            數據隔離與純淨： 您的創意與需求不再受制於通用大模型的規範與限制。OpenAI等巨頭會將所有數據混在一起訓練，造成數據污染與風格干擾。Hondolab Yours 採用LoRA、強化學習（RL）、監督微調（SFT）等技術，為您的角色、場景、物件、功能打造獨立專屬的小模型，確保數據純淨，風格一致。
          </li>
          <li>
            資產防護與舉證： 由於您保有原始訓練數據與本地模型，未來若有著作權爭議，您能輕易舉證。此外，我們生成的圖像因數據結構已高度重組，極難再次成為訓練數據被他人竊取學習或訓練。
          </li>
        </ol>

        {/* 價值支柱 II */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          價值支柱 II：無縫的客製化工作流程
        </h2>
        <p>
          我們讓AI適應您的流程，而非您適應AI。通用大模型是「航空母艦」，轉彎困難；您的專屬模型是「飛彈快艇」，精準靈活。我們透過「客製化工作流程節點」，讓AI無縫嵌入您現有的生產管線：
        </p>

        {/* 三欄清單：原文用項目符號，這裡僅做視覺分組，不改字句 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/60 p-4">
            <div className="text-white font-semibold mb-2">自動化處理：</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>自動添加公司Logo或浮水印</li>
              <li>強制輸出特定版權聲明</li>
              <li>自動調整為企業規範的尺寸、格式（如CMYK）</li>
            </ul>
          </div>
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/60 p-4">
            <div className="text-white font-semibold mb-2">流程整合：</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>串接現有的設計審核流程</li>
              <li>與內部資產管理系統整合</li>
              <li>批次處理與自動化排程</li>
            </ul>
          </div>
          <div className="rounded-xl bg-slate-900/40 border border-slate-700/60 p-4">
            <div className="text-white font-semibold mb-2">品質控管：</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>自動過濾不符品牌規範的生成結果</li>
              <li>敏感內容檢測與攔截</li>
              <li>風格一致性驗證</li>
            </ul>
          </div>
        </div>

        {/* 價值支柱 III */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          價值支柱 III：極致的數據與模型效能
        </h2>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            數據煉金術（核心門檻）： 我們能處理您混亂複雜的原始數據。透過全面的數據清洗與優化（去模糊、智能標註、物件完整度保留等），在相同數據量下，我們的模型表現遠超對手。這是多數客戶無法自行處理的關鍵技術。
          </li>
          <li>
            可進化的模型（活資產）： 您的模型是「活的」。如同遊戲角色，它可以不斷吸收新數據，從10等成長到100等。我們會為您挑選最合適的基底模型進行微調與附體，讓模型隨您的需求不斷進化，建立他人難以超越的競爭壁壘。
          </li>
        </ol>

        {/* 模型種類 */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          我們提供的客製化模型種類
        </h2>
        <ol className="list-decimal pl-6 space-y-3">
          <li>
            風格轉移：學習並致敬您喜愛的創作風格與特色，在不侵害他人著作權的前提下，享受創作的自由與樂趣。
          </li>
          <li>
            超級融合：這是進階版的風格轉移，但將開創不同風格相互融合而產生全新驚艷效果的新境界，讓您的創作與生成體驗提升到前所未見的更高層次。
          </li>
          <li>
            專案訂製：以您的專業領域所需要的功能與特色為基礎，再根據您的特殊需求來調整，打造出最適合您的專屬模型。
          </li>
          <li>
            原創孿生：您的最佳AI分身，協助您創作出猶如您親手繪製的角色與場景，更重要的是，永遠不嫌累，擁有無窮盡的新創意。
          </li>
          <li>
            R18 & NSFW：您知道的，就是只可意會不可言傳的那種模型，只屬於您，不便外傳的那種。
          </li>
        </ol>

        {/* 護城河段落 */}
        <h2 className="mt-6 text-xl md:text-2xl font-semibold text-white">
          您的AI護城河 — AI圖像生成界的台積電
        </h2>
        <p>
          我們正處於一個關鍵的十字路口。您可以選擇繼續將您最寶貴的創意資產，餵養給ChatGPT、Midjourney這些「公共大腦」，祈禱它們不會反噬您。或者，您可以做出戰略性的選擇：建立您自己的「私有大腦」。
        </p>
        <p>
          Hondolab Yours 的定位，就是成為AI圖像生成界的TSMC。我們不自己設計晶片（基底模型），但我們擁有最獨特的「製造工藝」。
        </p>
        <p>
          我們採用最先進的開源模型，用我們獨有的數據清洗、訓練策略和工作流整合技術，為您「代工」出一顆顆體積微小、效能強大、且完全客製化的「AI晶片」（您的專屬模型）。
        </p>
        <p>
          這顆晶片（Hondolab 模型），只為您服務，也可只在您的設備上運行，只屬於您專有。
        </p>
        <p>這就是Hondolab Yours為您打造的專屬數位資產。</p>
        <p>這就是您在AI時代中，最強大且不可撼動的護城河。</p>
      </div>
    </section>
  );
}
