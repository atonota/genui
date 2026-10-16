import { AtlasAlert, type AtlasFeedbackStatus } from '../../AtlasFeedback';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/alert';

/** Read-only AtlasAlert; the outer GenUI node owns any action, so none is rendered here. */
export default function Component({ data }: NativeAdapterProps) {
  const alert = definition.parse(data);
  return (
    <AtlasAlert
      status={(alert.status ?? 'info') as AtlasFeedbackStatus}
      title={alert.message as string}
      description={
        typeof alert.description === 'string' && alert.description ? alert.description : undefined
      }
    />
  );
}
