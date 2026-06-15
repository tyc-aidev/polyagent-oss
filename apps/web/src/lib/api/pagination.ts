export interface PaginationParams {
  limit: number;
  offset: number;
}

export function parsePagination(searchParams: URLSearchParams): PaginationParams {
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  return { limit, offset };
}