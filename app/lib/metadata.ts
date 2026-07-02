// utils/metadata.ts
import { Metadata } from 'next';

// 不同頁面的 Metadata
const pageMetadata: Record<string, Record<string, Record<string, string>>> = {
  'zh-TW': {
    login: {
      title: '登入 | 超星AI平台',
      description: '登入您的超星AI平台帳戶，開始使用 AI 生成與創作服務',
      keywords: '超星AI平台,登入,帳戶,AI,服務,AI繪圖',
    },
    home: {
      title: '超星AI平台 - AI 創作平台',
      description: '超星AI平台提供整合式 AI 生成與創作服務，讓您快速完成圖片、影片、音訊與文字內容',
      keywords: '超星AI平台,AI繪圖,AI生成圖片,人工智能,圖像生成,AI平台',
    },
    drawing: {
      title: '開始創作 | 超星AI平台',
      description: '使用超星AI平台的 AI 創作功能，輸入文字或上傳素材即可快速生成內容',
      keywords: '超星AI平台,AI繪圖,文字生成圖片,AI藝術創作,圖像生成',
    },
    models: {
      title: '模型庫 | 超星AI平台',
      description: '超星AI平台提供多種 AI 模型，支援不同風格與用途的內容生成',
      keywords: '超星AI平台,AI模型,繪圖模型,AI小模型,風格模型,圖像生成',
    },
    library: {
      title: '我的圖庫 | 超星AI平台',
      description: '查看您在超星AI平台生成的所有內容，管理您的創作歷史',
      keywords: '超星AI平台,我的圖庫,AI圖片,創作歷史,AI藝術作品',
    },
    edited: {
      title: '圖片編輯 | 超星AI平台',
      description: '查看和管理您在超星AI平台編輯過的圖片，保存您的創意作品',
      keywords: '超星AI平台,圖片編輯,創意作品,AI圖片編輯',
    },
    templates: {
      title: '模板區 | 超星AI平台',
      description: '瀏覽超星AI平台的圖片與影片模板，快速開始生成流程',
      keywords: '超星AI平台,模板,圖片模板,影片模板,AI生成',
    },
  },
  'en': {
    login: {
      title: 'Login | HyperStar AI Platform',
      description: 'Login to your HyperStar AI Platform account to start creating with AI.',
      keywords: 'HyperStar AI Platform,login,account,AI,services,AI image generation',
    },
    home: {
      title: 'HyperStar AI Platform - AI Creative Platform',
      description: 'HyperStar AI Platform helps you create images, video, audio, and text with an integrated AI workflow.',
      keywords: 'HyperStar AI Platform,AI drawing,AI generated images,artificial intelligence,image generation',
    },
    drawing: {
      title: 'Start Creating | HyperStar AI Platform',
      description: 'Create content with HyperStar AI Platform using prompts or uploaded media.',
      keywords: 'HyperStar AI Platform,AI drawing,text-to-image,AI art creation,image generation',
    },
    models: {
      title: 'Model Gallery | HyperStar AI Platform',
      description: 'Browse AI models on HyperStar AI Platform for different styles and generation workflows.',
      keywords: 'HyperStar AI Platform,AI models,drawing models,style models,image generation',
    },
    library: {
      title: 'My Library | HyperStar AI Platform',
      description: 'View your generated content and manage your creation history on HyperStar AI Platform.',
      keywords: 'HyperStar AI Platform,my library,AI images,creation history,AI artwork',
    },
    edited: {
      title: 'Edited Images | HyperStar AI Platform',
      description: 'View and manage your edited images on HyperStar AI Platform.',
      keywords: 'HyperStar AI Platform,edited images,image editing,creative works,AI image editing',
    },
    templates: {
      title: 'Templates | HyperStar AI Platform',
      description: 'Browse image and video templates on HyperStar AI Platform.',
      keywords: 'HyperStar AI Platform,templates,image templates,video templates,AI generation',
    },
  },
  'ja': {
    login: {
      title: 'ログイン | 超星AIプラットフォーム',
      description: '超星AIプラットフォームにログインして、AI生成機能を使い始めましょう',
      keywords: '超星AIプラットフォーム,ログイン,アカウント,AI,サービス,AI画像生成',
    },
    home: {
      title: '超星AIプラットフォーム - AI クリエイティブプラットフォーム',
      description: '超星AIプラットフォームは、画像・動画・音声・テキスト生成を一つの流れで行えるAI創作サービスです',
      keywords: '超星AIプラットフォーム,AI描画,AI生成画像,人工知能,画像生成',
    },
    drawing: {
      title: '作成開始 | 超星AIプラットフォーム',
      description: '超星AIプラットフォームで、テキストや素材からすばやくコンテンツを生成できます',
      keywords: '超星AIプラットフォーム,AI描画,テキストから画像,AIアート作成,画像生成',
    },
    models: {
      title: 'モデルギャラリー | 超星AIプラットフォーム',
      description: '超星AIプラットフォームでは、用途別にさまざまなAIモデルを利用できます',
      keywords: '超星AIプラットフォーム,AIモデル,描画モデル,スタイルモデル,画像生成',
    },
    library: {
      title: 'マイライブラリー | 超星AIプラットフォーム',
      description: '超星AIプラットフォームで生成したコンテンツと制作履歴を確認できます',
      keywords: '超星AIプラットフォーム,マイライブラリー,AI画像,創作履歴,AIアートワーク',
    },
    edited: {
      title: '編集済み画像 | 超星AIプラットフォーム',
      description: '超星AIプラットフォームで編集した画像を管理・保存できます',
      keywords: '超星AIプラットフォーム,編集済み画像,画像編集,クリエイティブ作品,AI画像編集',
    },
    templates: {
      title: 'テンプレート | 超星AIプラットフォーム',
      description: '超星AIプラットフォームの画像・動画テンプレートを閲覧できます',
      keywords: '超星AIプラットフォーム,テンプレート,画像テンプレート,動画テンプレート,AI生成',
    },
  },
};

// 頁面路徑映射
const pagePathMap: Record<string, string> = {
  'home': '', // 首頁不需要額外路徑
  'login': 'login',
  'drawing': 'drawing',
  'models': 'models',
  'library': 'library',
  'edited': 'edited',
  'templates': 'templates',
};

// 有效頁面和語言列表
const validPages = ['home', 'login', 'drawing', 'models', 'library', 'edited', 'templates'];
const validLanguages = ['en', 'zh-TW', 'ja'];

// 獲取指定頁面的 Metadata
export function getPageMetadata(lang: string, page: string): Metadata {
  // 確保語言有效，否則使用預設語言
  const safeLanguage = validLanguages.includes(lang) ? lang : 'en';
  
  // 確保頁面有效，如果無效則使用首頁
  const safePage = validPages.includes(page) ? page : 'home';
  
  // 獲取頁面元數據
  const pageMeta = pageMetadata[safeLanguage][safePage];
  
  // 獲取頁面路徑
  const pagePath = pagePathMap[safePage];
  
  // 構建完整 URL
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  const fullUrl = `${baseUrl}/${safeLanguage}${pagePath ? `/${pagePath}` : ''}`;
  
  return {
    title: pageMeta.title,
    description: pageMeta.description,
    keywords: pageMeta.keywords.split(','),
    alternates: {
      canonical: fullUrl,
      languages: {
        'zh-TW': `${baseUrl}/zh-TW${pagePath ? `/${pagePath}` : ''}`,
        'en': `${baseUrl}/en${pagePath ? `/${pagePath}` : ''}`,
        'ja': `${baseUrl}/ja${pagePath ? `/${pagePath}` : ''}`,
      },
    },
    openGraph: {
      title: pageMeta.title,
      description: pageMeta.description,
      url: fullUrl,
      siteName: '超星AI平台',
      locale: safeLanguage === 'zh-TW' ? 'zh_TW' : safeLanguage === 'ja' ? 'ja_JP' : 'en_US',
      type: 'website',
      images: [
        {
          url: `${process.env.NEXT_PUBLIC_URL}/images/home.jpg`,
          // url: `${baseUrl}/images/psf-og-default.jpg`, // 暫時使用統一圖片
          width: 1200,
          height: 630,
          alt: pageMeta.title,
          type: 'image/jpeg',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: pageMeta.title,
      description: pageMeta.description,
      // images: [`${baseUrl}/images/psf-og-default.jpg`],
      images: [`${process.env.NEXT_PUBLIC_URL}/images/home.jpg`],
    },
  };
}

// 輔助函數：檢查頁面是否有效
export function isValidPage(page: string): boolean {
  return validPages.includes(page);
}

// 輔助函數：檢查語言是否有效
export function isValidLanguage(lang: string): boolean {
  return validLanguages.includes(lang);
}

// 輔助函數：獲取所有有效頁面
export function getValidPages(): string[] {
  return validPages;
}

// 輔助函數：獲取所有有效語言
export function getValidLanguages(): string[] {
  return validLanguages;
}
