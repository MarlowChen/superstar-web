// app/[locale]/(details)/details/[publishId]/page.tsx
import { Metadata } from "next";
import { AuthProvider } from "@/app/context/AuthContext";
import { getMeUser } from "@/app/utilities/getUser";
import PSFYoursPage from "@/app/components/AieroneYours/AieroneYours";

// === 固定設定 ===
const SITE_NAME = "PSF Yours";
const PAGE_TITLE = "PSF Yours";
const PREVIEW_URL =
  "https://psf.nyc3.cdn.digitaloceanspaces.com/psf-yours.png";

// 生成 Metadata（單純固定）
export async function generateMetadata({
  params,
}: {
  params: { publishId: string; locale: "en" | "zh-TW" };
}): Promise<Metadata> {
  const locale = params?.locale === "zh-TW" ? "zh_TW" : "en_US";

  return {
    title: PAGE_TITLE,
    description: PAGE_TITLE, // 單句也可當描述，乾淨
    robots: "index, follow, max-image-preview:large",
    openGraph: {
      type: "website",
      title: PAGE_TITLE,
      description: PAGE_TITLE,
      siteName: SITE_NAME,
      locale,
      images: [
        {
          url: PREVIEW_URL,
          width: 1200,
          height: 630, // 推薦比例 1.91:1
          alt: PAGE_TITLE,
          type: "image/jpeg",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: PAGE_TITLE,
      description: PAGE_TITLE,
      images: [PREVIEW_URL],
    },
    other: {
      "og:image": PREVIEW_URL,
      "og:image:secure_url": PREVIEW_URL,
      "og:image:width": "1200",
      "og:image:height": "630",
      "og:image:type": "image/jpeg",
      "og:image:alt": PAGE_TITLE,
    },
  };
}

// 主要頁面（純 Hero）
export default async function HerosPage() {
  const initialUser = await getMeUser();

  return (
    <AuthProvider initialUser={initialUser.user}>
      <PSFYoursPage />
    </AuthProvider>
  );
}
