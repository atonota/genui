import { useId, useRef, useState } from 'react';
import { AutoComplete, ConfigProvider } from 'antd';
import AtlasButton from './AtlasButton';
import AtlasClearIcon from './AtlasClearIcon';
import { normalizeSearch } from '../i18n';
import { useI18n } from './useI18n';

export type AtlasSuggestion = Readonly<{
  key: string;
  value: string;
  title: string;
  description?: string;
  group?: { key: string; label: string };
  meta?: string;
  keywords?: readonly string[];
  disabled?: boolean;
}>;
export interface AtlasAutoCompleteProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  items: readonly AtlasSuggestion[];
  onSelect?: (item: AtlasSuggestion) => void;
  placeholder?: string;
  help?: string;
  disabled?: boolean;
  status?: 'error' | 'warning';
  error?: string;
  availability?: 'ready' | 'loading' | 'error';
  onRetry?: () => void;
}

function MatchText({ text, query }: { text: string; query: string }) {
  // Highlight literal matches only. Accent-insensitive filtering can also find
  // a result without guessing a normalized-to-original character offset.
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  return index < 0 ? (
    <>{text}</>
  ) : (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + query.length)}</mark>
      {text.slice(index + query.length)}
    </>
  );
}

/** Native editable combobox; data/selection belong to the caller. */
export default function AtlasAutoComplete({
  id: suppliedId,
  label,
  value,
  onChange,
  items,
  onSelect,
  placeholder,
  help,
  disabled,
  status,
  error,
  availability = 'ready',
  onRetry,
}: AtlasAutoCompleteProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const { t } = useI18n();
  const { componentDisabled } = ConfigProvider.useConfig();
  const blocked = disabled ?? componentDisabled ?? false;
  const composing = useRef(false);
  const [open, setOpen] = useState(false);
  const query = value.trim();
  const search = normalizeSearch(query);
  const matching =
    availability === 'ready'
      ? items.filter(
          item =>
            !search ||
            normalizeSearch(
              [item.value, item.title, item.description ?? '', ...(item.keywords ?? [])].join(' '),
            ).includes(search),
        )
      : [];
  const options = matching.map(item => ({
    key: item.key,
    value: item.value,
    disabled: item.disabled,
    'aria-label': [item.title, item.description, item.disabled ? t('Unavailable') : item.meta]
      .filter(Boolean)
      .join('. '),
    // The native selected field measures `label`, even in combobox mode.
    // Keep it single-line; render descriptions only inside the popup.
    label: item.value,
    richLabel: (
      <div className="atlas-autocomplete-result">
        <span className="atlas-autocomplete-result-title">
          <MatchText text={item.title} query={query} />
        </span>
        {(item.meta || item.disabled) && (
          <span className="atlas-autocomplete-result-meta">
            {item.disabled ? t('Unavailable') : item.meta}
          </span>
        )}
        {item.description && (
          <span className="atlas-autocomplete-result-description">{item.description}</span>
        )}
      </div>
    ),
  }));
  const groups = new Map<string, { label: string; options: typeof options }>();
  const groupedOptions: (
    | (typeof options)[number]
    | { key: string; label: string; options: typeof options }
  )[] = [];
  matching.forEach((item, index) => {
    if (!item.group) {
      groupedOptions.push(options[index]);
      return;
    }
    let group = groups.get(item.group.key);
    if (!group) {
      group = { label: item.group.label, options: [] };
      groups.set(item.group.key, group);
      groupedOptions.push({ key: item.group.key, ...group });
    }
    group.options.push(options[index]);
  });
  const emptyTitle =
    availability === 'loading'
      ? t('Suggestions are loading')
      : availability === 'error'
        ? t('Suggestions are unavailable')
        : t('No suggestions match');
  const emptyHelp =
    availability === 'loading'
      ? t('You can keep typing while suggestions are unavailable.')
      : availability === 'error'
        ? t('Your text is kept. Try the suggestions again or continue with your own text.')
        : t('Try a shorter phrase or keep your own text.');
  const describedBy = [help && `${id}-help`, error && `${id}-error`, `${id}-results`]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className="atlas-autocomplete"
      data-autocomplete-field
      onCompositionStartCapture={() => {
        composing.current = true;
      }}
      onCompositionEndCapture={() => {
        composing.current = false;
      }}
      onKeyDownCapture={event => {
        // Native6.6.6 lacks a composing guard on root Enter selection. Leave the
        // input's default IME behavior intact; stop it reaching the list handler.
        if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229)
          event.stopPropagation();
      }}
    >
      <label htmlFor={id}>{label}</label>
      <AutoComplete
        id={id}
        value={value}
        onChange={onChange}
        onSelect={selected => {
          if (blocked || availability !== 'ready') return;
          const item = matching.find(item => item.value === selected && !item.disabled);
          if (item) onSelect?.(item);
        }}
        disabled={blocked}
        status={error ? 'error' : status}
        placeholder={placeholder}
        aria-invalid={!!error || status === 'error' || undefined}
        aria-describedby={describedBy}
        aria-busy={availability === 'loading' || undefined}
        allowClear={{ clearIcon: <AtlasClearIcon />, label: t('Clear value') }}
        virtual={false}
        defaultActiveFirstOption={false}
        backfill={false}
        showSearch={{ filterOption: false }}
        options={groupedOptions}
        optionRender={option => ('richLabel' in option.data ? option.data.richLabel : option.label)}
        popupMatchSelectWidth
        listHeight={320}
        classNames={{
          root: 'atlas-autocomplete-control',
          popup: { root: 'atlas-select-popup atlas-autocomplete-popup' },
        }}
        getPopupContainer={(node: HTMLElement) =>
          node.closest<HTMLElement>('.atlas-autocomplete') ?? document.body
        }
        onOpenChange={setOpen}
        notFoundContent={
          <div className="atlas-autocomplete-empty" role="status">
            <p>{emptyTitle}</p>
            <p>{emptyHelp}</p>
          </div>
        }
      />
      {help && (
        <p id={`${id}-help`} className="atlas-autocomplete-help">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="atlas-autocomplete-error" role="alert">
          {error}
        </p>
      )}
      <p
        id={`${id}-results`}
        className="atlas-autocomplete-feedback"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {blocked
          ? t('Suggestions are disabled. The current text stays visible.')
          : availability !== 'ready'
            ? emptyTitle
            : open || query
              ? matching.length
                ? matching.length === 1
                  ? t('1 suggestion. Use arrow keys and Enter to choose, or keep typing.')
                  : t('{count} suggestions. Use arrow keys and Enter to choose, or keep typing.', {
                      count: matching.length,
                    })
                : t('No suggestions match. Your text is still available.')
              : t('Type to explore suggestions. Your own text is welcome.')}
      </p>
      {availability === 'error' && onRetry && (
        <AtlasButton
          text={t('Retry suggestions')}
          fill="outline"
          disabled={blocked}
          htmlType="button"
          onClick={onRetry}
        />
      )}
    </div>
  );
}
