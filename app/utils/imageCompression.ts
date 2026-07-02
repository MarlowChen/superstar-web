export interface CompressionOptions {
  maxSizeMB?: number;        // 最大檔案大小 (MB)
  maxWidth?: number;         // 最大寬度
  maxHeight?: number;        // 最大高度
  quality?: number;          // 壓縮品質 (0.1-1.0)
  format?: 'jpeg' | 'png' | 'webp'; // 輸出格式
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  width: number;
  height: number;
}

/**
 * 圖片壓縮工具類
 */
export class ImageCompressor {
  private static readonly DEFAULT_OPTIONS: CompressionOptions = {
    maxSizeMB: 1,           // 預設 1MB 限制
    maxWidth: 1920,         // 最大寬度 1920px
    maxHeight: 1080,        // 最大高度 1080px
    quality: 0.8,           // 預設品質 80%
    format: 'jpeg'          // 預設格式 JPEG
  };

  /**
   * 壓縮圖片
   */
  static async compressImage(
    file: File, 
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    
    // 檢查檔案類型
    if (!file.type.startsWith('image/')) {
      throw new Error('只支援圖片檔案格式');
    }

    // 檢查檔案大小並給出警告
    const maxSizeBytes = (opts.maxSizeMB || 1) * 1024 * 1024;
    const fileSizeMB = file.size / 1024 / 1024;
    
    if (fileSizeMB > 50) {
      throw new Error(`檔案過大 (${fileSizeMB.toFixed(1)}MB)，建議選擇 50MB 以下的圖片`);
    }
    
    if (fileSizeMB > 20) {
      console.warn(`大檔案警告: ${fileSizeMB.toFixed(1)}MB，處理時間可能較長`);
    }
    
    if (file.size > maxSizeBytes) {
      console.warn(`檔案大小 ${fileSizeMB.toFixed(2)}MB 超過限制 ${opts.maxSizeMB}MB，將進行壓縮`);
    }

    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        try {
          // 計算新的尺寸
          const { width, height } = this.calculateDimensions(
            img.width, 
            img.height, 
            opts.maxWidth!, 
            opts.maxHeight!
          );

          // 設置 canvas 尺寸
          canvas.width = width;
          canvas.height = height;

          // 繪製圖片
          ctx!.drawImage(img, 0, 0, width, height);

          // 轉換為 blob
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('圖片壓縮失敗'));
                return;
              }

              // 檢查壓縮後的大小
              if (blob.size > maxSizeBytes) {
                // 如果還是太大，進一步降低品質
                this.compressWithLowerQuality(canvas, opts, maxSizeBytes)
                  .then(resolve)
                  .catch(reject);
                return;
              }

              // 創建新的 File 物件
              const compressedFile = new File([blob], file.name, {
                type: this.getMimeType(opts.format!),
                lastModified: Date.now()
              });

              resolve({
                file: compressedFile,
                originalSize: file.size,
                compressedSize: blob.size,
                compressionRatio: (1 - blob.size / file.size) * 100,
                width,
                height
              });
            },
            this.getMimeType(opts.format!),
            opts.quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('圖片載入失敗'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * 計算壓縮後的尺寸
   */
  private static calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };

    // 如果寬度超過限制
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }

    // 如果高度超過限制
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
  }

  /**
   * 使用更低品質進行壓縮
   */
  private static async compressWithLowerQuality(
    canvas: HTMLCanvasElement,
    options: CompressionOptions,
    maxSizeBytes: number
  ): Promise<CompressionResult> {
    const qualities = [0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
    
    for (const quality of qualities) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, this.getMimeType(options.format!), quality);
      });

      if (blob && blob.size <= maxSizeBytes) {
        const compressedFile = new File([blob], 'compressed-image.jpg', {
          type: this.getMimeType(options.format!),
          lastModified: Date.now()
        });

        return {
          file: compressedFile,
          originalSize: 0, // 這裡需要原始大小，暫時設為 0
          compressedSize: blob.size,
          compressionRatio: 0, // 需要原始大小才能計算
          width: canvas.width,
          height: canvas.height
        };
      }
    }

    throw new Error('無法將圖片壓縮到指定大小限制內');
  }

  /**
   * 獲取 MIME 類型
   */
  private static getMimeType(format: string): string {
    switch (format) {
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  /**
   * 驗證檔案大小
   */
  static validateFileSize(file: File, maxSizeMB: number = 1): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }

  /**
   * 檢查檔案是否過大（超過 50MB）
   */
  static isFileTooLarge(file: File, maxSizeMB: number = 50): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size > maxSizeBytes;
  }

  /**
   * 獲取檔案大小建議
   */
  static getFileSizeRecommendation(file: File): string {
    const fileSizeMB = file.size / 1024 / 1024;
    
    if (fileSizeMB > 50) {
      return `檔案過大 (${fileSizeMB.toFixed(1)}MB)，建議選擇 50MB 以下的圖片`;
    } else if (fileSizeMB > 20) {
      return `檔案較大 (${fileSizeMB.toFixed(1)}MB)，處理時間可能較長`;
    } else if (fileSizeMB > 1) {
      return `檔案大小 (${fileSizeMB.toFixed(1)}MB) 超過 1MB 限制，將自動壓縮`;
    } else {
      return `檔案大小合適 (${fileSizeMB.toFixed(2)}MB)`;
    }
  }

  /**
   * 獲取檔案大小的人類可讀格式
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 預覽圖片（用於上傳前預覽）
   */
  static async createPreview(file: File, maxWidth: number = 300): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        const { width, height } = this.calculateDimensions(
          img.width, 
          img.height, 
          maxWidth, 
          maxWidth * (img.height / img.width)
        );

        canvas.width = width;
        canvas.height = height;
        ctx!.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };

      img.onerror = () => reject(new Error('圖片預覽生成失敗'));
      img.src = URL.createObjectURL(file);
    });
  }
}
