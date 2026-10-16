import PreviewDocument, { type PreviewDeliveryProps, type PreviewLayout } from '../PreviewDocument';

/** Medium profile preset: a tablet grid track around the example. */
export const previewLayout: PreviewLayout = {
  profile: 'medium',
  gutterPx: 16,
  className: 'preview-medium',
  dataLayout: 'grid',
};

/** Medium profile entry; a running preview that switches here applies the same preset. */
export default function MediumDelivery(props: PreviewDeliveryProps) {
  return <PreviewDocument {...props} layout={previewLayout} />;
}
