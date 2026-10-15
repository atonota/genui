import { pillColorPresets } from './pill-palette';

export type PillColors = ReadonlyMap<string, number>;
/** Read-only snapshots cannot mutate the allocator, even from plain JavaScript. */
function colorView(source: Map<string, number>): PillColors {
  const view: PillColors = Object.freeze({
    size: source.size,
    get: (key: string) => source.get(key),
    has: (key: string) => source.has(key),
    keys: () => source.keys(),
    values: () => source.values(),
    entries: () => source.entries(),
    [Symbol.iterator]: () => source[Symbol.iterator](),
    forEach(callback: (value: number, key: string, map: PillColors) => void, thisArg?: unknown) {
      source.forEach((value, key) => callback.call(thisArg, value, key, view));
    },
  });
  return view;
}

function randomChoice(length: number, random?: () => number): number {
  if (random) {
    try {
      const value = random();
      return Number.isFinite(value)
        ? Math.min(length - 1, Math.max(0, Math.floor(value * length)))
        : 0;
    } catch {
      return 0;
    }
  }
  try {
    const crypto = globalThis.crypto;
    if (crypto?.getRandomValues) {
      const sample = new Uint32Array(1);
      const limit = 0x100000000 - (0x100000000 % length);
      // Rejection sampling avoids modulo bias; bound retries if entropy is broken.
      for (let attempt = 0; attempt < 8; attempt++) {
        crypto.getRandomValues(sample);
        if (sample[0]! < limit) return sample[0]! % length;
      }
    }
  } catch {
    /* A restricted entropy API must not prevent tag creation. */
  }
  return Math.min(length - 1, Math.floor(Math.random() * length));
}

/** One mounted Pill collection owns one allocator. No global/SSR allocation state. */
export function createPillColorAllocator({
  paletteSize = pillColorPresets.length,
  random,
}: { paletteSize?: number; random?: () => number } = {}) {
  if (
    !Number.isSafeInteger(paletteSize) ||
    paletteSize < 2 ||
    paletteSize > pillColorPresets.length
  )
    throw new RangeError(
      'Pill palette size must be between 2 and the shared chromatic catalog length.',
    );
  let assignments = new Map<string, number>();
  let snapshot = colorView(assignments);
  let last: number | undefined;
  return {
    snapshot: () => snapshot,
    lastColor: () => last,
    reconcile(values: readonly string[]): PillColors {
      const keys = new Set(values);
      if (keys.size === assignments.size && [...keys].every(key => assignments.has(key)))
        return snapshot;
      const next = new Map([...assignments].filter(([key]) => keys.has(key)));
      const counts = Array<number>(paletteSize).fill(0);
      for (const color of next.values()) counts[color]!++;
      for (const key of keys) {
        if (next.has(key)) continue;
        const eligible = counts
          .map((count, index) => ({ count, index }))
          .filter(item => item.index !== last);
        const minimum = Math.min(...eligible.map(item => item.count));
        const leastUsed = eligible.filter(item => item.count === minimum);
        // Break usage ties by hue separation: pastel neighbors should not look identical.
        const references =
          minimum === 0
            ? [...new Set([...next.values(), ...(last === undefined ? [] : [last])])]
            : last === undefined
              ? []
              : [last];
        const separation = (index: number) =>
          references.length === 0
            ? 0
            : Math.min(
                ...references.map(previous => {
                  const delta = Math.abs(
                    pillColorPresets[index]!.hue - pillColorPresets[previous]!.hue,
                  );
                  return Math.min(delta, 360 - delta);
                }),
              );
        const best = Math.max(...leastUsed.map(item => separation(item.index)));
        const candidates = leastUsed.filter(
          item => Math.abs(separation(item.index) - best) < 0.0001,
        );
        const color = candidates[randomChoice(candidates.length, random)]!.index;
        next.set(key, color);
        counts[color]!++;
        last = color;
      }
      assignments = next;
      snapshot = colorView(next);
      return snapshot;
    },
  };
}
