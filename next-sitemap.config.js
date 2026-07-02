// next-sitemap.config.js
// 🔥 修正：手動指定動態路由路徑

/** @type {import('next-sitemap').IConfig} */
module.exports = {
    siteUrl: process.env.NEXT_PUBLIC_URL,
    generateRobotsTxt: true,
    generateIndexSitemap: false,
    
    // 排除所有動態路由，用 additionalPaths 手動處理
    exclude: [
      '/api/*',
      '/_next/*',
      '/[locale]',
      '/[locale]/*',
    ],
    
    // 🔥 手動指定所有路徑（因為都是動態路由）
    additionalPaths: async (config) => {
      const locales = ['en', 'zh-TW']
      const pages = [
        { path: '', changefreq: 'daily', priority: 1.0 },
        { path: '/login', changefreq: 'monthly', priority: 0.5 },
        { path: '/drawing', changefreq: 'weekly', priority: 0.9 },
        { path: '/models', changefreq: 'weekly', priority: 0.8 },
        { path: '/library', changefreq: 'daily', priority: 0.8 },
        { path: '/collecting', changefreq: 'weekly', priority: 0.7 },
        { path: '/privacy-policy', changefreq: 'yearly', priority: 0.3 },
      ]
      
      const paths = []
      
      locales.forEach(locale => {
        pages.forEach(page => {
          paths.push({
            loc: `/${locale}${page.path}`,
            changefreq: page.changefreq,
            priority: page.priority,
            lastmod: new Date().toISOString(),
          })
        })
      })
      
      return paths
    },
    
    // robots.txt 設定
    robotsTxtOptions: {
      policies: [
        {
          userAgent: '*',
          allow: '/',
          disallow: ['/api/', '/_next/'],
        },
      ],
    },
  }