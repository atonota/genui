import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type RefAttributes,
} from 'react';
import { Segmented, type SegmentedProps } from 'antd';
import genux from '../data/genux.json';
import { useGenUXSize, type GenUXSize } from './GenUXSizeProfile';
import { useGenUXAppearance, genuxLength } from './GenUXAppearance';

export type GenUXSegmentedProps<T extends string | number> = Omit<SegmentedProps<T>, 'size'> &
  RefAttributes<HTMLDivElement> & { size?: GenUXSize };

// Layout effects warn during server rendering; the roving sync only needs a mounted DOM.
const useIsomorphicLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Gives the group exactly one native Tab stop: the checked enabled radio, or the first enabled
 * radio when none is checked. WebKit leaves implicit radio stops out of sequential navigation,
 * so every own radio carries an explicit index. Radios of nested groups belong to those groups.
 */
function syncRadioTabStops(root: HTMLElement) {
  const radios = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter(
    radio => {
      const group = radio.closest('[role="radiogroup"]');
      return !group || group === root || !root.contains(group);
    },
  );
  const enabled = radios.filter(radio => !radio.disabled);
  const stop = enabled.find(radio => radio.checked) ?? enabled[0];
  for (const radio of radios) {
    const index = radio === stop ? 0 : -1;
    if (radio.tabIndex !== index) radio.tabIndex = index;
  }
}

/**
 * Native single-selection semantics with the shared wrapper and size profile. The root leaves
 * the Tab order unless the caller passes its own index.
 */
export default function GenUXSegmented<T extends string | number>({
  size,
  className,
  style,
  ref,
  tabIndex = -1,
  ...props
}: GenUXSegmentedProps<T>) {
  const inheritedSize = useGenUXSize();
  const appearance = useGenUXAppearance();
  const profile =
    genux.decisions.buttons.size_variants.find(item => item.value === (size ?? inheritedSize)) ??
    genux.decisions.buttons.size_variants[1]!;
  const rootRef = useRef<HTMLDivElement | null>(null);
  // React 19 ref cleanup: a callback ref's own cleanup replaces the null call.
  const composedRef = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      const cleanup = typeof ref === 'function' ? ref(node) : undefined;
      if (ref && typeof ref !== 'function') ref.current = node;
      return () => {
        rootRef.current = null;
        if (typeof cleanup === 'function') cleanup();
        else if (typeof ref === 'function') ref(null);
        else if (ref) ref.current = null;
      };
    },
    [ref],
  );
  // Controlled value, option and disabled props re-render this wrapper; sync before paint.
  useIsomorphicLayoutEffect(() => {
    if (rootRef.current) syncRadioTabStops(rootRef.current);
  });
  // Uncontrolled selection lives inside the library. Its checked property changes no attribute,
  // but the library toggles the selected item classes with every value. Only class, disabled,
  // checked and child list changes are watched, so the tabindex writes cause no feedback.
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    const view = root?.ownerDocument.defaultView;
    if (!root || !view) return;
    const observer = new view.MutationObserver(() => syncRadioTabStops(root));
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'disabled', 'checked'],
    });
    return () => observer.disconnect();
  }, []);
  return (
    <Segmented<T>
      {...props}
      ref={composedRef}
      tabIndex={tabIndex}
      size={profile.value === 'sm' ? 'small' : profile.value === 'lg' ? 'large' : 'middle'}
      className={[...new Set(['genux-segmented', ...(className?.split(/\s+/) ?? [])])].join(' ')}
      style={
        {
          '--genux-segmented-height': genuxLength(profile.height_px, appearance),
          ...style,
        } as CSSProperties
      }
    />
  );
}
