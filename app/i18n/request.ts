// i18n/request.ts
import {getRequestConfig} from 'next-intl/server';
import fs from 'fs';
import path from 'path';

const debugI18n = process.env.NEXT_PUBLIC_DEBUG_I18N === 'true';

export default getRequestConfig(async ({requestLocale}) => {
  const requestedLocale = await requestLocale;
  
  // 🔧 修正：統一語言代碼
  const supportedLocales = ['en', 'zh-TW', 'ja'];
  
  // 🔧 語言映射和回退邏輯
  let locale = 'en'; // 默認語言
  
  if (requestedLocale) {
    if (supportedLocales.includes(requestedLocale)) {
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
    const messages: Record<string, unknown> = {};
    const localeDir = path.join(process.cwd(), 'public', 'locales', locale);
    
    if (debugI18n) {
      console.info('Looking for locale dir', { localeDir });
    }
    
    if (fs.existsSync(localeDir)) {
      const files = fs.readdirSync(localeDir);
      if (debugI18n) {
        console.info('Locale files found', { locale, files });
      }
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const namespace = file.replace('.json', '');
          const filePath = path.join(localeDir, file);
          
          try {
            const content = fs.readFileSync(filePath, 'utf8');
            messages[namespace] = JSON.parse(content);
            // console.log(`✅ Loaded ${namespace} for ${locale}`);
          } catch (parseError) {
            console.error(`❌ Error parsing ${file}:`, parseError);
          }
        }
      }
    } else {
      console.warn(`⚠️ Locale directory not found: ${localeDir}`);
      
      // 回退到英文
      const fallbackDir = path.join(process.cwd(), 'public', 'locales', 'en');
      if (fs.existsSync(fallbackDir)) {
        const files = fs.readdirSync(fallbackDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const namespace = file.replace('.json', '');
            const filePath = path.join(fallbackDir, file);
            const content = fs.readFileSync(filePath, 'utf8');
            messages[namespace] = JSON.parse(content);
          }
        }
        if (debugI18n) {
          console.info('Fallback to English messages loaded');
        }
      }
    }
    
    // console.log('📦 Final messages structure:', Object.keys(messages));
    
    return {
      locale,
      messages
    };
  } catch (error) {
    console.error('❌ Error loading messages:', error);
    
    // 完全回退
    return {
      locale: 'en',
      messages: {
        // 提供基本的回退消息
        common: {
          error: 'Failed to load translations'
        }
      }
    };
  }
});
