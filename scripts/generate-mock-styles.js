const fs = require('fs');
const path = require('path');

// 風格模板
const styleTemplates = [
  {
    baseName: "動漫",
    variations: ["可愛", "帥氣", "萌系", "熱血", "治癒", "黑暗", "魔法", "校園", "奇幻", "科幻"],
    category: "cat_anime"
  },
  {
    baseName: "寫實",
    variations: ["人像", "風景", "靜物", "街拍", "建築", "自然", "城市", "鄉村", "海景", "山景"],
    category: "cat_realistic"
  },
  {
    baseName: "藝術",
    variations: ["油畫", "水彩", "素描", "版畫", "雕塑", "裝置", "行為", "概念", "抽象", "具象"],
    category: "cat_artistic"
  },
  {
    baseName: "科幻",
    variations: ["賽博龐克", "蒸汽龐克", "太空", "未來", "機器人", "外星", "時空", "量子", "虛擬", "數位"],
    category: "cat_scifi"
  },
  {
    baseName: "復古",
    variations: ["膠片", "老照片", "懷舊", "復古", "經典", "傳統", "古董", "老式", "懷舊", "復古"],
    category: "cat_vintage"
  },
  {
    baseName: "攝影",
    variations: ["黑白", "彩色", "人像", "風景", "街拍", "紀實", "時尚", "商業", "藝術", "新聞"],
    category: "cat_photography"
  },
  {
    baseName: "現代",
    variations: ["極簡", "抽象", "構成", "幾何", "線條", "色彩", "空間", "光影", "材質", "結構"],
    category: "cat_modern"
  },
  {
    baseName: "文化",
    variations: ["中國風", "日式", "韓式", "歐式", "美式", "印度", "阿拉伯", "非洲", "拉丁", "北歐"],
    category: "cat_cultural"
  },
  {
    baseName: "古典",
    variations: ["巴洛克", "洛可可", "新古典", "浪漫", "印象", "後印象", "野獸", "立體", "表現", "超現實"],
    category: "cat_classical"
  },
  {
    baseName: "都市",
    variations: ["街頭", "塗鴉", "時尚", "商業", "工業", "建築", "交通", "人群", "夜景", "日景"],
    category: "cat_urban"
  }
];

// 工作流程模板
const workflows = [
  "動漫生成", "寫實生成", "藝術生成", "科幻生成", "復古生成", 
  "攝影生成", "現代生成", "文化生成", "古典生成", "都市生成"
];

// 專業的圖片策略：使用純 SVG 佔位符
const imageStrategies = {
  // 策略 1: 使用純色背景 SVG (最安全，推薦)
  solid: (index) => {
    const colors = [
      "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
      "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
    ];
    const color = colors[index % colors.length];
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='${color}'/><text x='150' y='150' text-anchor='middle' dy='.3em' fill='white' font-size='16'>Style ${index + 1}</text></svg>`;
  },
  
  // 策略 2: 使用漸層背景 SVG
  gradient: (index) => {
    const gradients = [
      "from-pink-500 to-purple-500",
      "from-blue-500 to-teal-500", 
      "from-green-500 to-blue-500",
      "from-yellow-500 to-orange-500",
      "from-red-500 to-pink-500"
    ];
    const gradient = gradients[index % gradients.length];
    const [from, to] = gradient.split(' to-');
    return `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><defs><linearGradient id='grad${index}' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' style='stop-color:${from};stop-opacity:1'/><stop offset='100%' style='stop-color:${to};stop-opacity:1'/></linearGradient></defs><rect width='300' height='300' fill='url(#grad${index})'/><text x='150' y='150' text-anchor='middle' dy='.3em' fill='white' font-size='16'>Style ${index + 1}</text></svg>`;
  }
};

// 選擇圖片策略 (簡化為只使用 SVG)
const IMAGE_STRATEGY = 'solid';

// 生成風格數據
function generateStyles() {
  const styles = [];
  let id = 1;

  styleTemplates.forEach((template, templateIndex) => {
    template.variations.forEach((variation, variationIndex) => {
      const styleName = `${variation}${template.baseName}`;
      const imageUrl = imageStrategies[IMAGE_STRATEGY](id - 1);
      const workflow = workflows[templateIndex % workflows.length];
      
      const style = {
        id: `style_${String(id).padStart(3, '0')}`,
        title: styleName,
        value: `${variation.toLowerCase()}_${template.baseName.toLowerCase()}`,
        styleCategories: JSON.stringify([{
          id: template.category,
          name: template.baseName,
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z"
        }]),
        cover: JSON.stringify({
          url: imageUrl,
          alt: styleName
        }),
        description: `${styleName}風格，獨特而富有創意，適合各種創作需求`,
        reference: JSON.stringify([
          {
            url: imageUrl,
            alt: `${styleName}參考1`
          },
          {
            url: imageStrategies[IMAGE_STRATEGY]((id + 50) % 100), // 使用不同的圖片
            alt: `${styleName}參考2`
          }
        ]),
        workflow: JSON.stringify({
          name: workflow,
          version: "1.0"
        }),
        authors: JSON.stringify(["AIERONE Team"]),
        updatedAt: "2024-01-01T00:00:00Z",
        createdAt: "2024-01-01T00:00:00Z"
      };

      styles.push(style);
      id++;
    });
  });

  return styles;
}

// 生成分類數據
function generateCategories() {
  return [
    { id: "cat_anime", name: "動漫", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_realistic", name: "寫實", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_artistic", name: "藝術", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_scifi", name: "科幻", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_vintage", name: "復古", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_photography", name: "攝影", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_modern", name: "現代", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_cultural", name: "文化", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_classical", name: "古典", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
    { id: "cat_urban", name: "都市", createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" }
  ];
}

// 生成完整的 mock 數據
function generateMockData() {
  const styles = generateStyles();
  const categories = generateCategories();

  const mockData = {
    styles: {
      docs: styles,
      totalDocs: styles.length,
      limit: 200,
      totalPages: Math.ceil(styles.length / 200),
      page: 1,
      pagingCounter: 1,
      hasPrevPage: false,
      hasNextPage: styles.length > 200,
      prevPage: null,
      nextPage: styles.length > 200 ? 2 : null
    },
    categories: categories
  };

  return mockData;
}

// 寫入文件
function writeMockData() {
  const mockData = generateMockData();
  const outputPath = path.join(__dirname, '../public/mock-data/styles.json');
  
  // 確保目錄存在
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(mockData, null, 2), 'utf8');
  console.log(`✅ 成功生成 ${mockData.styles.docs.length} 個風格`);
  console.log(`✅ 成功生成 ${mockData.categories.length} 個分類`);
  console.log(`📁 文件已保存到: ${outputPath}`);
  console.log(`🖼️ 使用圖片策略: ${IMAGE_STRATEGY}`);
  console.log(`🌍 環境: ${process.env.NODE_ENV || 'development'}`);
}

// 執行生成
writeMockData(); 