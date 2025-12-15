import axios from 'axios';
import * as cheerio from 'cheerio';
import { ModelPricing, PricingData } from '../types/pricing';

/**
 * AWS Bedrock 価格ページから価格情報を取得するスクレイパー
 */
export class BedrockPricingScraper {
  private readonly pricingUrl = 'https://aws.amazon.com/jp/bedrock/pricing/';

  /**
   * 価格情報を取得
   */
  async fetchPricing(): Promise<PricingData> {
    try {
      console.log(`価格情報を取得中: ${this.pricingUrl}`);

      const response = await axios.get(this.pricingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      });

      console.log('ページ取得成功、HTML解析中...');
      const $ = cheerio.load(response.data);

      const models = this.parsePricingData($);

      const pricingData: PricingData = {
        lastUpdated: new Date().toISOString(),
        source: this.pricingUrl,
        models,
      };

      console.log(`価格情報を正常に取得: ${models.length} モデル`);
      return pricingData;

    } catch (error) {
      console.error('価格情報の取得に失敗:', error);
      throw new Error(`価格情報の取得に失敗: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * HTMLから価格データを解析
   */
  private parsePricingData($: cheerio.CheerioAPI): ModelPricing[] {
    const models: ModelPricing[] = [];

    // AWS価格ページの一般的な構造に基づいて解析
    // テーブル構造を探す
    $('table').each((_, table) => {
      const $table = $(table);
      const headers: string[] = [];

      // ヘッダー行を取得
      $table.find('thead tr th, thead tr td').each((_, th) => {
        headers.push($(th).text().trim());
      });

      // モデル名や価格情報を含むヘッダーがあるか確認
      const hasModelInfo = headers.some(h =>
        h.includes('モデル') ||
        h.includes('Model') ||
        h.includes('価格') ||
        h.includes('Price')
      );

      if (!hasModelInfo) {
        return; // このテーブルはスキップ
      }

      // データ行を解析
      $table.find('tbody tr').each((_, row) => {
        const $row = $(row);
        const cells: string[] = [];

        $row.find('td').each((_, cell) => {
          cells.push($(cell).text().trim());
        });

        if (cells.length > 0) {
          const model = this.parseModelRow(headers, cells);
          if (model) {
            models.push(model);
          }
        }
      });
    });

    // テーブルが見つからない場合は、他の構造を試す
    if (models.length === 0) {
      console.warn('テーブル構造から価格情報を取得できませんでした。他の構造を試します。');
      models.push(...this.parseAlternativeStructure($));
    }

    return models;
  }

  /**
   * テーブル行からモデル情報を解析
   */
  private parseModelRow(headers: string[], cells: string[]): ModelPricing | null {
    if (cells.length === 0) return null;

    // モデル名を探す（最初の列または "Model" という名前の列）
    const modelNameIndex = headers.findIndex(h =>
      h.includes('モデル') || h.includes('Model')
    ) || 0;

    const modelName = cells[modelNameIndex];
    if (!modelName) return null;

    // 価格情報を抽出
    const inputPriceIndex = headers.findIndex(h =>
      h.includes('入力') || h.includes('Input') || h.includes('入力トークン')
    );
    const outputPriceIndex = headers.findIndex(h =>
      h.includes('出力') || h.includes('Output') || h.includes('出力トークン')
    );

    const model: ModelPricing = {
      modelId: this.normalizeModelId(modelName),
      modelName,
      currency: 'USD',
    };

    // 価格データを解析（数値を抽出）
    if (inputPriceIndex >= 0 && cells[inputPriceIndex]) {
      const price = this.extractPrice(cells[inputPriceIndex]);
      if (price !== null) {
        model.inputPricePer1000Tokens = price;
      }
    }

    if (outputPriceIndex >= 0 && cells[outputPriceIndex]) {
      const price = this.extractPrice(cells[outputPriceIndex]);
      if (price !== null) {
        model.outputPricePer1000Tokens = price;
      }
    }

    return model;
  }

  /**
   * 代替構造から価格情報を解析
   */
  private parseAlternativeStructure($: cheerio.CheerioAPI): ModelPricing[] {
    const models: ModelPricing[] = [];

    // 価格情報を含む可能性のあるセクションを探す
    $('h2, h3').each((_, heading) => {
      const $heading = $(heading);
      const headingText = $heading.text().trim();

      // モデル名らしい見出しを探す
      if (headingText.includes('Claude') ||
          headingText.includes('Titan') ||
          headingText.includes('Jurassic') ||
          headingText.includes('Llama') ||
          headingText.includes('Mistral')) {

        // 次の要素から価格情報を探す
        const $next = $heading.next();
        const text = $next.text();

        const model: ModelPricing = {
          modelId: this.normalizeModelId(headingText),
          modelName: headingText,
          currency: 'USD',
        };

        // 価格パターンを抽出
        const inputMatch = text.match(/入力.*?(\d+\.?\d*)/);
        const outputMatch = text.match(/出力.*?(\d+\.?\d*)/);

        if (inputMatch) {
          model.inputPricePer1000Tokens = parseFloat(inputMatch[1]);
        }
        if (outputMatch) {
          model.outputPricePer1000Tokens = parseFloat(outputMatch[1]);
        }

        models.push(model);
      }
    });

    return models;
  }

  /**
   * テキストから価格を抽出
   */
  private extractPrice(text: string): number | null {
    // $記号や通貨記号を除去し、数値のみを抽出
    const match = text.match(/(\d+\.?\d*)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }

  /**
   * モデル名を正規化してIDに変換
   */
  private normalizeModelId(modelName: string): string {
    return modelName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }
}
