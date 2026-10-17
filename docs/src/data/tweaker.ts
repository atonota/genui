/** Shared settings geometry and overlay order, in documentation CSS pixels. */
export const tweakerTokens = { width: 400, layer: 2000, triggerSize: 48 } as const;
export const tweakerVariables = {
  '--genux-tweaker-width': `${tweakerTokens.width}px`,
  '--genux-tweaker-layer': String(tweakerTokens.layer),
  '--genux-tweaker-trigger-size': `${tweakerTokens.triggerSize}px`,
};
