import GenUXQuote from '../../GenUXQuote';
import type { NativeAdapterProps } from '../../../genux/native-contract';
import { definition } from '../../../genux/native/quote';

/** Read-only adapter: validated data maps to explicit GenUXQuote props; no controls or actions. */
export default function Quote({ data }: NativeAdapterProps) {
  const { quote, attribution, context } = definition.parse(data) as {
    quote: string;
    attribution: string;
    context?: string;
  };
  return <GenUXQuote quote={quote} attribution={attribution} context={context} />;
}
