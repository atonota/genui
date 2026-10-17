import { GenUXAlert, type GenUXFeedbackStatus } from '../../GenUXFeedback';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/alert';

/** Read-only GenUXAlert; the outer GenUX node owns any action, so none is rendered here. */
export default function Component({ data }: NativeAdapterProps) {
  const alert = definition.parse(data);
  return (
    <GenUXAlert
      status={(alert.status ?? 'info') as GenUXFeedbackStatus}
      title={alert.message as string}
      description={
        typeof alert.description === 'string' && alert.description ? alert.description : undefined
      }
    />
  );
}
