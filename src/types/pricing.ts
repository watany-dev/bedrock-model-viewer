/**
 * AWS Bedrock モデルの価格情報の型定義
 */

export interface ModelPricing {
  modelId: string;
  modelName: string;
  inputPricePerToken?: number;
  outputPricePerToken?: number;
  inputPricePer1000Tokens?: number;
  outputPricePer1000Tokens?: number;
  inputPricePer1MTokens?: number;
  outputPricePer1MTokens?: number;
  currency: string;
  region?: string;
  notes?: string;
}

export interface PricingData {
  lastUpdated: string; // ISO 8601 format
  source: string;
  models: ModelPricing[];
}

export interface SyncResult {
  success: boolean;
  timestamp: string;
  modelsCount: number;
  error?: string;
}
