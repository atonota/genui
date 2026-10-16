/** Server-only: resolves every allowlisted demo once at build time, so SSR renders the selected
    demo synchronously. Browser bundles never import this module. */
import type { ComponentType } from 'react';
import { previewRegistry, resolvePreviewDemo, type PreviewDemoProps } from './registry';

if (!import.meta.env.SSR) throw new Error('preview/registry.server is server-only.');

export const serverDemos: Readonly<Record<string, ComponentType<PreviewDemoProps>>> =
  Object.fromEntries(
    await Promise.all(
      Object.entries(previewRegistry).map(
        async ([slug, entry]) => [slug, await resolvePreviewDemo(entry)] as const,
      ),
    ),
  );
