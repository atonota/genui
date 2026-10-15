import '../../../styles/atlas-feedback.css';
import { useEffect, useId, useRef } from 'react';
import AtlasButton from '../../AtlasButton';
import { AtlasFeedbackScope, useAtlasToast } from '../../AtlasFeedback';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition, readToast } from '../../../genui/native/toast';

/**
 * User-triggered notice on the native Atlas toast queues. The runtime owns `value`;
 * only a click in this mount may open the notice, so host or restored values stay quiet.
 * A pending click survives a delayed accept, but a lock, a replaced notice or unmount
 * cancels it.
 */
export default function AtlasToastAdapter({ data, disabled, onChange }: NativeAdapterProps) {
  const toast = readToast(definition.parse(data));
  const inactive = disabled || toast.disabled;
  const [api, holder] = useAtlasToast();
  const key = useId();
  const requested = useRef<typeof toast | null>(null);
  useEffect(() => {
    const pending = requested.current;
    if (!pending) return;
    if (
      inactive ||
      pending.message !== toast.message ||
      pending.status !== toast.status ||
      pending.placement !== toast.placement
    ) {
      requested.current = null;
      return;
    }
    if (!toast.value) return;
    requested.current = null;
    api.open({
      key,
      content: toast.message,
      status: toast.status,
      placement: toast.placement,
    });
  }, [api, key, inactive, toast.value, toast.message, toast.status, toast.placement]);
  useEffect(
    () => () => {
      requested.current = null;
      api.destroy(key);
    },
    [api, key],
  );
  return (
    <AtlasFeedbackScope>
      <AtlasButton
        text={toast.label}
        disabled={inactive || toast.value}
        onClick={() => {
          requested.current = toast;
          onChange(true);
        }}
      />
      {holder}
    </AtlasFeedbackScope>
  );
}
