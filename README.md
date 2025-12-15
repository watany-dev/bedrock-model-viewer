# AWS Bedrock Model Viewer

AWS Bedrockの最新モデル価格情報を自動的に取得・管理するシステムです。

## 概要

このプロジェクトは、AWS Bedrockの公式価格ページ（https://aws.amazon.com/jp/bedrock/pricing/）から価格情報を取得し、1日1回自動的に更新します。

## 主な機能

- **自動価格同期**: 1日1回（デフォルト: 午前2時）に自動実行
- **手動同期**: コマンドラインから即座に同期を実行
- **スマート更新**: 最終更新から24時間以上経過した場合のみ同期
- **JSONデータ保存**: 取得した価格情報をJSON形式で保存

## ディレクトリ構成

```
bedrock-model-viewer/
├── src/
│   ├── index.ts              # メインエントリーポイント（スケジューラー起動）
│   ├── sync.ts               # 手動同期スクリプト
│   ├── types/
│   │   └── pricing.ts        # 型定義
│   ├── scrapers/
│   │   └── bedrockPricingScraper.ts  # 価格情報取得
│   ├── schedulers/
│   │   └── pricingScheduler.ts       # スケジューラー
│   └── utils/
│       └── storage.ts        # データ保存・読み込み
├── data/
│   └── pricing.json          # 価格データ（自動生成）
├── package.json
├── tsconfig.json
└── README.md
```

## セットアップ

### 必要要件

- Node.js 18.x 以上
- npm または yarn

### インストール

```bash
# 依存関係をインストール
npm install

# TypeScriptをビルド
npm run build
```

## 使い方

### 1. 定期同期サービスの起動

スケジューラーを起動して、1日1回自動的に価格情報を同期します：

```bash
# 開発モード
npm run dev

# プロダクションモード（ビルド後）
npm start
```

起動すると：
- 即座に初回同期が実行されます
- その後、毎日午前2時に自動同期が実行されます
- Ctrl+C で停止できます

### 2. 手動同期

必要に応じて手動で同期を実行できます：

```bash
# 24時間以上経過している場合のみ同期
npm run sync

# 強制的に同期（最終更新時刻に関わらず）
npm run sync -- --force
```

### 3. プログラムから使用

```typescript
import { PricingScheduler } from './schedulers/pricingScheduler';
import { PricingStorage } from './utils/storage';

// スケジューラーを使用
const scheduler = new PricingScheduler();
await scheduler.syncPricing();

// データを読み込み
const storage = new PricingStorage();
const pricingData = await storage.load();
console.log(pricingData);
```

## データ形式

取得した価格情報は `data/pricing.json` に以下の形式で保存されます：

```json
{
  "lastUpdated": "2025-12-15T12:00:00.000Z",
  "source": "https://aws.amazon.com/jp/bedrock/pricing/",
  "models": [
    {
      "modelId": "claude-3-5-sonnet",
      "modelName": "Claude 3.5 Sonnet",
      "inputPricePer1000Tokens": 0.003,
      "outputPricePer1000Tokens": 0.015,
      "currency": "USD"
    }
  ]
}
```

## カスタマイズ

### スケジュール時刻の変更

`src/index.ts` で cron 式を変更できます：

```typescript
// 毎日午前2時（デフォルト）
scheduler.start('0 2 * * *');

// 毎日正午
scheduler.start('0 12 * * *');

// 12時間ごと
scheduler.start('0 */12 * * *');
```

### データ保存先の変更

```typescript
import { PricingStorage } from './utils/storage';

// カスタムパスを指定
const storage = new PricingStorage('/path/to/custom/data');
```

## ライセンス

Apache-2.0

## 注意事項

- このツールはAWS公式のCDNから情報を取得しています
- 1日1回の頻度で実行するため、サーバーへの負荷は最小限です
- 価格情報は参考用であり、正確性を保証するものではありません
- 最新の価格は必ずAWS公式サイトでご確認ください
