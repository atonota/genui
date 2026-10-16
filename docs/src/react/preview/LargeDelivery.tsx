import PreviewDocument, { type PreviewDeliveryProps, type PreviewLayout } from '../PreviewDocument';

/** Large profile preset: the example inside the desktop 1280 container. */
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
