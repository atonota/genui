import { useId } from 'react';
import { Flex, Typography } from 'antd';
import GenUXSlider from '../../GenUXSlider';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition, sliderView } from '../../../genux/native/slider';

/** Controlled by runtime data only; every change is reported, never held locally. */
export default function NativeSlider({ data, disabled, onChange }: NativeAdapterProps) {
  const labelId = useId();
  const view = sliderView(definition.parse(data));
  return (
    <Flex vertical gap="small">
      <Typography.Text id={labelId}>{view.label}</Typography.Text>
      <GenUXSlider
        value={view.value}
        min={view.min}
        max={view.max}
        step={view.step}
        disabled={disabled || view.locked}
        ariaLabelledByForHandle={labelId}
        onChange={(next: number) => onChange(next)}
      />
    </Flex>
  );
}
