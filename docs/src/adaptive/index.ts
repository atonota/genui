// Source entry for the pure adaptive core; it is not a published npm package. Layout entries
// stay behind the delivery loaders' dynamic imports, and spatial/webOS code is not re-exported.
export * from './policy';
export { EnvironmentStore, getEnvironmentStore } from './environment';
export * from './server';
export * from './delivery';
// Pure coverage metadata only; no React, AI or Frappe dependencies.
export {
  ADAPTIVE_COMPONENT_COVERAGE,
  DOC_SLUG_COVERAGE,
  adaptiveContractFor,
  assertAdaptiveCoverage,
} from './component-coverage';
