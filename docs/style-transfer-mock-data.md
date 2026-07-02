# 風格轉換 Mock 數據系統

## 概述

這個系統提供了完整的風格轉換功能，包括 100+ 種風格的 mock 數據，用於在後端 API 尚未完成時進行前端開發和測試。

## 業界最佳實踐

### 🎯 **Mock 數據策略**

#### 1. **圖片處理策略**
```javascript
// 純 SVG 佔位符策略，無需外部依賴
const imageStrategies = {
  // 純色背景 SVG (最安全，推薦)
  solid: (index) => `data:image/svg+xml,<svg>...</svg>`,
  
  // 漸層背景 SVG
  gradient: (index) => `data:image/svg+xml,<svg>...</svg>`
};
```

#### 2. **簡化架構**
- **無需 API 路由**: 直接使用 JSON 文件
- **無需外部圖片**: 使用 SVG data URL
- **無需域名配置**: 完全自包含
- **無需網路請求**: 本地載入

#### 3. **環境感知**
- **開發環境**: 使用 SVG 佔位符，完全自包含
- **測試環境**: 使用 SVG 佔位符，確保可控性
- **生產環境**: 後端串接時直接替換 API 端點

### 🔧 **技術實現**

#### 1. **純 SVG 佔位符**
```typescript
// 直接在生成腳本中創建 SVG
const svgUrl = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>
  <rect width='300' height='300' fill='${color}'/>
  <text x='150' y='150' text-anchor='middle' dy='.3em' fill='white' font-size='16'>
    Style ${index + 1}
  </text>
</svg>`;
```

#### 2. **智能後備機制**
```typescript
// 自動後備策略
try {
  const response = await fetch('/api/style-switch/search', ...);
  // 使用真實 API
} catch (error) {
  // 自動使用 mock 數據
  const mockData = await fetch('/mock-data/styles.json');
  // 處理 mock 數據
}
```

## 文件結構

```
public/mock-data/
└── styles.json          # 100+ 風格的 mock 數據

scripts/
└── generate-mock-styles.js  # 生成 mock 數據的腳本

app/components/
├── StyleSelection/      # 風格選擇組件
├── DrawerSelector/      # 通用抽屜選擇器
├── StyleDialog/         # 風格詳情對話框
└── ImageEditor/tools/
    └── StyleTransfer.tsx # 風格轉換主組件

app/services/
└── styleSwitcherApi.ts  # 風格轉換 API 服務

public/locales/
├── zh-TW/styles.json    # 繁體中文翻譯
└── en/styles.json       # 英文翻譯
```

## Mock 數據內容

### 風格分類 (10 個)
- **動漫** (cat_anime): 可愛、帥氣、萌系、熱血等 10 種變體
- **寫實** (cat_realistic): 人像、風景、靜物等 10 種變體
- **藝術** (cat_artistic): 油畫、水彩、素描等 10 種變體
- **科幻** (cat_scifi): 賽博龐克、蒸汽龐克等 10 種變體
- **復古** (cat_vintage): 膠片、老照片等 10 種變體
- **攝影** (cat_photography): 黑白、彩色等 10 種變體
- **現代** (cat_modern): 極簡、抽象等 10 種變體
- **文化** (cat_cultural): 中國風、日式等 10 種變體
- **古典** (cat_classical): 巴洛克、洛可可等 10 種變體
- **都市** (cat_urban): 街頭、塗鴉等 10 種變體

**總計: 100 種風格**

### 數據結構

每個風格包含以下字段：
```json
{
  "id": "style_001",
  "title": "可愛動漫",
  "value": "可愛_動漫",
  "styleCategories": "[{\"id\":\"cat_anime\",\"name\":\"動漫\"}]",
  "cover": "{\"url\":\"圖片URL\",\"alt\":\"可愛動漫\"}",
  "description": "可愛動漫風格，獨特而富有創意，適合各種創作需求",
  "reference": "[{\"url\":\"參考圖片1\"},{\"url\":\"參考圖片2\"}]",
  "workflow": "{\"name\":\"動漫生成\",\"version\":\"1.0\"}",
  "authors": "[\"AIERONE Team\"]",
  "updatedAt": "2024-01-01T00:00:00Z",
  "createdAt": "2024-01-01T00:00:00Z"
}
```

## 使用方法

### 1. 生成 Mock 數據

```bash
# 運行生成腳本
node scripts/generate-mock-styles.js

# 輸出示例：
# ✅ 成功生成 100 個風格
# ✅ 成功生成 10 個分類
# 🖼️ 使用圖片策略: solid
# 🌍 環境: development
```

### 2. 在組件中使用

StyleSelection 組件會自動在 API 失敗時使用 mock 數據：

```typescript
// 自動後備機制
try {
  const response = await fetch('/api/style-switch/search', ...);
  // 處理 API 響應
} catch (error) {
  // 自動使用 mock 數據
  const mockResponse = await fetch('/mock-data/styles.json');
  const mockData = await mockResponse.json();
  // 處理 mock 數據
}
```

### 3. 測試風格選擇功能

1. 打開風格轉換工具
2. 點擊「選擇風格」按鈕
3. 在風格選擇器中瀏覽 100+ 種風格
4. 使用分類篩選和搜尋功能
5. 查看風格詳情
6. 調整強度並套用風格

## 功能特性

### ✅ 已實現功能
- **100+ 風格展示**: 涵蓋各種藝術風格和類型
- **分類篩選**: 10 個主要分類，支援多選
- **搜尋功能**: 支援風格名稱和描述搜尋
- **無限滾動**: 分頁載入，效能優化
- **響應式設計**: 支援手機版和桌面版
- **雙視圖模式**: 網格和列表檢視
- **風格詳情**: 完整的風格資訊展示
- **強度調整**: 可調整風格化程度
- **國際化**: 支援繁體中文和英文
- **錯誤處理**: API 失敗時自動使用 mock 數據
- **圖片策略**: 多種圖片策略，環境感知

### 🔄 與現有系統整合
- **與模型選擇同構**: 使用相同的組件架構和邏輯
- **狀態管理**: 整合 AuthContext 進行用戶設定管理
- **API 格式一致**: 與現有模型 API 完全對齊
- **UI 風格統一**: 使用相同的設計語言和組件

## 後端 API 對齊

當後端 API 完成後，只需要：

1. 實現 `/api/style-switch/search` 端點
2. 實現 `/api/style-switch/categories/{lng}` 端點
3. 實現 `/user/settings/style` 端點

前端代碼無需修改，會自動切換到真實 API。

## 開發建議

### 1. 擴展風格
修改 `scripts/generate-mock-styles.js` 中的模板：

```javascript
const styleTemplates = [
  {
    baseName: "新分類",
    variations: ["變體1", "變體2", "變體3"],
    category: "cat_new"
  }
];
```

### 2. 自定義圖片策略
修改 `imageStrategies` 對象：

```javascript
const imageStrategies = {
  // 添加新的圖片策略
  custom: (index) => `https://your-domain.com/style-${index}.jpg`,
  
  // 或修改現有策略
  cdn: (index) => `https://your-cdn.com/placeholder/style-${index}.jpg`,
};
```

### 3. 環境配置
設置環境變數來控制圖片策略：

```bash
# .env.local
NEXT_PUBLIC_IMAGE_STRATEGY=solid  # solid, local, cdn, unsplash
```

## 故障排除

### 常見問題

1. **圖片無法顯示**
   - 檢查 Next.js 配置中的域名設置
   - 確認圖片策略是否正確
   - 查看瀏覽器開發者工具的錯誤訊息

2. **Mock 數據無法載入**
   - 檢查 `public/mock-data/styles.json` 是否存在
   - 確認文件格式正確
   - 查看 Network 標籤中的請求

3. **分類篩選不工作**
   - 檢查分類數據格式
   - 確認 JSON 解析正確
   - 查看 Console 中的錯誤訊息

### 調試技巧

1. 打開瀏覽器開發者工具
2. 查看 Network 標籤中的請求
3. 檢查 Console 中的錯誤訊息
4. 確認 mock 數據載入成功
5. 檢查圖片策略是否正確

### 圖片策略調試

```javascript
// 在瀏覽器 Console 中測試
fetch('/mock-data/styles.json')
  .then(res => res.json())
  .then(data => {
    console.log('圖片策略:', data.styles.docs[0].cover);
  });
```

## 業界最佳實踐總結

### ✅ **正確做法**
- 使用純 SVG 佔位符，完全自包含
- 直接使用 JSON 文件，無需 API 路由
- 實現智能後備機制
- 保持資料格式一致性
- 簡化架構，減少複雜性

### ❌ **避免做法**
- 創建不必要的 API 路由
- 使用外部圖片服務增加依賴
- 硬編碼圖片路徑
- 不提供後備機制
- 在開發環境使用生產依賴

## 未來擴展

- [ ] 添加更多風格分類
- [ ] 支援風格預覽功能
- [ ] 添加風格評分系統
- [ ] 支援用戶自定義風格
- [ ] 添加風格收藏功能
- [ ] 支援批量風格處理
- [ ] 實現圖片懶加載
- [ ] 添加圖片壓縮和優化 

## 問題修正記錄

### 2024-01-XX: 網格視圖分類顯示問題

#### 問題描述
- 網格視圖中分類標籤消失，列表視圖正常
- 資料邏輯不一致導致顯示問題

#### 根本原因
1. **資料結構不一致**: `parseStyleCategories` 函數將字串格式的分類名稱轉換為物件格式
2. **顯示邏輯不統一**: 網格和列表視圖使用不同的分類名稱顯示邏輯
3. **狀態管理缺失**: StyleDialog 中的 `isTagsExpanded` 狀態未定義

#### 修正方案
1. **統一資料處理**:
   ```typescript
   // 修正前
   name: typeof cat.name === "string" ? { [lng]: cat.name } : cat.name,
   
   // 修正後
   name: cat.name, // 保持原始格式，不進行轉換
   ```

2. **統一顯示邏輯**:
   ```typescript
   // 使用統一的 getCategoryName 函數
   {getCategoryName(category)}
   ```

3. **增強 getCategoryName 函數**:
   ```typescript
   const getCategoryName = useCallback((category: Category): string => {
     // 如果是字串，直接返回
     if (typeof category.name === "string") {
       return category.name;
     }
     
     // 如果是物件，嘗試獲取當前語系的名稱
     if (typeof category.name === "object" && category.name !== null) {
       if (category.name[lng]) {
         return category.name[lng];
       }
       // 後備邏輯...
     }
     
     return category.id || "Unknown Category";
   }, [lng]);
   ```

4. **修正狀態管理**:
   ```typescript
   const [isTagsExpanded, setIsTagsExpanded] = useState(false);
   ```

#### 測試結果
- ✅ 網格視圖分類標籤正常顯示
- ✅ 列表視圖分類標籤正常顯示
- ✅ 分類篩選功能正常
- ✅ 風格詳情對話框正常

#### 經驗教訓
1. **資料一致性**: 確保資料處理邏輯在整個應用中保持一致
2. **統一顯示邏輯**: 使用統一的工具函數處理顯示邏輯
3. **狀態管理**: 確保所有組件的狀態都正確定義
4. **測試覆蓋**: 在不同視圖模式下測試功能完整性 