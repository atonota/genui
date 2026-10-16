// Source entry for React adaptive consumers; it is not a published npm package.
export {
  default,
  default as AdaptiveProvider,
  AdaptiveContext,
  useAdaptive,
} from './AdaptiveProvider';
export type { AdaptiveContextValue } from './AdaptiveProvider';
export { default as AdaptiveShell } from './AdaptiveShell';
export type { AdaptivePurpose, AdaptiveShellOptions, AdaptiveShellProps } from './AdaptiveShell';
export { default as AdaptiveSider } from './AdaptiveSider';
export type { AdaptiveSiderProps } from './AdaptiveSider';
export type {
  ActiveInput,
  AdaptiveEnvironment,
  AdaptiveOptions,
  AdaptiveResolution,
  InputLayer,
  LayoutProfile,
  ProductSurface,
} from '../adaptive/policy';
