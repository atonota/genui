import '../../../styles/atlas-feedback.css';
import { useRef } from 'react';
import AtlasButton from '../../AtlasButton';
import { AtlasPopconfirm } from '../../AtlasFeedback';
import type { NativeUIAdapterProps } from '../native-catalog';
import { definition, type PopconfirmPayload } from '../../../genui/native/popconfirm';

/**
 * Controlled AtlasPopconfirm. The runtime value is the open state only:
 * confirm calls the trusted outer action, then AntD closes through onOpenChange
 * unless the action is unavailable (OK disabled) or reports false or throws;
 * cancel and Escape close through the same path without an action.
 */
export default function NativePopconfirm({
  data,
  disabled,
  actionAvailable = true,
  onChange,
  onAction,
}: NativeUIAdapterProps) {
  // AntD requests close synchronously after onConfirm; a failed action skips that request.
  const keepOpen = useRef(false);
  const payload = definition.parse(data) as unknown as PopconfirmPayload;
  const locked = disabled || payload.disabled === true || payload.readOnly === true;
  const open = payload.value && !locked;
  const confirmable = !locked && actionAvailable;
  return (
    <AtlasPopconfirm
      title={payload.title}
      description={payload.description}
      open={open}
      disabled={locked}
      okButtonProps={{ disabled: !confirmable }}
      onOpenChange={next => {
        if (!next && keepOpen.current) {
          keepOpen.current = false;
          return;
        }
        if (!locked && next !== open) onChange(next);
      }}
      onConfirm={() => {
        let committed: boolean | void = false;
        try {
          if (confirmable) committed = onAction();
        } catch {
          // The runtime reports its own failures; the popup only stays open.
          committed = false;
        }
        keepOpen.current = committed === false;
      }}
    >
      <AtlasButton text={payload.triggerLabel} disabled={locked} />
    </AtlasPopconfirm>
  );
}
