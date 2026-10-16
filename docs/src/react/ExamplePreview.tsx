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

/** Docs pages render the actual example on the same page inside its device mockup workbench;
    the standalone preview document renders only its example. */
export default function ExamplePreview({ id, title, children }: ExamplePreviewProps) {
  const appearance = useAtlasAppearance();
  const preview = usePreviewContext();
  // Inside a preview document only the selected example renders.
  if (preview) return preview.exampleId === id ? <div data-preview-content>{children}</div> : null;
  // Storybook and approved consumers render the demo unchanged.
  if (appearance !== 'docs') return <>{children}</>;
  // Docs pages render the real demo inline, inside the workbench's device mockup.
  return (
    <PreviewWorkbench id={id} title={title}>
      {children}
    </PreviewWorkbench>
  );
}
