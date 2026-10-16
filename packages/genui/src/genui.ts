// Optional GenUI entry; the only entry that may reach Ant Design X surfaces. Base controls never
// import it. Everything here re-exports canonical docs/src sources; nothing is copied.
export * from '../../../docs/src/genui/runtime';
export {
  ATLAS_CARD_CATALOG_ID,
  ATLAS_PUBLIC_CATALOG_ID,
  GENUI_COMPONENT_NAMES,
  GENUI_NATIVE_COMPONENT_NAMES,
} from '../../../docs/src/genui/contracts';
export type {
  GenUIAction,
  GenUIBatch,
  GenUIComponent,
  GenUIComponentName,
  GenUIEvent,
  GenUINativeComponentName,
  GenUIResult,
  GenUIRunStatus,
  GenUIRuntime,
  GenUISnapshot,
  GenUISurface,
  JsonValue,
  TaskBlockData,
} from '../../../docs/src/genui/contracts';
export {
  default as AtlasGenUISurface,
  atlasGenUIComponentNames,
} from '../../../docs/src/react/genui/AtlasGenUISurface';
