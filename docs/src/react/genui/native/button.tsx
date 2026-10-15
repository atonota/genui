import AtlasButton from '../../AtlasButton';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/button';

/** Renders the approved Atlas action; clicks only reach the outer GenUI action. */
export default function NativeButton({ data, disabled, onAction }: NativeAdapterProps) {
  const payload = definition.parse(data);
  return (
    <AtlasButton
      text={payload.label as string}
      disabled={disabled || payload.disabled === true}
      onClick={() => onAction()}
    />
  );
}
