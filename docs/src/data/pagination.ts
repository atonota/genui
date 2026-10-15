export interface PaginationState {
  current: number;
  total: number;
  pageSize: number;
  pages: number;
  start: number;
  end: number;
}
export type PaginationItem =
  | { kind: 'page'; page: number }
  | { kind: 'gap'; from: number; to: number };

const integer = (value: number, fallback: number) =>
  Number.isFinite(value) ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(value)) : fallback;
export function paginationState(current: number, total: number, pageSize: number): PaginationState {
  const size = Math.max(1, integer(pageSize, 10));
  const count = Math.max(0, integer(total, 0));
  const pages = Math.ceil(count / size);
  const page = Math.max(1, Math.min(Math.max(1, pages), integer(current, 1)));
  return {
    current: page,
    total: count,
    pageSize: size,
    pages,
    start: count ? (page - 1) * size + 1 : 0,
    end: Math.min(page * size, count),
  };
}

/** Constant-space page window; boundary pairs never disappear or duplicate. */
export function paginationItems(current: number, pages: number): PaginationItem[] {
  const state = paginationState(current, pages, 1);
  if (!state.pages) return [];
  const visible = [
    ...new Set(
      [
        1,
        2,
        state.current - 1,
        state.current,
        state.current + 1,
        state.pages - 1,
        state.pages,
      ].filter(page => page >= 1 && page <= state.pages),
    ),
  ].sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  for (const page of visible) {
    const previous = items.at(-1);
    if (previous?.kind === 'page') {
      const distance = page - previous.page;
      if (distance === 2) items.push({ kind: 'page', page: previous.page + 1 });
      else if (distance > 2) items.push({ kind: 'gap', from: previous.page + 1, to: page - 1 });
    }
    items.push({ kind: 'page', page });
  }
  return items;
}

export function pageForSize(state: PaginationState, nextSize: number): number {
  const size = paginationState(1, state.total, nextSize).pageSize;
  return paginationState(
    Math.floor(((state.current - 1) * state.pageSize) / size) + 1,
    state.total,
    size,
  ).current;
}

export function parsePageJump(value: string, pages: number): number | null {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const page = Number(text);
  return Number.isSafeInteger(page) && page >= 1 && page <= pages ? page : null;
}
