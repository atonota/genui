import type { ComponentProps } from 'astro/types';
import type { Code } from 'astro:components';
import { docsAccessibleThemeColors } from './accessibility';
import { contrastRatio } from './color-system';

/** Build-time Shiki adapter: validate syntax colors against the actual code surface. */
export const accessibleCodeTransformers: NonNullable<ComponentProps<typeof Code>['transformers']> =
  [
    {
      span(node) {
        if (typeof node.properties.style !== 'string') return;
        node.properties.style = node.properties.style.replace(
          /(^|;)(color|--shiki-dark):\s*(#[\da-f]{6})/gi,
          (declaration, separator: string, property: string, foreground: string) => {
            const colors = docsAccessibleThemeColors[property === 'color' ? 'light' : 'dark'];
            return contrastRatio(foreground, colors.panel) >= 4.5
              ? declaration
              : `${separator}${property}:${colors.ink}`;
          },
        );
      },
    },
  ];
