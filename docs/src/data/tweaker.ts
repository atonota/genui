/** Shared settings geometry and overlay order, in documentation CSS pixels. */
export const tweakerTokens = { width: 400, layer: 2000, triggerSize: 48 } as const;
export const tweakerVariables = {
  '--atlas-tweaker-width': `${tweakerTokens.width}px`,
  '--atlas-tweaker-layer': String(tweakerTokens.layer),
  '--atlas-tweaker-trigger-size': `${tweakerTokens.triggerSize}px`,
};
