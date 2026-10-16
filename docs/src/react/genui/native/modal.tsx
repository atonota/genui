import type { NativeUIAdapterProps } from '../native-catalog';
import { definition } from '../../../genui/native/modal';
import AtlasButton from '../../AtlasButton';
import { AtlasModal } from '../../AtlasFeedback';
import { useI18n } from '../../useI18n';
import { nativeLayerClassName } from '../../../genui/native-contract';

/**
 * Controlled native Modal: the runtime value alone decides visibility. Cancel,
 * Escape and close request false; confirm calls the configured outer action
 * and requests close only when it commits: without an available action Confirm
 * is disabled while Cancel stays active, and a false or thrown result keeps the
 * dialog open. Native Modal returns focus to the opener. A locked
 * node never shows its dialog, because cancel and confirm cannot work while it is
 * locked. The stored value is kept, so unlocking shows the dialog again.
 * Trusted presentation places it: a bottom sheet on phone or short height, centered otherwise.
 */
export default function AtlasModalNative({
  data,
  disabled,
  actionAvailable = true,
  presentation,
  onChange,
  onAction,
}: NativeUIAdapterProps) {
  const { t } = useI18n();
  const modal = definition.parse(data);
  const locked = disabled || modal.disabled === true;
  const open = modal.value === true && !locked;
  const close = () => {
    if (!locked) onChange(false);
  };
  const confirmable = !locked && actionAvailable;
  const confirm = () => {
    if (!confirmable) return;
    let committed: boolean | void;
    try {
      committed = onAction();
    } catch {
      // The runtime reports its own failures; the dialog only stays open.
      return;
    }
    if (committed !== false) onChange(false);
  };
  return (
    <>
      <AtlasButton
        text={modal.opener as string}
        fill="outline"
        disabled={locked}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!locked) onChange(true);
        }}
      />
      <AtlasModal
        open={open}
        rootClassName={nativeLayerClassName(presentation)}
        centered={presentation?.layerPlacement === 'centered'}
        width={presentation?.layerPlacement === 'sheet' ? '100%' : undefined}
        title={modal.title as string}
        onCancel={close}
        footer={[
          <AtlasButton
            key="cancel"
            text={typeof modal.cancelLabel === 'string' ? modal.cancelLabel : t('Cancel')}
            fill="outline"
            disabled={locked}
            onClick={close}
          />,
          <AtlasButton
            key="confirm"
            text={typeof modal.confirmLabel === 'string' ? modal.confirmLabel : t('Confirm')}
            disabled={!confirmable}
            onClick={confirm}
          />,
        ]}
      >
        <p>{modal.body as string}</p>
      </AtlasModal>
    </>
  );
}
