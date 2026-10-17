import GenUXButton from '../../GenUXButton';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/button';

/** Renders the approved GenUX action; clicks only reach the outer GenUX action. */
export default function NativeButton({ data, disabled, onAction }: NativeAdapterProps) {
  const payload = definition.parse(data);
  return (
    <GenUXButton
      text={payload.label as string}
      disabled={disabled || payload.disabled === true}
      onClick={() => onAction()}
    />
  );
}
