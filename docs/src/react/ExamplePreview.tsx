import type { ReactNode } from 'react';
import { useAtlasAppearance } from './AtlasAppearance';
import { usePreviewContext } from './PreviewContext';
import PreviewWorkbench from './PreviewWorkbench';

export type ExamplePreviewProps = {
  /** Literal, globally unique kebab-case id prefixed with the component route. */
  id: string;
  /** Canonical English title; translated here. */
  title: string;
  children: ReactNode;
};

/** Docs pages render the isolated workbench; the preview document renders only its example. */
export default function ExamplePreview({ id, title, children }: ExamplePreviewProps) {
  const appearance = useAtlasAppearance();
  const preview = usePreviewContext();
  // Inside the isolated preview document only the selected example renders.
  if (preview) return preview.exampleId === id ? <div data-preview-content>{children}</div> : null;
  // Storybook and approved consumers render the demo unchanged.
  if (appearance !== 'docs') return <>{children}</>;
  // Docs pages never render the raw demo outside its iframe.
  return <PreviewWorkbench id={id} title={title} />;
}
