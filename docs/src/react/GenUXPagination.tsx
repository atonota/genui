import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ConfigProvider, Select } from 'antd';
import Input from './GenUXInput';
import GenUXButton from './GenUXButton';
import { useI18n } from './useI18n';
import { paginationItems, paginationState, pageForSize, parsePageJump } from '../data/pagination';

export type GenUXPaginationButtonType = 'solid' | 'outline' | 'tint' | 'text' | 'link';
export interface GenUXPaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number, pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  showTotal?: boolean;
  disabled?: boolean;
  label?: string;
  buttonType?: GenUXPaginationButtonType;
  activeButtonType?: GenUXPaginationButtonType;
}

/** Controlled paging with native GenUX actions and branded Ant Design fields. */
export default function GenUXPagination({
  current,
  total,
  pageSize,
  onChange,
  pageSizeOptions = [10, 20, 50],
  showSizeChanger = true,
  showQuickJumper = true,
  showTotal = true,
  disabled,
  label,
  buttonType = 'text',
  activeButtonType = 'solid',
}: GenUXPaginationProps) {
  const { t, locale } = useI18n();
  const { componentDisabled } = ConfigProvider.useConfig();
  const state = paginationState(current, total, pageSize);
  const blocked = (disabled ?? componentDisabled) || state.pages === 0;
  const prefix = useId();
  const root = useRef<HTMLElement>(null);
  const [jump, setJump] = useState('');
  const [attempted, setAttempted] = useState(false);
  const parsed = parsePageJump(jump, state.pages);
  const invalid = attempted && state.pages > 0 && parsed === null;
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  const items = paginationItems(state.current, state.pages);
  const sizes = [
    ...new Set(
      [...pageSizeOptions, state.pageSize].filter(
        value => Number.isSafeInteger(value) && value > 0,
      ),
    ),
  ].sort((a, b) => a - b);

  // An endpoint button becomes disabled after reaching its destination. Keep
  // keyboard focus on the newly current page rather than losing it to the body.
  useLayoutEffect(() => {
    if (blocked) return;
    const active = document.activeElement as HTMLButtonElement | null;
    if (
      active &&
      root.current?.contains(active) &&
      active.hasAttribute('data-page-direction') &&
      active.disabled
    )
      root.current.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus();
  }, [state.current, state.pages, blocked]);

  function commit(page: number, size = state.pageSize) {
    if (blocked) return;
    const next = paginationState(page, state.total, size);
    if (next.current !== state.current || next.pageSize !== state.pageSize)
      onChange(next.current, next.pageSize);
  }
  function jumpToPage() {
    if (blocked) return;
    setAttempted(true);
    if (parsed !== null) commit(parsed);
  }
  const directions = [
    { name: 'First page', destination: 1, disabled: state.current === 1 },
    { name: 'Previous page', destination: state.current - 1, disabled: state.current === 1 },
    { name: 'Next page', destination: state.current + 1, disabled: state.current === state.pages },
    { name: 'Last page', destination: state.pages, disabled: state.current === state.pages },
  ];
  return (
    <nav
      ref={root}
      className="genux-pagination"
      aria-label={label ?? t('Pagination')}
      data-pagination-current={state.current}
      data-pagination-pages={state.pages}
      aria-disabled={blocked || undefined}
    >
      <p className="genux-pagination-summary" role="status" aria-live="polite" aria-atomic="true">
        {showTotal && (
          <span>
            {state.total
              ? t('{start}–{end} of {total} items', {
                  start: number(state.start),
                  end: number(state.end),
                  total: number(state.total),
                })
              : t('No items')}
          </span>
        )}
        <span>
          {state.pages
            ? t('Page {page} of {pages}', {
                page: number(state.current),
                pages: number(state.pages),
              })
            : t('No available pages')}
        </span>
      </p>
      <div className="genux-pagination-directions" role="group" aria-label={t('Page navigation')}>
        {directions.map(direction => (
          <GenUXButton
            key={direction.name}
            text={t(direction.name)}
            aria-label={t(direction.name)}
            fill={buttonType}
            disabled={blocked || direction.disabled}
            data-page-direction={direction.name}
            htmlType="button"
            onClick={() => commit(direction.destination)}
          />
        ))}
      </div>
      {items.length > 0 && (
        <ol className="genux-pagination-pages" aria-label={t('Page numbers')}>
          {items.map(item =>
            item.kind === 'page' ? (
              <li key={`page-${item.page}`} data-page-current={item.page === state.current}>
                <span className="genux-pagination-current-marker" aria-hidden="true" />
                <GenUXButton
                  text={number(item.page)}
                  aria-label={t('Page {page}', { page: number(item.page) })}
                  aria-current={item.page === state.current ? 'page' : undefined}
                  fill={item.page === state.current ? activeButtonType : buttonType}
                  disabled={blocked}
                  data-pagination-page={item.page}
                  htmlType="button"
                  onClick={() => commit(item.page)}
                />
              </li>
            ) : (
              <li key={`gap-${item.from}-${item.to}`} className="genux-pagination-gap">
                <span
                  aria-label={t('Pages {from} to {to} omitted', {
                    from: number(item.from),
                    to: number(item.to),
                  })}
                  role="img"
                >
                  …
                </span>
              </li>
            ),
          )}
        </ol>
      )}
      {(showSizeChanger || showQuickJumper) && (
        <div className="genux-pagination-options">
          {showSizeChanger && (
            <div className="genux-pagination-size">
              <label htmlFor={`${prefix}-size`}>{t('Items per page')}</label>
              <Select
                id={`${prefix}-size`}
                aria-label={t('Items per page')}
                value={state.pageSize}
                disabled={blocked}
                options={sizes.map(value => ({
                  value,
                  label: t('{count} / page', { count: number(value) }),
                }))}
                onChange={(size: number) => commit(pageForSize(state, size), size)}
              />
            </div>
          )}
          {showQuickJumper && (
            <div className="genux-pagination-jump">
              <label htmlFor={`${prefix}-jump`}>{t('Go to page')}</label>
              <div className="genux-pagination-jump-controls">
                <Input
                  id={`${prefix}-jump`}
                  aria-label={t('Go to page')}
                  inputMode="numeric"
                  autoComplete="off"
                  value={jump}
                  disabled={blocked}
                  aria-invalid={invalid || undefined}
                  aria-describedby={invalid ? `${prefix}-error` : undefined}
                  status={invalid ? 'error' : undefined}
                  onChange={event => {
                    setJump(event.currentTarget.value);
                    setAttempted(false);
                  }}
                  onKeyDown={event => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      jumpToPage();
                    }
                  }}
                />
                <GenUXButton
                  text={t('Go')}
                  disabled={blocked}
                  htmlType="button"
                  fill={activeButtonType}
                  onClick={jumpToPage}
                />
              </div>
              {invalid && (
                <p className="genux-pagination-error" id={`${prefix}-error`} role="alert">
                  {t('Enter a whole page number from 1 to {pages}.', {
                    pages: number(state.pages),
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
