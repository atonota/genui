import { useId, useState } from 'react';
import { Select, Switch } from 'antd';
import Input from './GenUXInput';
import GenUXProvider from './GenUXProvider';
import GenUXPagination, { type GenUXPaginationProps } from './GenUXPagination';
import ExamplePreview from './ExamplePreview';
import NumberStepper from './NumberStepper';
import { TweakerSettings } from './GenUXTweaker';
import { useI18n } from './useI18n';
import genux from '../data/genux.json';

type PreviewState = 'ready' | 'empty' | 'disabled';
type ButtonSurface = NonNullable<GenUXPaginationProps['buttonType']>;
const buttonSurfaces = genux.decisions.buttons.fill_variants.map(surface => ({
  ...surface,
  value: surface.value as ButtonSurface,
}));

function PaginationExamples() {
  const { t } = useI18n();
  const id = useId();
  const [page, setPage] = useState(42);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(500);
  const [state, setState] = useState<PreviewState>('ready');
  const [showSizeChanger, setShowSizeChanger] = useState(true);
  const [showQuickJumper, setShowQuickJumper] = useState(true);
  const [buttonType, setButtonType] = useState<ButtonSurface>('text');
  const [activeButtonType, setActiveButtonType] = useState<ButtonSurface>('solid');
  const [surfacePages, setSurfacePages] = useState<Record<ButtonSurface, number>>(
    () =>
      Object.fromEntries(buttonSurfaces.map(surface => [surface.value, 4])) as Record<
        ButtonSurface,
        number
      >,
  );
  const [note, setNote] = useState('');
  const effectiveTotal = state === 'empty' ? 0 : total;

  function changePage(nextPage: number, nextSize: number) {
    setPage(nextPage);
    setPageSize(nextSize);
  }

  return (
    <div className="pagination-catalog" data-pagination-catalog>
      <TweakerSettings title="Pagination">
        <label className="playground-control" htmlFor={`${id}-total`}>
          {t('Total records')}
          <NumberStepper
            id={`${id}-total`}
            data-pagination-total
            value={total}
            min={0}
            max={5000}
            precision={0}
            onChange={value => {
              if (typeof value === 'number') setTotal(value);
            }}
          />
        </label>
        <label className="playground-control" htmlFor={`${id}-state`}>
          {t('Example state')}
          <Select
            id={`${id}-state`}
            data-pagination-state
            value={state}
            onChange={setState}
            options={[
              { value: 'ready', label: t('Ready') },
              { value: 'empty', label: t('Empty') },
              { value: 'disabled', label: t('Unavailable') },
            ]}
          />
        </label>
        <label className="playground-control" htmlFor={`${id}-button-surface`}>
          {t('Button surface')}
          <Select
            id={`${id}-button-surface`}
            data-pagination-button-surface
            value={buttonType}
            onChange={setButtonType}
            options={buttonSurfaces.map(surface => ({
              value: surface.value,
              label: t(surface.label),
            }))}
          />
        </label>
        <label className="playground-control" htmlFor={`${id}-active-surface`}>
          {t('Active page surface')}
          <Select
            id={`${id}-active-surface`}
            data-pagination-active-surface
            value={activeButtonType}
            onChange={setActiveButtonType}
            options={buttonSurfaces.map(surface => ({
              value: surface.value,
              label: t(surface.label),
            }))}
          />
        </label>
        <label className="control-row">
          <Switch
            checked={showSizeChanger}
            onChange={setShowSizeChanger}
            aria-label={t('Show page size control')}
          />
          {t('Show page size control')}
        </label>
        <label className="control-row">
          <Switch
            checked={showQuickJumper}
            onChange={setShowQuickJumper}
            aria-label={t('Show page jump control')}
          />
          {t('Show page jump control')}
        </label>
      </TweakerSettings>
      <nav className="pagination-navigation" aria-label={t('Pagination examples')}>
        <a href="#pagination-explore">{t('Explore pages')}</a>
        <a href="#pagination-boundaries">{t('Page boundaries')}</a>
        <a href="#pagination-surfaces">{t('Button surfaces')}</a>
        <a href="#pagination-availability">{t('Availability')}</a>
      </nav>
      <section
        id="pagination-explore"
        className="pagination-section"
        aria-labelledby="pagination-explore-title"
      >
        <header>
          <p className="eyebrow">{t('01 · Find your place')}</p>
          <h3 id="pagination-explore-title">{t('Explore pages')}</h3>
          <p>
            {t(
              'Move through the review queue, choose how many records to show, or jump directly to a page.',
            )}
          </p>
        </header>
        <ExamplePreview id="pagination-explore-pages" title={t('Explore pages')}>
          <div className="pagination-stage" data-pagination-primary>
            <h4>{t('Order review queue')}</h4>
            <GenUXPagination
              current={page}
              total={effectiveTotal}
              pageSize={pageSize}
              onChange={changePage}
              showSizeChanger={showSizeChanger}
              showQuickJumper={showQuickJumper}
              disabled={state === 'disabled'}
              buttonType={buttonType}
              activeButtonType={activeButtonType}
              label={t('Order review pages')}
            />
          </div>
          <div className="pagination-note">
            <label htmlFor={`${id}-note`}>{t('Review note')}</label>
            <Input.TextArea
              id={`${id}-note`}
              data-pagination-note
              value={note}
              onChange={event => setNote(event.target.value)}
              rows={2}
              placeholder={t('Keep a note while browsing')}
              aria-describedby={`${id}-note-help`}
            />
            <p id={`${id}-note-help`} className="pagination-guidance">
              {t('Your local note stays in place as pages, size, theme and language change.')}
            </p>
          </div>
        </ExamplePreview>
      </section>
      <section
        id="pagination-boundaries"
        className="pagination-section"
        aria-labelledby="pagination-boundaries-title"
      >
        <header>
          <p className="eyebrow">{t('02 · Stay within the range')}</p>
          <h3 id="pagination-boundaries-title">{t('Page boundaries')}</h3>
          <p>
            {t(
              'The beginning, nearby pages and end stay visible. Unavailable directions stop at the first and last page.',
            )}
          </p>
        </header>
        <ExamplePreview id="pagination-page-boundaries" title={t('Page boundaries')}>
          <div className="pagination-stage" data-pagination-single>
            <h4>{t('One page of matching records')}</h4>
            <GenUXPagination
              current={1}
              total={8}
              pageSize={10}
              onChange={() => {}}
              showSizeChanger={false}
              showQuickJumper={false}
              label={t('Single page results')}
            />
            <p className="pagination-guidance">
              {t(
                'All eight records fit on one page. Navigation remains visible and cannot leave it.',
              )}
            </p>
          </div>
        </ExamplePreview>
      </section>
      <section
        id="pagination-surfaces"
        className="pagination-section"
        aria-labelledby="pagination-surfaces-title"
      >
        <header>
          <p className="eyebrow">{t('03 · Match the action hierarchy')}</p>
          <h3 id="pagination-surfaces-title">{t('Button surfaces')}</h3>
          <p>
            {t(
              'Five existing GenUX button surfaces share the same navigation. Each example keeps its own page, and the current page retains a separate marker.',
            )}
          </p>
        </header>
        <ExamplePreview id="pagination-button-surfaces" title={t('Button surfaces')}>
          <div className="pagination-surfaces-grid">
            {buttonSurfaces.map(surface => (
              <div
                key={surface.value}
                className="pagination-surface-example"
                data-pagination-surface={surface.value}
              >
                <h4>{t(surface.label)}</h4>
                <GenUXPagination
                  current={surfacePages[surface.value]}
                  total={80}
                  pageSize={10}
                  onChange={nextPage =>
                    setSurfacePages(current => ({ ...current, [surface.value]: nextPage }))
                  }
                  buttonType={surface.value}
                  activeButtonType={surface.value}
                  showTotal={false}
                  showSizeChanger={false}
                  showQuickJumper={false}
                  label={t('{surface} pagination', { surface: t(surface.label) })}
                />
              </div>
            ))}
          </div>
        </ExamplePreview>
      </section>
      <section
        id="pagination-availability"
        className="pagination-section"
        aria-labelledby="pagination-availability-title"
      >
        <header>
          <p className="eyebrow">{t('04 · Keep the state clear')}</p>
          <h3 id="pagination-availability-title">{t('Availability')}</h3>
          <p>
            {t(
              'An empty result and a temporarily unavailable queue keep their context without offering a page change.',
            )}
          </p>
        </header>
        <ExamplePreview id="pagination-availability" title={t('Availability')}>
          <div className="pagination-availability-grid">
            <div className="pagination-state-example" data-pagination-empty>
              <h4>{t('No matching records')}</h4>
              <p className="pagination-guidance">
                {t('The result is empty. The total stays at zero and navigation is unavailable.')}
              </p>
              <GenUXPagination
                current={1}
                total={0}
                pageSize={10}
                onChange={() => {}}
                showSizeChanger={false}
                showQuickJumper={false}
                label={t('Empty result pages')}
              />
            </div>
            <div className="pagination-state-example" data-pagination-disabled>
              <h4>{t('Queue temporarily unavailable')}</h4>
              <p className="pagination-guidance">
                {t('The current range remains readable while every page action is disabled.')}
              </p>
              <GenUXPagination
                current={2}
                total={30}
                pageSize={10}
                onChange={() => {}}
                showSizeChanger={false}
                showQuickJumper={false}
                disabled
                label={t('Unavailable queue pages')}
              />
            </div>
          </div>
        </ExamplePreview>
      </section>
    </div>
  );
}

export default function PaginationDemo({
  documentation = false,
}: { documentation?: boolean } = {}) {
  return (
    <GenUXProvider appearance={documentation ? 'docs' : 'approved'}>
      <PaginationExamples />
    </GenUXProvider>
  );
}
