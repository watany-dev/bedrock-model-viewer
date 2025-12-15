import axios from 'axios';
import { ModelPricing, PricingData } from '../types/pricing';

/**
 * AWS Bedrock 価格情報を取得するスクレイパー
 * AWS公開の価格JSONファイルから最新情報を取得
 */
export class BedrockPricingScraper {
  // AWS公開の価格情報JSONエンドポイント
  private readonly pricingJsonUrl = 'https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/index.json';
  private readonly pricingPageUrl = 'https://aws.amazon.com/jp/bedrock/pricing/';

  /**
   * 価格情報を取得
   */
  async fetchPricing(): Promise<PricingData> {
    console.log(`AWS Bedrock価格情報を取得中...`);

    try {
      // まずAWS公開の価格JSONから取得を試みる
      const models = await this.fetchFromPricingJson();

      if (models.length > 0) {
        console.log(`AWS Pricing JSONから ${models.length} モデルの価格情報を取得しました`);
        return {
          lastUpdated: new Date().toISOString(),
          source: this.pricingJsonUrl,
          models,
        };
      }

      console.log('AWS Pricing JSONから取得できませんでした。代替方法を試します。');
      throw new Error('Pricing JSON取得失敗');

    } catch (error) {
      console.error('価格情報の取得に失敗:', error instanceof Error ? error.message : String(error));
      console.log('フォールバック: 最新の既知価格情報を使用します');

      // フォールバック: 最新の既知価格情報
      // 注: 本番環境では上記のJSONから取得されるため、このコードは通常実行されません
      return {
        lastUpdated: new Date().toISOString(),
        source: 'Fallback - Latest Known Prices (2025-12)',
        models: this.getLatestKnownPricing(),
      };
    }
  }

  /**
   * AWS公開の価格JSONから価格情報を取得
   */
  private async fetchFromPricingJson(): Promise<ModelPricing[]> {
    const models: ModelPricing[] = [];

    try {
      console.log(`価格JSONを取得中: ${this.pricingJsonUrl}`);

      const response = await axios.get(this.pricingJsonUrl, {
        timeout: 60000, // 大きなJSONファイルのため60秒
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'bedrock-model-viewer/1.0',
        },
      });

      const pricingData = response.data;

      if (!pricingData || !pricingData.products) {
        console.log('価格データが見つかりません');
        return models;
      }

      console.log(`価格データを解析中... (${Object.keys(pricingData.products).length} 製品)`);

      // 製品情報を解析
      for (const [productId, product] of Object.entries(pricingData.products as Record<string, any>)) {
        const attributes = product.attributes;
        if (!attributes) continue;

        // Bedrockモデルの情報を抽出
        const usageType = attributes.usagetype || '';
        const operation = attributes.operation || '';
        const modelId = attributes.modelId || attributes.model || '';

        // モデル名を抽出
        if (!modelId && !usageType.includes('Bedrock')) continue;

        // 価格情報を取得
        const terms = pricingData.terms;
        if (!terms || !terms.OnDemand) continue;

        const onDemandTerms = terms.OnDemand[productId];
        if (!onDemandTerms) continue;

        let inputPrice: number | null = null;
        let outputPrice: number | null = null;

        // 価格ディメンションを解析
        for (const [termKey, term] of Object.entries(onDemandTerms as Record<string, any>)) {
          if (!term.priceDimensions) continue;

          for (const [dimKey, dimension] of Object.entries(term.priceDimensions as Record<string, any>)) {
            const pricePerUnit = dimension.pricePerUnit?.USD;
            const description = (dimension.description || '').toLowerCase();
            const unit = (dimension.unit || '').toLowerCase();

            if (!pricePerUnit) continue;

            const price = parseFloat(pricePerUnit);

            // 入力トークンの価格
            if (description.includes('input') || description.includes('入力')) {
              inputPrice = price;
            }
            // 出力トークンの価格
            else if (description.includes('output') || description.includes('出力')) {
              outputPrice = price;
            }
            // 単位から判断
            else if (unit.includes('input')) {
              inputPrice = price;
            } else if (unit.includes('output')) {
              outputPrice = price;
            }
          }
        }

        // モデル情報を作成
        if (inputPrice !== null || outputPrice !== null) {
          const modelName = this.extractModelName(attributes);

          const model: ModelPricing = {
            modelId: modelId || this.normalizeModelId(modelName),
            modelName,
            currency: 'USD',
            region: attributes.location || attributes.regionCode,
          };

          if (inputPrice !== null) {
            model.inputPricePer1000Tokens = inputPrice;
          }
          if (outputPrice !== null) {
            model.outputPricePer1000Tokens = outputPrice;
          }

          console.log(`モデル発見: ${modelName} (入力: ${inputPrice}, 出力: ${outputPrice})`);
          models.push(model);
        }
      }

      return models;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(`HTTP Error: ${error.response?.status} - ${error.message}`);
      } else {
        console.error('価格JSON取得エラー:', error);
      }
      throw error;
    }
  }

  /**
   * 属性からモデル名を抽出
   */
  private extractModelName(attributes: Record<string, any>): string {
    return attributes.modelName ||
           attributes.modelId ||
           attributes.model ||
           attributes.usagetype ||
           attributes.productFamily ||
           'Unknown Model';
  }

  /**
   * 最新の既知価格情報（2025年12月時点）
   * 注: これはフォールバックとして使用されます
   */
  private getLatestKnownPricing(): ModelPricing[] {
    return [
      // Claude 3.5 Sonnet v2
      {
        modelId: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
        modelName: 'Claude 3.5 Sonnet v2',
        inputPricePer1000Tokens: 0.003,
        outputPricePer1000Tokens: 0.015,
        currency: 'USD',
        region: 'us-east-1',
        notes: '2025年12月時点の価格。リージョンにより異なります。',
      },
      // Claude 3.5 Haiku
      {
        modelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
        modelName: 'Claude 3.5 Haiku',
        inputPricePer1000Tokens: 0.001,
        outputPricePer1000Tokens: 0.005,
        currency: 'USD',
        region: 'us-east-1',
        notes: '2025年12月時点の価格。リージョンにより異なります。',
      },
      // Claude 3 Opus
      {
        modelId: 'anthropic.claude-3-opus-20240229-v1:0',
        modelName: 'Claude 3 Opus',
        inputPricePer1000Tokens: 0.015,
        outputPricePer1000Tokens: 0.075,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Claude 3 Sonnet
      {
        modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
        modelName: 'Claude 3 Sonnet',
        inputPricePer1000Tokens: 0.003,
        outputPricePer1000Tokens: 0.015,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Claude 3 Haiku
      {
        modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
        modelName: 'Claude 3 Haiku',
        inputPricePer1000Tokens: 0.00025,
        outputPricePer1000Tokens: 0.00125,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Amazon Titan Text G1 - Express
      {
        modelId: 'amazon.titan-text-express-v1',
        modelName: 'Titan Text G1 - Express',
        inputPricePer1000Tokens: 0.0002,
        outputPricePer1000Tokens: 0.0006,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Amazon Titan Text G1 - Lite
      {
        modelId: 'amazon.titan-text-lite-v1',
        modelName: 'Titan Text G1 - Lite',
        inputPricePer1000Tokens: 0.00015,
        outputPricePer1000Tokens: 0.0002,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Mistral 7B Instruct
      {
        modelId: 'mistral.mistral-7b-instruct-v0:2',
        modelName: 'Mistral 7B Instruct',
        inputPricePer1000Tokens: 0.00015,
        outputPricePer1000Tokens: 0.0002,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Mistral Large
      {
        modelId: 'mistral.mistral-large-2402-v1:0',
        modelName: 'Mistral Large',
        inputPricePer1000Tokens: 0.008,
        outputPricePer1000Tokens: 0.024,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Cohere Command R+
      {
        modelId: 'cohere.command-r-plus-v1:0',
        modelName: 'Cohere Command R+',
        inputPricePer1000Tokens: 0.003,
        outputPricePer1000Tokens: 0.015,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Cohere Command R
      {
        modelId: 'cohere.command-r-v1:0',
        modelName: 'Cohere Command R',
        inputPricePer1000Tokens: 0.0005,
        outputPricePer1000Tokens: 0.0015,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Meta Llama 3.1 8B Instruct
      {
        modelId: 'meta.llama3-1-8b-instruct-v1:0',
        modelName: 'Llama 3.1 8B Instruct',
        inputPricePer1000Tokens: 0.0003,
        outputPricePer1000Tokens: 0.0006,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Meta Llama 3.1 70B Instruct
      {
        modelId: 'meta.llama3-1-70b-instruct-v1:0',
        modelName: 'Llama 3.1 70B Instruct',
        inputPricePer1000Tokens: 0.00265,
        outputPricePer1000Tokens: 0.0035,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Meta Llama 3.1 405B Instruct
      {
        modelId: 'meta.llama3-1-405b-instruct-v1:0',
        modelName: 'Llama 3.1 405B Instruct',
        inputPricePer1000Tokens: 0.00532,
        outputPricePer1000Tokens: 0.016,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Meta Llama 3.2 1B Instruct
      {
        modelId: 'meta.llama3-2-1b-instruct-v1:0',
        modelName: 'Llama 3.2 1B Instruct',
        inputPricePer1000Tokens: 0.0001,
        outputPricePer1000Tokens: 0.0002,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Meta Llama 3.2 3B Instruct
      {
        modelId: 'meta.llama3-2-3b-instruct-v1:0',
        modelName: 'Llama 3.2 3B Instruct',
        inputPricePer1000Tokens: 0.00015,
        outputPricePer1000Tokens: 0.0003,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Meta Llama 3.2 11B Vision Instruct
      {
        modelId: 'meta.llama3-2-11b-instruct-v1:0',
        modelName: 'Llama 3.2 11B Vision Instruct',
        inputPricePer1000Tokens: 0.00035,
        outputPricePer1000Tokens: 0.0007,
        currency: 'USD',
        region: 'us-east-1',
      },
      // Meta Llama 3.2 90B Vision Instruct
      {
        modelId: 'meta.llama3-2-90b-instruct-v1:0',
        modelName: 'Llama 3.2 90B Vision Instruct',
        inputPricePer1000Tokens: 0.002,
        outputPricePer1000Tokens: 0.006,
        currency: 'USD',
        region: 'us-east-1',
      },
      // AI21 Jamba 1.5 Large
      {
        modelId: 'ai21.jamba-1-5-large-v1:0',
        modelName: 'AI21 Jamba 1.5 Large',
        inputPricePer1000Tokens: 0.002,
        outputPricePer1000Tokens: 0.008,
        currency: 'USD',
        region: 'us-east-1',
      },
      // AI21 Jamba 1.5 Mini
      {
        modelId: 'ai21.jamba-1-5-mini-v1:0',
        modelName: 'AI21 Jamba 1.5 Mini',
        inputPricePer1000Tokens: 0.0002,
        outputPricePer1000Tokens: 0.0004,
        currency: 'USD',
        region: 'us-east-1',
      },
    ];
  }

  /**
   * モデル名を正規化してIDに変換
   */
  private normalizeModelId(modelName: string): string {
    return modelName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-.]/g, '');
  }
}
