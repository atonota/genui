// Optional GenUX entry; the only entry that may reach Ant Design X surfaces. Base controls never
// import it. Everything here re-exports canonical docs/src sources; nothing is copied.
export * from '../../../docs/src/genux/runtime';
export {
  GENUX_CARD_CATALOG_ID,
  GENUX_PUBLIC_CATALOG_ID,
  GENUX_COMPONENT_NAMES,
  GENUX_NATIVE_COMPONENT_NAMES,
} from '../../../docs/src/genux/contracts';
export type {
  GenUXAction,
  GenUXBatch,
  GenUXComponent,
  GenUXComponentName,
  GenUXEvent,
  GenUXNativeComponentName,
  GenUXResult,
  GenUXRunStatus,
  GenUXRuntime,
  GenUXSnapshot,
  GenUXSurfaceModel,
  JsonValue,
  TaskBlockData,
} from '../../../docs/src/genux/contracts';
export {
  default as GenUXSurface,
  genuxComponentNames,
} from '../../../docs/src/react/genux/GenUXSurface';
