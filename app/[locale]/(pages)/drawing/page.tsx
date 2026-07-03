
// Home.tsx - 主頁組件
import { GalleryProvider } from "../../../components/Drawing/contexts/GalleryContext";
import GalleryContent from "@/app/components/GalleryContent";
import { getPageMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";
import UpgradePopupProvider from "../../../components/UpgradePopupAd/UpgradePopupProvider";


type DrawingPageProps = {
  params: { locale: string };
  searchParams?: {
    tool?: string;
    templatePrompt?: string;
    templateType?: "image" | "video" | "audio" | "text" | "chat";
    templateAspectRatio?: string;
    templateCount?: string;
    modelId?: string;
    selectedImageUrl?: string;
  };
};


export function generateMetadata({ params }: DrawingPageProps): Metadata {
  return getPageMetadata(params.locale, 'drawing');
}

function sanitizeTemplatePrompt(value?: string) {
  const prompt = (value || "").trim();
  if (!prompt) return "";
  const normalized = prompt.toLowerCase();
  if (
    normalized.startsWith("conversation summary") ||
    normalized.includes("conversation summary指出") ||
    normalized.startsWith("conversation summary 指出")
  ) {
    return "";
  }
  return prompt;
}

function getToolTemplate(tool?: string): {
  type: "image" | "video" | "audio" | "text" | "chat" | null;
  prompt: string;
} {
  const normalized = (tool || "").trim().toLowerCase();

  if (!normalized) {
    return { type: null, prompt: "" };
  }

  if (normalized === "image") {
    return { type: "image", prompt: "" };
  }

  if (normalized === "video") {
    return { type: "video", prompt: "" };
  }

  if (normalized === "audio" || normalized === "voice" || normalized === "sound") {
    return { type: "audio", prompt: "" };
  }

  if (normalized === "text" || normalized === "copywriting" || normalized === "script") {
    return { type: "text", prompt: "" };
  }

  if (normalized === "chat") {
    return { type: "chat", prompt: "" };
  }

  if (
    normalized === "lipsync" ||
    normalized === "lip-sync" ||
    normalized === "avatar" ||
    normalized === "face-swap" ||
    normalized === "faceswap"
  ) {
    return {
      type: "video",
      prompt: "我想製作一段 AI 對嘴或數位人影片，請幫我整理需要的素材與生成提示。",
    };
  }

  return { type: null, prompt: "" };
}

export default async function DrawingPage({ searchParams }: DrawingPageProps) {
  const toolTemplate = getToolTemplate(searchParams?.tool);
  const templatePrompt =
    sanitizeTemplatePrompt(searchParams?.templatePrompt) || toolTemplate.prompt;
  const templateType = searchParams?.templateType || toolTemplate.type;
  const initialTemplate =
    templatePrompt ||
    templateType ||
    searchParams?.templateAspectRatio ||
    searchParams?.templateCount ||
    searchParams?.modelId ||
    searchParams?.selectedImageUrl
      ? {
          prompt: templatePrompt,
          type: templateType || null,
          aspectRatio: searchParams?.templateAspectRatio || "1:1",
          count: Number(searchParams?.templateCount) || 1,
          modelId: searchParams?.modelId || "",
          selectedImageUrl: searchParams?.selectedImageUrl || "",
        }
      : undefined;

  return (
    <UpgradePopupProvider>
      <GalleryProvider>
        <GalleryContent initialTemplate={initialTemplate} />
      </GalleryProvider>
    </UpgradePopupProvider>
  );
}
