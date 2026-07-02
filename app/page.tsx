// app/page.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default function RootPage() {
  const headersList = headers();
  const acceptLanguage = headersList.get('accept-language') || '';
  
  let defaultLocale = 'en';
  
  // ✅ 更精確的語言偵測
  if (acceptLanguage.includes('zh-TW') || acceptLanguage.includes('zh-Hant')) {
    defaultLocale = 'zh-TW';
  } else if (acceptLanguage.includes('zh')) {
    // 如果只有 zh 但沒有具體地區，預設為繁體
    defaultLocale = 'zh-TW';
  } else if (acceptLanguage.includes('ja')) {
    defaultLocale = 'ja';
  }
  
  console.log('🔍 Language detection:', { acceptLanguage, defaultLocale });
  redirect(`/${defaultLocale}`);
}
