/**
 * 圖片下載輔助函數
 * 針對 iOS Safari 優化，支援直接保存到相簿
 */

/**
 * 檢測是否為 iOS 設備
 */
export function isIOSDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
}

/**
 * 檢測環境並輸出診斷訊息
 * 用於開發調試
 */
export function diagnoseShareAPI(): {
  isIOS: boolean;
  hasShareAPI: boolean;
  hasCanShare: boolean;
  canShareFiles: boolean;
  userAgent: string;
} {
  if (typeof window === 'undefined') {
    return {
      isIOS: false,
      hasShareAPI: false,
      hasCanShare: false,
      canShareFiles: false,
      userAgent: 'Server Side',
    };
  }

  const isIOS = isIOSDevice();
  const hasShareAPI = 'share' in navigator;
  const hasCanShare = 'canShare' in navigator;
  
  let canShareFiles = false;
  if (hasCanShare) {
    try {
      const testFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      canShareFiles = navigator.canShare({ files: [testFile] });
    } catch (e) {
      canShareFiles = false;
    }
  }

  const result = {
    isIOS,
    hasShareAPI,
    hasCanShare,
    canShareFiles,
    userAgent: navigator.userAgent,
  };

  // 在開發環境輸出診斷訊息
  if (process.env.NODE_ENV === 'development') {
    console.group('📱 Web Share API 診斷');
    console.log('iOS 設備:', isIOS ? '✅ 是' : '❌ 否');
    console.log('支援 navigator.share:', hasShareAPI ? '✅' : '❌');
    console.log('支援 navigator.canShare:', hasCanShare ? '✅' : '❌');
    console.log('支援文件分享:', canShareFiles ? '✅ (iOS 15+)' : '❌');
    console.log('User Agent:', navigator.userAgent);
    console.groupEnd();
  }

  return result;
}

/**
 * 檢測是否支援 Web Share API Level 2 (可分享文件)
 */
export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'share' in navigator && 'canShare' in navigator;
}

async function fetchImageBlob(imageUrl: string): Promise<Blob> {
  const fetchDirect = async () => {
    const response = await fetch(imageUrl, {
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) throw new Error(`Failed to fetch image ${response.status}`);
    return await response.blob();
  };

  try {
    return await fetchDirect();
  } catch (directError) {
    const proxyUrl = `/api/download-image?url=${encodeURIComponent(imageUrl)}`;
    const response = await fetch(proxyUrl, {
      credentials: "include",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) {
      throw directError instanceof Error
        ? directError
        : new Error("Failed to fetch image");
    }
    return await response.blob();
  }
}

/**
 * 通用圖片下載函數
 * iOS Safari: 使用 Web Share API 讓用戶可選擇保存到相簿
 * 其他瀏覽器: 使用傳統的 download 屬性
 */
export async function downloadImage(
  imageUrl: string,
  fileName: string = `AI-Generated-${Date.now()}.jpg`
): Promise<{ success: boolean; method: 'share' | 'download' | 'fallback' }> {
  try {
    // 1. 獲取圖片
    const blob = await fetchImageBlob(imageUrl);

    // 2. iOS 設備且支援 Web Share API - 使用分享功能
    if (isIOSDevice() && canShareFiles()) {
      try {
        // 創建 File 對象
        const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
        
        // 檢查是否可以分享此文件
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '下載圖片',
            text: '保存 AI 生成的圖片'
          });
          
          return { success: true, method: 'share' };
        }
      } catch (shareError) {
        // 如果分享被取消或失敗，繼續使用備用方法
        console.log('Web Share API 失敗，使用備用方法:', shareError);
      }
    }

    // 3. 傳統下載方法（其他瀏覽器或 Web Share API 不可用）
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    
    // 對於 iOS，即使 download 屬性不完全支援，也會在新標籤頁打開圖片
    // 用戶可以長按保存
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 延遲釋放 URL，確保下載開始
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);

    return { success: true, method: 'download' };
    
  } catch (error) {
    console.error('Download failed:', error);
    
    // 4. 最後備用方案：直接在新視窗打開圖片
    try {
      window.open(imageUrl, '_blank');
      return { success: true, method: 'fallback' };
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError);
      return { success: false, method: 'fallback' };
    }
  }
}

/**
 * 從 Canvas 下載圖片
 * iOS Safari: 使用 Web Share API
 * 其他瀏覽器: 使用傳統下載
 */
export async function downloadImageFromCanvas(
  canvas: HTMLCanvasElement,
  fileName: string = `AI-Generated-${Date.now()}.jpg`,
  quality: number = 0.95
): Promise<{ success: boolean; method: 'share' | 'download' | 'fallback' }> {
  try {
    // 將 canvas 轉換為 blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error('Canvas to blob failed'));
        },
        'image/jpeg',
        quality
      );
    });

    // iOS 設備且支援 Web Share API
    if (isIOSDevice() && canShareFiles()) {
      try {
        const file = new File([blob], fileName, { type: 'image/jpeg' });
        
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: '下載圖片',
            text: '保存 AI 生成的圖片'
          });
          
          return { success: true, method: 'share' };
        }
      } catch (shareError) {
        console.log('Web Share API 失敗，使用備用方法:', shareError);
      }
    }

    // 傳統下載方法
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);

    return { success: true, method: 'download' };
    
  } catch (error) {
    console.error('Canvas download failed:', error);
    return { success: false, method: 'fallback' };
  }
}

/**
 * 批次下載多張圖片為 ZIP
 * 注意：iOS Safari 上建議一張一張分享，因為 ZIP 文件無法直接保存到相簿
 */
export async function downloadImagesAsZip(
  images: Array<{ url: string; fileName: string }>,
  zipFileName: string
): Promise<boolean> {
  try {
    // 動態導入 JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // 下載所有圖片並加入 ZIP
    const promises = images.map(async (img) => {
      const blob = await fetchImageBlob(img.url);
      zip.file(img.fileName, blob);
    });
    
    await Promise.all(promises);
    
    // 生成 ZIP 文件
    const content = await zip.generateAsync({ type: 'blob' });
    const blobUrl = URL.createObjectURL(content);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 100);
    
    return true;
  } catch (error) {
    console.error('ZIP download failed:', error);
    return false;
  }
}
