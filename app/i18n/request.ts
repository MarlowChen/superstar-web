// i18n/request.ts
import {getRequestConfig} from 'next-intl/server';
import { messagesByLocale, type SupportedLocale } from './messages';

const debugI18n = process.env.NEXT_PUBLIC_DEBUG_I18N === 'true';
const supportedLocales: SupportedLocale[] = ['en', 'zh-TW', 'ja'];

const isSupportedLocale = (locale: string): locale is SupportedLocale =>
  supportedLocales.includes(locale as SupportedLocale);

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale;
  
  // 🔧 語言映射和回退邏輯
  let locale: SupportedLocale = 'en'; // 默認語言
  
  if (requestedLocale) {
    if (isSupportedLocale(requestedLocale)) {
      locale = requestedLocale;
    } else if (requestedLocale.startsWith('zh')) {
      // 處理中文變體 (zh-CN, zh-HK 等) 都映射到 zh-TW
      locale = 'zh-TW';
    } else if (requestedLocale.startsWith('ja')) {
      locale = 'ja';
    }
  }
  
  if (debugI18n) {
    console.info('Locale resolved', {
      requestedLocale,
      resolvedLocale: locale,
      supportedLocales
    });
  }
  
  try {
    return {
      locale,
      messages: messagesByLocale[locale]
    };
  } catch (error) {
    console.error('❌ Error loading messages:', error);

    return {
      locale: 'en',
      messages: messagesByLocale.en
    };
  }
});
