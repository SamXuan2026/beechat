export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
  nextBeforeId: number | null;
  pageSize: number;
}
