import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { createPillColorAllocator, type PillColors } from '../data/pill-colors';

const PillColorContext = createContext<PillColors | undefined>(undefined);
export function usePillColor(key?: string): number | undefined {
  const colors = useContext(PillColorContext);
  return key === undefined ? undefined : colors?.get(key);
}

/** Attach to a logical collection, independent of Select/Input or any field library.
 * Stable raw keys own colors. SSR and first hydration share the theme fallback;
 * randomness runs after commit, never during rendering or a state updater.
 */
export function GenUXPillColorScope({
  values,
  children,
}: {
  values: readonly string[];
  children: ReactNode;
}) {
  const [allocator] = useState(() => createPillColorAllocator());
  const [colors, setColors] = useState(allocator.snapshot);
  const signature = JSON.stringify([...new Set(values)]);
  useEffect(() => {
    setColors(allocator.reconcile(JSON.parse(signature) as string[]));
  }, [allocator, signature]);
  return <PillColorContext.Provider value={colors}>{children}</PillColorContext.Provider>;
}
