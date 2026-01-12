#!/usr/bin/env node

import { PricingScheduler } from './schedulers/pricingScheduler';

/**
 * 手動で価格情報を同期するスクリプト
 * 使用方法: npm run sync
 */
async function main() {
  console.log('===========================================');
  console.log('AWS Bedrock 価格情報 - 手動同期');
  console.log('===========================================\n');

  const scheduler = new PricingScheduler();

  // コマンドライン引数をチェック
  const args = process.argv.slice(2);
  const forceSync = args.includes('--force');

  if (forceSync) {
    console.log('強制同期モード: 最終更新時刻に関わらず同期を実行します\n');
    const result = await scheduler.syncPricing();

    if (result.success) {
      console.log(`\n✓ 同期成功`);
      console.log(`  モデル数: ${result.modelsCount}`);
      console.log(`  タイムスタンプ: ${result.timestamp}`);
      process.exit(0);
    } else {
      console.error(`\n✗ 同期失敗: ${result.error}`);
      process.exit(1);
    }
  } else {
    console.log('通常同期モード: 24時間以上経過している場合のみ同期します\n');
    const result = await scheduler.syncIfNeeded();

    if (result === null) {
      console.log('\n✓ 同期は不要です（データは最新）');
      process.exit(0);
    } else if (result.success) {
      console.log(`\n✓ 同期成功`);
      console.log(`  モデル数: ${result.modelsCount}`);
      console.log(`  タイムスタンプ: ${result.timestamp}`);
      process.exit(0);
    } else {
      console.error(`\n✗ 同期失敗: ${result.error}`);
      process.exit(1);
    }
  }
}

main().catch(error => {
  console.error('エラーが発生しました:', error);
  process.exit(1);
});
