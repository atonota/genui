import GenUXSteps from '../../GenUXSteps';
import { definition, type StepsData } from '../../../genux/native/steps';
import type { NativeAdapterProps } from '../../../genux/native-contract';

/** Native GenUXSteps; the current index is controlled entirely by the runtime value. */
export default function NativeSteps({ data, disabled, onChange }: NativeAdapterProps) {
  const steps = definition.parse(data) as unknown as StepsData;
  return (
    <GenUXSteps
      label={steps.label}
      current={steps.value}
      disabled={disabled || steps.disabled === true}
      items={steps.items.map(item => ({
        key: item.id,
        title: item.title,
        content: item.description,
        disabled: item.disabled === true,
      }))}
      onChange={index => onChange(index)}
    />
  );
}
