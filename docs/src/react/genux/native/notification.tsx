import { useEffect, useId, useRef, useState } from 'react';
import GenUXButton from '../../GenUXButton';
import { GenUXFeedbackScope, useGenUXNotification } from '../../GenUXFeedback';
import { useI18n } from '../../useI18n';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { readNotification } from '../../../genux/native/notification';

/**
 * Controlled native notification. Only a local click requests `value: true`;
 * a received `true` alone never opens a notice. A local request stays pending
 * until the host accepts it, and a lock or unmount cancels it. Closing reports `false`.
 */
export default function GenUXNotificationAdapter({ data, disabled, onChange }: NativeAdapterProps) {
  const { t } = useI18n();
  const notice = readNotification(data);
  const blocked = disabled || notice.disabled === true;
  const [api, holder] = useGenUXNotification();
  const key = useId();
  const [requests, setRequests] = useState(0);
  const requested = useRef(false);
  const owned = useRef(false);
  const latest = useRef({ onChange, blocked });
  latest.current = { onChange, blocked };

  useEffect(() => {
    if (!notice.value || blocked) {
      // A pending request waits for the host to accept `true`; only a lock or a
      // host `false` that withdraws an owned notice cancels it.
      if (blocked || owned.current) requested.current = false;
      if (owned.current) {
        owned.current = false;
        api.destroy(key);
      }
      return;
    }
    // Reopening the same key updates an owned notice when host content changes.
    if (!requested.current && !owned.current) return;
    requested.current = false;
    owned.current = true;
    api.open({
      key,
      title: notice.message,
      description: notice.description,
      status: notice.status,
      onClose: () => {
        if (!owned.current) return;
        owned.current = false;
        if (!latest.current.blocked) latest.current.onChange(false);
      },
    });
  }, [
    api,
    key,
    requests,
    blocked,
    notice.value,
    notice.message,
    notice.description,
    notice.status,
  ]);

  useEffect(
    () => () => {
      requested.current = false;
      owned.current = false;
    },
    [],
  );

  const request = () => {
    if (blocked) return;
    requested.current = true;
    setRequests(count => count + 1);
    if (!notice.value) onChange(true);
  };

  return (
    <GenUXFeedbackScope>
      <GenUXButton text={t('Show notification')} disabled={blocked} onClick={request} />
      {holder}
    </GenUXFeedbackScope>
  );
}
