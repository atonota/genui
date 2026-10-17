import { useLayoutEffect, useMemo, useRef } from 'react';
import type { JsonValue } from '../../../genux/contracts';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import {
  nativeCollection,
  type NativeCollectionValue,
} from '../../../genux/native/record-collection';
import { nativeFieldDefinitions, type NativeRecord } from '../../../genux/native/record-fields';
import { useI18n } from '../../useI18n';
import RecordCollection from '../../workspace/kit/RecordCollection';

/** One event's accumulated candidate and the onChange captured when it began. */
interface PendingChange {
  candidate: NativeCollectionValue;
  readonly onChange: NativeAdapterProps['onChange'];
}

/** Read-only record access; collection state is the controlled native value. */
export default function NativeRecordCollection({ data, disabled, onChange }: NativeAdapterProps) {
  const { t } = useI18n();
  const collection = useMemo(() => nativeCollection(data), [data]);
  const fields = useMemo(() => nativeFieldDefinitions(collection.fields, false), [collection]);
  const parentKey = collection.parentFieldKey;
  const parentId = useMemo(
    () =>
      parentKey
        ? (record: NativeRecord) => {
            const value = Object.hasOwn(record, parentKey) ? record[parentKey] : null;
            return typeof value === 'string' && value ? value : null;
          }
        : undefined,
    [parentKey],
  );
  // RecordCollection may report several changes from one event (query then page,
  // saved-view load). The chain accumulates into one full candidate, emitted once
  // after the synchronous chain through the onChange captured when it started, so
  // the bridge's revision fence sees a single edit.
  const chain = useRef<PendingChange | null>(null);
  // Unmounting, locking or replacing the host source cancels an unsent chain, so a
  // host update cannot inherit the previous intent.
  useLayoutEffect(
    () => () => {
      chain.current = null;
    },
    [collection, disabled],
  );
  const emit = (patch: Partial<NativeCollectionValue>) => {
    if (disabled) return;
    if (chain.current) {
      chain.current.candidate = { ...chain.current.candidate, ...patch };
      return;
    }
    const started: PendingChange = { candidate: { ...collection.value, ...patch }, onChange };
    chain.current = started;
    globalThis.queueMicrotask(() => {
      if (chain.current !== started) return;
      chain.current = null;
      started.onChange(started.candidate as unknown as JsonValue);
    });
  };
  const { value } = collection;
  return (
    <>
      {disabled && (
        <p role="status">
          {t('Collection changes are unavailable while this surface is disabled.')}
        </p>
      )}
      <RecordCollection<NativeRecord>
        title={collection.title}
        records={collection.records}
        fields={fields}
        query={value.query}
        onQueryChange={query => emit({ query, page: 1 })}
        projection={value.projection}
        onProjectionChange={projection => emit({ projection })}
        activeId={value.activeId}
        onActiveIdChange={activeId => emit({ activeId })}
        checkedIds={value.checkedIds}
        onCheckedIdsChange={checkedIds => emit({ checkedIds })}
        view={value.view}
        onViewChange={view => emit({ view })}
        page={value.page}
        onPageChange={page => emit({ page })}
        pageSize={collection.pageSize}
        supportedViews={collection.views}
        dateFieldKey={collection.dateFieldKey}
        startFieldKey={collection.startFieldKey}
        endFieldKey={collection.endFieldKey}
        boardFieldKey={collection.boardFieldKey}
        parentId={parentId}
      />
    </>
  );
}
