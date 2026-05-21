import { useEffect, useState } from "react";
import { searchMessages, type SearchResult } from "../../../api/search";

interface UseWorkspaceSearchOptions {
  setActiveChannelId: (channelId: number) => void;
  setHighlightedMessageId: (messageId: number | null) => void;
  token: string;
}

export function useWorkspaceSearch({ setActiveChannelId, setHighlightedMessageId, token }: UseWorkspaceSearchOptions) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const keyword = searchQuery.trim();
    if (!keyword) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      setSearchError(null);
      searchMessages(token, keyword)
        .then((items) => setSearchResults(items))
        .catch((error) => setSearchError(error instanceof Error ? error.message : "搜索失败"))
        .finally(() => setSearchLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchQuery, token]);

  function handleSearchResultSelect(result: SearchResult) {
    if (!result.channelId) return;
    setActiveChannelId(result.channelId);
    setHighlightedMessageId(result.id);
    setSearchQuery("");
  }

  return {
    handleSearchResultSelect,
    searchError,
    searchLoading,
    searchQuery,
    searchResults,
    setSearchQuery
  };
}
