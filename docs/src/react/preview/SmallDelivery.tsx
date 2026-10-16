import PreviewDocument, { type PreviewDeliveryProps, type PreviewLayout } from '../PreviewDocument';

/** Small profile preset: a touch-first stacked column on the phone screen. */
export const previewLayout: PreviewLayout = {
  profile: 'small',
  gutterPx: 16,
  className: 'preview-small',
  dataLayout: 'stack',
};

/** Small profile entry; a running preview that switches here applies the same preset. */
export default function SmallDelivery(props: PreviewDeliveryProps) {
  return <PreviewDocument {...props} layout={previewLayout} />;
}
