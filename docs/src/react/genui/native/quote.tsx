import AtlasQuote from '../../AtlasQuote';
import type { NativeAdapterProps } from '../../../genui/native-contract';
import { definition } from '../../../genui/native/quote';

/** Read-only adapter: validated data maps to explicit AtlasQuote props; no controls or actions. */
export default function Quote({ data }: NativeAdapterProps) {
  const { quote, attribution, context } = definition.parse(data) as {
    quote: string;
    attribution: string;
    context?: string;
  };
  return <AtlasQuote quote={quote} attribution={attribution} context={context} />;
}
