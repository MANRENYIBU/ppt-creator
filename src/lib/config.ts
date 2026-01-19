// 环境变量配置

export type AIProvider = 'openai' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  baseUrl?: string;
  apiKey: string;
  model: string;
}

export interface SearchConfig {
  provider: 'tavily' | 'serp';
  apiKey: string;
}

export interface ImageConfig {
  baseUrl?: string;
  apiKey: string;
  model: string;
}

/**
 * 获取AI服务配置
 */
export function getAIConfig(): AIConfig {
  const provider = (process.env.AI_PROVIDER || 'openai') as AIProvider;
  const apiKey = process.env.API_KEY;
  const baseUrl = process.env.BASE_URL;
  // 支持 MODEL 或 MODE 环境变量
  const model = process.env.MODEL || process.env.MODE || (provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-20250514');

  if (!apiKey) {
    throw new Error('API_KEY is not configured in environment variables');
  }

  return {
    provider,
    baseUrl: baseUrl || undefined,
    apiKey,
    model,
  };
}

/**
 * 获取图像生成服务配置
 * 优先使用 IMAGE_* 环境变量，否则回退到 AI 配置
 */
export function getImageConfig(): ImageConfig {
  const baseUrl = process.env.IMAGE_BASE_URL || process.env.BASE_URL;
  const apiKey = process.env.IMAGE_API_KEY || process.env.API_KEY;
  const model = process.env.IMAGE_MODEL || 'gemini-2.0-flash-exp-image-generation';

  if (!apiKey) {
    throw new Error('IMAGE_API_KEY or API_KEY is required for image generation');
  }

  return {
    baseUrl: baseUrl || undefined,
    apiKey,
    model,
  };
}

/**
 * 获取搜索服务配置
 * 优先级: TAVILY > SERP
 */
export function getSearchConfig(): SearchConfig | null {
  const tavilyKey = process.env.TAVILY_API_KEY;
  const serpKey = process.env.SERP_API_KEY;

  if (tavilyKey) {
    return {
      provider: 'tavily',
      apiKey: tavilyKey,
    };
  }

  if (serpKey) {
    return {
      provider: 'serp',
      apiKey: serpKey,
    };
  }

  return null;
}

/**
 * 检查配置是否有效
 */
export function validateConfig(): { ai: boolean; search: boolean } {
  let aiValid = false;
  let searchValid = false;

  try {
    getAIConfig();
    aiValid = true;
  } catch {
    aiValid = false;
  }

  searchValid = getSearchConfig() !== null;

  return { ai: aiValid, search: searchValid };
}
