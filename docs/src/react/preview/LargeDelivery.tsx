import PreviewDocument, { type PreviewDeliveryProps, type PreviewLayout } from '../PreviewDocument';

/** Large profile preset: the example inside the centered desktop container from the central
 * device model (currently 1024 with 208px sides on the 1440x900 MacBook screen). */
export const previewLayout: PreviewLayout = {
  profile: 'large',
  gutterPx: 32,
  className: 'preview-large',
  dataLayout: 'container',
};

/** Large profile entry; a running preview that switches here applies the same preset. */
export default function LargeDelivery(props: PreviewDeliveryProps) {
  return <PreviewDocument {...props} layout={previewLayout} />;
}
