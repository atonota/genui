import { Typography } from 'antd';
import AtlasButton from '../../AtlasButton';
import AtlasIcon from '../../AtlasIcon';
import { Drawer } from '../../AtlasOverlay';
import { useI18n } from '../../useI18n';
import { definition } from '../../../genui/native/drawer';
import { nativeLayerClassName, type NativeAdapterProps } from '../../../genui/native-contract';

/**
 * Controlled native Drawer: opener and close only report the next value; the runtime owns it.
 * A locked drawer never renders open, because every close path is disabled while locked; the
 * stored value is left untouched so a later unlock reveals it again. Trusted presentation
 * opens it as a bottom sheet on phone or short height, and from its side otherwise.
 */
export default function AtlasDrawerAdapter({
  data,
  disabled,
  presentation,
  onChange,
}: NativeAdapterProps) {
  const { t } = useI18n();
  const drawer = definition.parse(data);
  const locked = disabled || drawer.disabled === true;
  const open = drawer.value === true && !locked;
  const close = () => {
    if (!locked) onChange(false);
  };
  return (
    <>
      <AtlasButton
        text={drawer.label as string}
        disabled={locked}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!locked) onChange(true);
        }}
      />
      <Drawer
        open={open}
        title={drawer.title as string}
        rootClassName={nativeLayerClassName(presentation)}
        placement={
          presentation?.layerPlacement === 'sheet'
            ? 'bottom'
            : drawer.placement === 'left'
              ? 'left'
              : 'right'
        }
        keyboard={!locked}
        maskClosable={!locked}
        closable={
          locked ? false : { closeIcon: <AtlasIcon name="x" />, 'aria-label': t('Close dialog') }
        }
        onClose={close}
      >
        <Typography.Paragraph>{drawer.body as string}</Typography.Paragraph>
      </Drawer>
    </>
  );
}
