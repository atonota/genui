// Ambient declarations the library build needs beyond Vite's own client types. Canonical sources
// reference vite/client, which already declares the ?inline/?raw, stylesheet, font and
// import.meta.env types for the build compiler; redeclaring them conflicts (TS2300/TS2687).
// tools/build-library.mjs implements the loaders, strips that build-only reference from emitted
// declarations and rejects Vite or Astro type references, so consumers need neither.
declare module '*.scss?inline' {
  const css: string;
  export default css;
}
