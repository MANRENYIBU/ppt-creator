import { getSearchConfig } from './config';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

/**
 * 搜索服务客户端
 */
class SearchClient {
  private provider: 'tavily' | 'serp';
  private apiKey: string;

  constructor() {
    const config = getSearchConfig();
    if (!config) {
      throw new Error('No search API key configured');
    }
    this.provider = config.provider;
    this.apiKey = config.apiKey;
  }

  /**
   * 执行搜索
   */
  async search(query: string, maxResults: number = 5): Promise<SearchResponse> {
    if (this.provider === 'tavily') {
      return this.searchWithTavily(query, maxResults);
    } else {
      return this.searchWithSerp(query, maxResults);
    }
  }

  private async searchWithTavily(query: string, maxResults: number): Promise<SearchResponse> {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: this.apiKey,
        query,
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily search failed: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      query,
      results: (data.results || []).map((r: { title: string; url: string; content: string }) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    };
  }

  private async searchWithSerp(query: string, maxResults: number): Promise<SearchResponse> {
    const params = new URLSearchParams({
      api_key: this.apiKey,
      q: query,
      num: maxResults.toString(),
    });

    const response = await fetch(`https://serpapi.com/search?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`SerpAPI search failed: ${response.statusText}`);
    }

    const data = await response.json();
    const organicResults = data.organic_results || [];

    return {
      query,
      results: organicResults.slice(0, maxResults).map((r: { title: string; link: string; snippet: string }) => ({
        title: r.title,
        url: r.link,
        content: r.snippet,
      })),
    };
  }
}

// 单例模式
let searchClient: SearchClient | null = null;

export function getSearchClient(): SearchClient {
  if (!searchClient) {
    searchClient = new SearchClient();
  }
  return searchClient;
}

/**
 * 检查搜索服务是否可用
 */
export function isSearchAvailable(): boolean {
  return getSearchConfig() !== null;
}

/**
 * 重置客户端
 */
export function resetSearchClient(): void {
  searchClient = null;
}
