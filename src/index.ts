#!/usr/bin/env node

import { PricingScheduler } from './schedulers/pricingScheduler';

/**
 * メインエントリーポイント
 * 価格情報の定期同期を開始
 */
async function main() {
  console.log('===========================================');
  console.log('AWS Bedrock Model Viewer - 価格同期サービス');
  console.log('===========================================\n');

  const scheduler = new PricingScheduler();

  // スケジューラーを開始（毎日午前2時に実行）
  // cron式: '0 2 * * *' = 毎日午前2時
  scheduler.start('0 2 * * *');

  // Ctrl+Cでの終了をハンドル
  process.on('SIGINT', () => {
    console.log('\n終了シグナルを受信しました...');
    scheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n終了シグナルを受信しました...');
    scheduler.stop();
    process.exit(0);
  });

  console.log('サービスが起動しました。Ctrl+C で終了できます。\n');
}

// エラーハンドリング
main().catch(error => {
  console.error('致命的なエラーが発生しました:', error);
  process.exit(1);
});
