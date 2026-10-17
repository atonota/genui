import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ConfigProvider, Upload, type UploadFile, type UploadProps } from 'antd';
import { useI18n } from './useI18n';

/** Facts about a selected file that may leave the component. Never the bytes or the File. */
export type UploadMetadata = { name: string; type: string; size: number };

export type GenUXUploadProps = {
  label: string;
  /** Comma-separated MIME types, type wildcards and extensions, for example text/plain,.txt */
  accept?: string;
  /** Finite positive byte limit per file. */
  maxBytes?: number;
  multiple?: boolean;
  /** Positive whole number of files the list may hold when multiple; checked before a file joins. */
  maxFiles?: number;
  disabled?: boolean;
  /**
   * Host-owned metadata. When supplied it is authoritative: the list shows exactly these entries,
   * reusing a File chosen here only for an entry with the same name, type and size.
   */
  value?: readonly UploadMetadata[];
  /** Every list change as metadata, including entries restored from value. */
  onValueChange?: (value: UploadMetadata[]) => void;
  /** Every list change as the File handles chosen on this device; restored entries have none. */
  onFilesChange?: (files: File[]) => void;
};

export type UploadRejection = 'type' | 'size';

/** Accept rules, trimmed and lower-cased; an empty list accepts every type. */
export function parseAccept(accept: string | undefined): string[] {
  return (accept ?? '')
    .split(',')
    .map(rule => rule.trim().toLowerCase())
    .filter(Boolean);
}

export const isValidMaxBytes = (maxBytes: number | undefined) =>
  maxBytes === undefined || (Number.isFinite(maxBytes) && maxBytes > 0);

/** Why a local file is refused, or undefined when it may join the list. */
export function uploadRejection(
  file: { name: string; type: string; size: number },
  rules: { accept?: string; maxBytes?: number },
): UploadRejection | undefined {
  const accepted = parseAccept(rules.accept);
  const name = file.name.trim().toLowerCase();
  const type = (file.type.split(';')[0] ?? '').trim().toLowerCase();
  const typeAccepted =
    accepted.length === 0 ||
    accepted.some(rule => {
      if (rule === '*' || rule === '*/*') return true;
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
      return type === rule;
    });
  if (!typeAccepted) return 'type';
  if (rules.maxBytes !== undefined && file.size > rules.maxBytes) return 'size';
  return undefined;
}

function formatBytes(bytes: number, locale: string) {
  const [value, unit] =
    bytes >= 1024 * 1024
      ? ([bytes / (1024 * 1024), 'megabyte'] as const)
      : bytes >= 1024
        ? ([bytes / 1024, 'kilobyte'] as const)
        : ([bytes, 'byte'] as const);
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit,
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

// Only local facts are kept: no status, url or response, so nothing reads as uploaded.
const localItem = (file: UploadFile): UploadFile => ({
  uid: file.uid,
  name: file.name,
  size: file.size,
  type: file.type,
  originFileObj: file.originFileObj,
});

const metadataOf = (file: UploadFile): UploadMetadata => ({
  name: file.name,
  type: file.type ?? '',
  size: file.size ?? 0,
});

/**
 * The displayed list for host metadata. Each entry takes the next unused local item with the
 * same name, type and size, so repeated entries match by occurrence. Any other entry is shown
 * from its metadata alone, without a File.
 */
function controlledList(
  value: readonly UploadMetadata[],
  local: readonly UploadFile[],
): UploadFile[] {
  const pool = [...local];
  return value.map((entry, index) => {
    const match = pool.findIndex(
      file =>
        file.name === entry.name && (file.type ?? '') === entry.type && file.size === entry.size,
    );
    const [file] = match >= 0 ? pool.splice(match, 1) : [];
    if (file) return localItem(file);
    return {
      uid: `genux-upload-restored-${index}`,
      name: entry.name,
      type: entry.type,
      size: entry.size,
    };
  });
}

/** Local file selection with native Upload.Dragger. Files stay on the device; nothing is sent. */
export default function GenUXUpload({
  label,
  accept,
  maxBytes,
  multiple = false,
  maxFiles,
  disabled,
  value,
  onValueChange,
  onFilesChange,
}: GenUXUploadProps) {
  const { t, locale } = useI18n();
  const { componentDisabled } = ConfigProvider.useConfig();
  const root = useRef<HTMLDivElement>(null);
  const selected = useRef<UploadFile[]>([]);
  const batchAccepted = useRef(0);
  // Uncontrolled: the list itself. Controlled: the items chosen here that still hold a File.
  const [local, setLocal] = useState<UploadFile[]>([]);
  const [rejections, setRejections] = useState<string[]>([]);
  const controlled = value !== undefined;
  const shown = controlled ? controlledList(value, local) : local;
  // When the host changes its metadata, File handles it no longer lists are released, so a
  // reset to [] clears them. A choice the host has not answered yet keeps its handle.
  const valueKey = controlled
    ? JSON.stringify(value.map(entry => [entry.name, entry.type, entry.size]))
    : '';
  const [syncedKey, setSyncedKey] = useState(valueKey);
  if (syncedKey !== valueKey) {
    setSyncedKey(valueKey);
    setLocal(shown.filter(file => file.originFileObj));
  }
  const configured = isValidMaxBytes(maxBytes);
  const fileLimit =
    multiple && maxFiles !== undefined && Number.isInteger(maxFiles) && maxFiles > 0
      ? maxFiles
      : undefined;
  const inactive = Boolean(disabled ?? componentDisabled) || !configured;
  const accepted = parseAccept(accept);
  const helper = [
    t('Files stay on this device.'),
    accepted.length > 0 ? t('Accepted types: {types}.', { types: accepted.join(', ') }) : '',
    configured && maxBytes !== undefined
      ? t('Maximum size per file: {size}.', { size: formatBytes(maxBytes, locale) })
      : '',
  ]
    .filter(Boolean)
    .join(' ');

  // accept reaches the native chooser as a hint only, never as security: beforeUpload checks
  // every chosen or dropped file with uploadRejection. The Dragger keeps no accept prop so
  // native drop still reaches that check. rc-upload remounts its input after each choice,
  // and every choice re-renders through commit or the alerts, so this runs after each render.
  useEffect(() => {
    const input = root.current?.querySelector<HTMLInputElement>('input[type=file]');
    if (!input) return;
    if (!accept) input.removeAttribute('accept');
    else if (input.getAttribute('accept') !== accept) input.setAttribute('accept', accept);
  });

  // Handlers start from the list on screen; commit moves it ahead until the next render.
  useEffect(() => {
    selected.current = shown;
  });

  // The list changes only here; native batches repeat the same list per file.
  const commit = (next: UploadFile[]) => {
    const previous = selected.current;
    if (
      previous.length === next.length &&
      previous.every((file, index) => file.uid === next[index]?.uid)
    )
      return;
    selected.current = next;
    setLocal(next.filter(file => file.originFileObj));
    onFilesChange?.(next.flatMap(file => (file.originFileObj ? [file.originFileObj] : [])));
    onValueChange?.(next.map(metadataOf));
  };

  // Every request is refused: false keeps a valid file local, LIST_IGNORE drops a refused one.
  // Chooser and drop share this path, and each new batch replaces the previous alerts. rc-upload
  // calls this for a whole batch before the list changes, so the file limit counts the files
  // already accepted from the same batch.
  const beforeUpload: UploadProps['beforeUpload'] = (file, batch) => {
    if (!configured) return Upload.LIST_IGNORE;
    if (batch[0] === file) batchAccepted.current = 0;
    let reason: UploadRejection | 'count' | undefined = uploadRejection(file, {
      accept,
      maxBytes,
    });
    if (
      !reason &&
      fileLimit !== undefined &&
      selected.current.length + batchAccepted.current >= fileLimit
    )
      reason = 'count';
    if (!reason) batchAccepted.current += 1;
    const message =
      reason === 'type'
        ? t('{name} was not added because its file type is not accepted.', { name: file.name })
        : reason === 'size'
          ? t('{name} was not added because it is larger than {size}.', {
              name: file.name,
              size: formatBytes(maxBytes ?? 0, locale),
            })
          : reason === 'count'
            ? t('{name} was not added because no more than {limit} files can be selected.', {
                name: file.name,
                limit: new Intl.NumberFormat(locale).format(fileLimit ?? 0),
              })
            : undefined;
    setRejections(previous => {
      const base = batch[0] === file ? [] : previous;
      return message ? [...base, message] : base;
    });
    return reason ? Upload.LIST_IGNORE : false;
  };

  const remove = (file: UploadFile) => {
    // Keep keyboard focus in the control after its remove button leaves the list.
    root.current?.querySelector<HTMLElement>('.ant-upload-btn[role=button]')?.focus();
    commit(selected.current.filter(item => item.uid !== file.uid));
    return false;
  };

  // rc-upload opens the chooser on Enter only; Space completes native button semantics.
  const openWithSpace = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== ' ' || inactive || !(event.target instanceof HTMLElement)) return;
    if (!event.target.matches('.ant-upload-btn[role=button]')) return;
    event.preventDefault();
    event.target.querySelector<HTMLInputElement>('input[type=file]')?.click();
  };

  // No action, customRequest or accept prop: beforeUpload refuses every request, and leaving
  // accept to our own check (the input only carries it as a hint) keeps dropped files on the chooser's path. Native drag-and-drop
  // would otherwise discard mismatched files silently, without the visible alert.
  return (
    <div className="genux-upload" ref={root} onKeyDown={openWithSpace}>
      <Upload.Dragger
        fileList={shown}
        multiple={multiple}
        maxCount={multiple ? undefined : 1}
        disabled={inactive}
        beforeUpload={beforeUpload}
        onChange={({ fileList }) =>
          commit(
            fileList
              .filter(
                file => file.originFileObj || selected.current.some(item => item.uid === file.uid),
              )
              .map(localItem),
          )
        }
        onRemove={remove}
        showUploadList={{ showPreviewIcon: false, showDownloadIcon: false, showRemoveIcon: true }}
        itemRender={(_node, file, _list, actions) => (
          <div className="genux-upload-item">
            <span className="genux-upload-name">{file.name}</span>
            {typeof file.size === 'number' && (
              <span className="genux-upload-size">{formatBytes(file.size, locale)}</span>
            )}
            <button
              type="button"
              className="genux-upload-remove"
              aria-label={t('Remove {name}', { name: file.name })}
              disabled={inactive}
              onClick={actions.remove}
            >
              {t('Remove')}
            </button>
          </div>
        )}
      >
        <span className="genux-upload-prompt">
          <span className="genux-upload-label">{label}</span>
          <span className="genux-upload-drop" aria-hidden="true">
            {t('or drop them here')}
          </span>
        </span>
      </Upload.Dragger>
      <p className="genux-upload-helper">{helper}</p>
      <div className="genux-upload-alert" role="alert">
        {!configured ? (
          <p>{t('This upload is unavailable because its size limit is not a positive number.')}</p>
        ) : (
          rejections.length > 0 && (
            <ul>
              {rejections.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          )
        )}
      </div>
    </div>
  );
}
