
// Home.tsx - 主頁組件
import { GalleryProvider } from "../../../components/Drawing/contexts/GalleryContext";
import GalleryContent from "@/app/components/GalleryContent";
import { getPageMetadata } from "@/app/lib/metadata";
import { Metadata } from "next";
import UpgradePopupProvider from "../../../components/UpgradePopupAd/UpgradePopupProvider";


type DrawingPageProps = {
  params: { locale: string };
  searchParams?: {
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

export default async function DrawingPage({ searchParams }: DrawingPageProps) {
  const templatePrompt = sanitizeTemplatePrompt(searchParams?.templatePrompt);
  const initialTemplate =
    templatePrompt ||
    searchParams?.templateType ||
    searchParams?.templateAspectRatio ||
    searchParams?.templateCount ||
    searchParams?.modelId ||
    searchParams?.selectedImageUrl
      ? {
          prompt: templatePrompt,
          type: searchParams?.templateType || null,
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
