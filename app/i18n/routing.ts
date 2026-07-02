// i18n/routing.ts
import {defineRouting} from 'next-intl/routing';

export const routing = defineRouting({
  // 支援的語言列表（對應你原本的配置）
  locales: ['zh-TW', 'en', 'ja'],
  
  // 預設語言
  defaultLocale: 'en',
  
  // 可選：語言前綴配置
  localePrefix: 'always' // 或 'as-needed'
});