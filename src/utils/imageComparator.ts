// 画像比較・重複検出ユーティリティ

export interface ImageSimilarity {
  similarity: number; // 0-1の類似度（1が完全一致）
  isDuplicate: boolean; // 重複とみなすかどうか
}

export interface ImageGroup {
  representative: string; // 代表画像のID
  members: string[]; // グループに属する画像ID一覧
  recordingTime: number; // 代表画像の録音時間
}

/**
 * 画像比較クラス
 */
export class ImageComparator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private duplicateThreshold: number;

  constructor(duplicateThreshold: number = 0.95) {
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not supported');
    }
    this.ctx = ctx;
    this.duplicateThreshold = duplicateThreshold;
  }

  /**
   * 2つの画像の類似度を計算
   */
  async compareImages(imageData1: string, imageData2: string): Promise<ImageSimilarity> {
    try {
      const [img1, img2] = await Promise.all([
        this.loadImage(imageData1),
        this.loadImage(imageData2)
      ]);

      // 画像サイズを統一（比較用の小さなサイズに縮小）
      const compareSize = 64; // 64x64で比較（高速化）
      
      const pixels1 = this.getImagePixels(img1, compareSize);
      const pixels2 = this.getImagePixels(img2, compareSize);

      const similarity = this.calculatePixelSimilarity(pixels1, pixels2);
      
      return {
        similarity,
        isDuplicate: similarity >= this.duplicateThreshold
      };
    } catch (error) {
      console.error('画像比較エラー:', error);
      return {
        similarity: 0,
        isDuplicate: false
      };
    }
  }

  /**
   * 画像配列から重複グループを検出
   */
  async detectDuplicateGroups(images: Array<{id: string, imageData: string, recordingTime: number}>): Promise<ImageGroup[]> {
    const groups: ImageGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < images.length; i++) {
      const currentImage = images[i];
      
      if (processed.has(currentImage.id)) {
        continue;
      }

      // 新しいグループを作成
      const group: ImageGroup = {
        representative: currentImage.id,
        members: [currentImage.id],
        recordingTime: currentImage.recordingTime
      };

      processed.add(currentImage.id);

      // 残りの画像と比較
      for (let j = i + 1; j < images.length; j++) {
        const compareImage = images[j];
        
        if (processed.has(compareImage.id)) {
          continue;
        }

        const result = await this.compareImages(currentImage.imageData, compareImage.imageData);
        
        if (result.isDuplicate) {
          group.members.push(compareImage.id);
          processed.add(compareImage.id);
          console.log(`📷 重複検出: ${currentImage.id} ≈ ${compareImage.id} (類似度: ${(result.similarity * 100).toFixed(1)}%)`);
        }
      }

      groups.push(group);
    }

    const duplicateCount = groups.reduce((sum, group) => sum + (group.members.length - 1), 0);
    console.log(`📊 画像グルーピング完了: ${groups.length}グループ (${duplicateCount}枚の重複を検出)`);

    return groups;
  }

  /**
   * Base64画像データからImageオブジェクトを作成
   */
  private loadImage(imageData: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageData;
    });
  }

  /**
   * 画像を指定サイズに縮小してピクセルデータを取得
   */
  private getImagePixels(img: HTMLImageElement, size: number): Uint8ClampedArray {
    this.canvas.width = size;
    this.canvas.height = size;
    
    // アスペクト比を保持して描画
    const aspectRatio = img.width / img.height;
    let drawWidth = size;
    let drawHeight = size;
    let offsetX = 0;
    let offsetY = 0;

    if (aspectRatio > 1) {
      drawHeight = size / aspectRatio;
      offsetY = (size - drawHeight) / 2;
    } else {
      drawWidth = size * aspectRatio;
      offsetX = (size - drawWidth) / 2;
    }

    // キャンバスをクリア
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, size, size);
    
    // 画像を描画
    this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
    
    return this.ctx.getImageData(0, 0, size, size).data;
  }

  /**
   * ピクセル単位の類似度を計算
   */
  private calculatePixelSimilarity(pixels1: Uint8ClampedArray, pixels2: Uint8ClampedArray): number {
    if (pixels1.length !== pixels2.length) {
      return 0;
    }

    let totalDifference = 0;
    const pixelCount = pixels1.length / 4; // RGBA = 4バイト

    for (let i = 0; i < pixels1.length; i += 4) {
      // RGB値の差分を計算（Alphaは無視）
      const rDiff = Math.abs(pixels1[i] - pixels2[i]);
      const gDiff = Math.abs(pixels1[i + 1] - pixels2[i + 1]);
      const bDiff = Math.abs(pixels1[i + 2] - pixels2[i + 2]);
      
      // ユークリッド距離
      const pixelDifference = Math.sqrt(rDiff * rDiff + gDiff * gDiff + bDiff * bDiff);
      totalDifference += pixelDifference;
    }

    // 正規化（0-1の範囲）
    const maxPossibleDifference = pixelCount * Math.sqrt(255 * 255 * 3);
    const normalizedDifference = totalDifference / maxPossibleDifference;
    
    // 類似度に変換（1 - 差分）
    return Math.max(0, 1 - normalizedDifference);
  }

  /**
   * 重複検出閾値を更新
   */
  setDuplicateThreshold(threshold: number): void {
    this.duplicateThreshold = Math.max(0, Math.min(1, threshold));
  }

  /**
   * リソースのクリーンアップ
   */
  cleanup(): void {
    // Canvas要素を削除
    this.canvas.remove();
  }
}

/**
 * 画像グループから分析対象を選定（最大10枚まで）
 */
export const selectImagesForAnalysis = (
  groups: ImageGroup[], 
  maxImages: number = 10
): string[] => {
  // 各グループの代表画像を選択
  let selectedIds = groups.map(group => group.representative);
  
  // 最大数制限を適用
  if (selectedIds.length > maxImages) {
    // 録画時間で均等に分散して選択
    const sortedGroups = groups.sort((a, b) => a.recordingTime - b.recordingTime);
    const interval = sortedGroups.length / maxImages;
    
    const selectedGroups: ImageGroup[] = [];
    for (let i = 0; i < maxImages; i++) {
      const targetIndex = Math.floor(i * interval);
      if (targetIndex < sortedGroups.length) {
        selectedGroups.push(sortedGroups[targetIndex]);
      }
    }
    
    selectedIds = selectedGroups.map(group => group.representative);
  }
  
  console.log(`🎯 分析対象選定: ${groups.length}グループから${selectedIds.length}枚を選択 (最大${maxImages}枚制限)`);
  return selectedIds;
};