// Unified search result interface
export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
}

export interface SearchOptions {
  domains?: string[];
}

export interface WebSearchSource {
  search(query: string): Promise<WebSearchResult[]>;
}
