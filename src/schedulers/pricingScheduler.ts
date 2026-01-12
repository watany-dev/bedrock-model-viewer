import * as cron from 'node-cron';
import { BedrockPricingScraper } from '../scrapers/bedrockPricingScraper';
import { PricingStorage } from '../utils/storage';
import { SyncResult } from '../types/pricing';

/**
 * 価格情報を定期的に同期するスケジューラー
 */
export class PricingScheduler {
  private scraper: BedrockPricingScraper;
  private storage: PricingStorage;
  private task: cron.ScheduledTask | null = null;

  constructor() {
    this.scraper = new BedrockPricingScraper();
    this.storage = new PricingStorage();
  }

  /**
   * 価格情報を同期
   */
  async syncPricing(): Promise<SyncResult> {
    const timestamp = new Date().toISOString();
    console.log(`\n========================================`);
    console.log(`価格情報の同期を開始: ${timestamp}`);
    console.log(`========================================\n`);

    try {
      // 価格情報を取得
      const pricingData = await this.scraper.fetchPricing();

      // データを保存
      await this.storage.save(pricingData);

      const result: SyncResult = {
        success: true,
        timestamp,
        modelsCount: pricingData.models.length,
      };

      console.log(`\n========================================`);
      console.log(`同期完了: ${pricingData.models.length} モデル`);
      console.log(`========================================\n`);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`\n========================================`);
      console.error(`同期失敗: ${errorMessage}`);
      console.error(`========================================\n`);

      return {
        success: false,
        timestamp,
        modelsCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * 1日1回のスケジュールを開始
   * デフォルト: 毎日午前2時に実行
   */
  start(cronExpression: string = '0 2 * * *'): void {
    if (this.task) {
      console.log('スケジューラーは既に起動しています');
      return;
    }

    console.log(`スケジューラーを起動: ${cronExpression}`);
    console.log('cron式の説明: 毎日午前2時に実行');

    this.task = cron.schedule(cronExpression, async () => {
      await this.syncPricing();
    });

    // 起動時に一度実行（オプション）
    console.log('起動時に初回同期を実行...');
    this.syncPricing().catch(error => {
      console.error('初回同期でエラーが発生:', error);
    });
  }

  /**
   * スケジューラーを停止
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      console.log('スケジューラーを停止しました');
    }
  }

  /**
   * 更新が必要かチェックして、必要な場合のみ同期
   */
  async syncIfNeeded(): Promise<SyncResult | null> {
    const needsUpdate = await this.storage.needsUpdate();

    if (needsUpdate) {
      console.log('最終更新から24時間以上経過しています。同期を実行します。');
      return await this.syncPricing();
    } else {
      const lastUpdate = await this.storage.getLastUpdateTime();
      console.log(`価格データは最新です（最終更新: ${lastUpdate?.toISOString()}）`);
      return null;
    }
  }
}
