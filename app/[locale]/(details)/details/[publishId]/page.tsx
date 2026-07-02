// app/[locale]/(details)/details/[publishId]/page.tsx
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import SharePageClient from './SharePageClient';

interface SharePageData {
  prompt: string;
  generatedPrompt: string;
  publicImageId:string;
  modelTitle: string;
  shortId: string;
  imageUrl: string;
  taskId: string;
  createdAt?: string;
}

// 獲取分享資料的伺服器端函數
async function getShareData(publishId: string): Promise<SharePageData | null> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SERVER_URL}/details/${publishId}`,
      { 
        cache: 'no-store', // 確保獲取最新數據
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();

    // 正確提取 data 部分
    if (result?.success && result?.data) {
      return result.data;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to fetch share data:', error);
    return null;
  }
}

// 生成動態 Metadata
export async function generateMetadata({ 
  params 
}: { 
  params: { publishId: string; locale: 'en' | 'zh-TW' } 
}): Promise<Metadata> {

  // 使用 next-intl 的 getTranslations 在伺服器端獲取翻譯
  const t = await getTranslations({ locale: params.locale, namespace: 'library' });
  const shareData = await getShareData(params.publishId);
  
  if (!shareData) {
    return {
      title: t('sharePageTitle') || 'AI 生成圖片分享',
      description: t('errorMessage') || '無法載入分享內容',
    };
  }

  const title = `${t('aiGeneratedImage') || 'AI 生成圖片'} - ${shareData.prompt}`;
  const description = `${t('shareDescription') || '使用 AI 技術生成的精美圖片'}：${shareData.prompt}`;
  const siteName = t('siteName') || 'AI 圖片生成器';
  
  return {
    title,
    description,
    keywords: `AI, ${t('imageGeneration') || '圖片生成'}, ${shareData.prompt}, ${t('artificialIntelligence') || '人工智能'}, ${t('creativeDesign') || '創意設計'}`,
    authors: [{ name: siteName }],
    robots: 'index, follow, max-image-preview:large',
    
    // Open Graph
    openGraph: {
      type: 'article',
      title,
      description,
      images: [
        {
          url: shareData.imageUrl, // 直接使用原始 URL
          width: 1200,
          height: 1200,
          alt: shareData.prompt,
          type: 'image/jpeg',
        }
      ],
      siteName,
      locale: params.locale === 'zh-TW' ? 'zh_TW' : 'en_US',
    },
    
    // Twitter
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [shareData.imageUrl], // 直接使用原始 URL
    },
    
    // 其他 meta 標籤
    other: {
      'og:image:secure_url': shareData.imageUrl,
      'og:image:type': 'image/jpeg',
      'og:image:alt': shareData.prompt,
    },
  };
}

// 主要頁面組件
export default async function SharePage({ 
  params 
}: { 
  params: { publishId: string; locale: 'en' | 'zh-TW' } 
}) {
  const shareData = await getShareData(params.publishId);
  
  return <SharePageClient initialData={shareData} publishId={params.publishId} />;
}