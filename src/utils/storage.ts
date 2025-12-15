import * as fs from 'fs/promises';
import * as path from 'path';
import { PricingData } from '../types/pricing';

/**
 * 価格データの保存と読み込みを管理
 */
export class PricingStorage {
  private readonly dataDir: string;
  private readonly pricingFile: string;

  constructor(dataDir: string = path.join(process.cwd(), 'data')) {
    this.dataDir = dataDir;
    this.pricingFile = path.join(dataDir, 'pricing.json');
  }

  /**
   * 価格データを保存
   */
  async save(data: PricingData): Promise<void> {
    try {
      // データディレクトリが存在しない場合は作成
      await fs.mkdir(this.dataDir, { recursive: true });

      // データをJSON形式で保存
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(this.pricingFile, jsonData, 'utf-8');

      console.log(`価格データを保存しました: ${this.pricingFile}`);
      console.log(`モデル数: ${data.models.length}`);
      console.log(`最終更新: ${data.lastUpdated}`);
    } catch (error) {
      console.error('価格データの保存に失敗:', error);
      throw new Error(`価格データの保存に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 価格データを読み込み
   */
  async load(): Promise<PricingData | null> {
    try {
      const data = await fs.readFile(this.pricingFile, 'utf-8');
      const pricingData: PricingData = JSON.parse(data);
      console.log(`価格データを読み込みました: ${this.pricingFile}`);
      return pricingData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        console.log('価格データファイルが見つかりません');
        return null;
      }
      console.error('価格データの読み込みに失敗:', error);
      throw error;
    }
  }

  /**
   * 最終更新日時を取得
   */
  async getLastUpdateTime(): Promise<Date | null> {
    const data = await this.load();
    if (!data) return null;
    return new Date(data.lastUpdated);
  }

  /**
   * 更新が必要かチェック（最終更新から24時間以上経過しているか）
   */
  async needsUpdate(): Promise<boolean> {
    const lastUpdate = await this.getLastUpdateTime();
    if (!lastUpdate) return true;

    const now = new Date();
    const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

    return hoursSinceUpdate >= 24;
  }
}
