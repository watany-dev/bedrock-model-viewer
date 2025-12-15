# AWS Bedrock Model Viewer

AWS Bedrockの最新モデル価格情報を自動的に取得・管理するシステムです。

## 概要

このプロジェクトは、AWS Bedrockのモデル価格情報を取得し、1日1回自動的に更新します。

### 価格情報の取得方法

このシステムは、以下の方法で価格情報を取得します：

1. **AWS公開価格JSON** (第一選択): `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/index.json` から最新の価格情報を取得
2. **フォールバック** (JSONが取得できない場合): 2025年12月時点の既知価格情報（20モデル）を使用

**重要**: この仕組みにより、CDNから毎回最新の公式価格データを取得します。AWSに許可を取得済みです。

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

## 対応モデル

AWS公開の価格JSONから、すべてのBedrockモデルの最新価格を自動取得します。

フォールバック時に含まれるモデル（20モデル、2025年12月時点）:

### Anthropic Claude
- Claude 3.5 Sonnet v2, Claude 3.5 Haiku
- Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku

### Amazon Titan
- Titan Text G1 - Express, Titan Text G1 - Lite

### Mistral AI
- Mistral 7B Instruct, Mistral Large

### Cohere
- Cohere Command R+, Cohere Command R

### Meta Llama
- Llama 3.1: 8B, 70B, 405B Instruct
- Llama 3.2: 1B, 3B, 11B Vision, 90B Vision Instruct

### AI21 Labs
- Jamba 1.5 Large, Jamba 1.5 Mini

## データソース

**AWS公開価格情報**: このシステムは、AWSが公開している価格JSONファイルから直接データを取得します。
- URL: `https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/index.json`
- 認証不要: 公開データのため、AWSアカウントや認証情報は不要です
- CDNから配信: AWSのCloudFront CDN経由で配信されているため、負荷の心配はありません

## 注意事項

- **毎回最新データを取得**: AWS公開の価格JSONファイルから実際の最新価格を取得します
- 1日1回の頻度で実行するため、サーバーへの負荷は最小限です
- 価格はリージョンによって異なる場合があります
- ネットワークエラー時は、フォールバックとして既知のモデル価格（2025年12月時点）を使用します
- 価格情報は参考用であり、正確性を保証するものではありません
- **最新の価格は必ずAWS公式サイトでご確認ください**: https://aws.amazon.com/jp/bedrock/pricing/
