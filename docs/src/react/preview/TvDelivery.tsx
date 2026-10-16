import PreviewDocument, { type PreviewDeliveryProps, type PreviewLayout } from '../PreviewDocument';

/** TV profile preset: a living-room layout inside the centered container from the central
 * device model (currently 1600 with 160px sides on the illustrative 1920x1080 TV screen). */
export const previewLayout: PreviewLayout = {
  profile: 'tv',
  gutterPx: 32,
  className: 'preview-tv',
  dataLayout: 'living-room',
};

/** TV profile entry of the standalone preview page. */
export default function TvDelivery(props: PreviewDeliveryProps) {
  return <PreviewDocument {...props} layout={previewLayout} />;
}
