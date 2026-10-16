import {
  resolveAdaptive,
  serverEnvironment,
  type AdaptiveEnvironment,
  type AdaptiveOptions,
  type AdaptiveResolution,
  type LayoutProfile,
  type ProductSurface,
} from './policy';
import { layoutLoaders, type InitialLayout } from './delivery';

export type ServerAdaptiveHints = {
  width?: unknown;
  height?: unknown;
  surface?: unknown;
  lockedProfile?: unknown;
};

export type ServerAdaptive = {
  environment: AdaptiveEnvironment;
  options: AdaptiveOptions;
  resolution: AdaptiveResolution;
};

/** The resolved request plus serializable data for its one layout profile. */
export type ServerAdaptiveLayout = ServerAdaptive & { initialLayout: InitialLayout };

const layoutProfiles: readonly LayoutProfile[] = [
  'phone',
  'tablet',
  'laptop',
  'desktop',
  'wide',
  'living-room',
];
const surfaces: readonly ProductSurface[] = ['web', 'living-room'];

/** A finite positive CSS length from a number or a plain numeric string; anything else is unknown. */
function cssLength(value: unknown): number | undefined {
  const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

const oneOf = <T extends string>(allowed: readonly T[], value: unknown): T | undefined =>
  allowed.find(item => item === value);

/**
 * Request-time hints from a trusted host. Only dimensions change: capabilities stay
 * unassumed, user agents are never read, and the living-room surface exists only when
 * the host states it. Static Pages builds call this without hints and get the
 * conservative baseline; the output can seed AdaptiveProvider's initial environment.
 */
export function resolveServerAdaptive(hints: ServerAdaptiveHints = {}): ServerAdaptive {
  const width = cssLength(hints.width);
  const height = cssLength(hints.height) ?? serverEnvironment.height;
  const environment: AdaptiveEnvironment =
    width === undefined
      ? serverEnvironment
      : { ...serverEnvironment, width, height, visualWidth: width, visualHeight: height };
  const surface = oneOf(surfaces, hints.surface);
  const locked = oneOf(layoutProfiles, hints.lockedProfile);
  // A living-room lock is admitted only together with the explicit living-room surface.
  const lockedProfile = locked === 'living-room' && surface !== 'living-room' ? undefined : locked;
  const options: AdaptiveOptions = {
    ...(surface ? { surface } : {}),
    ...(lockedProfile ? { lockedProfile } : {}),
  };
  return { environment, options, resolution: resolveAdaptive(environment, options) };
}

/**
 * SSR source port: resolveServerAdaptive plus the compiled CSS and metadata of the resolved
 * profile only, read from the literal layoutLoaders registry, never from caller-named imports.
 * The result is plain serializable data with no attach or other functions for the client.
 * Static Pages output has no request-time host and keeps the shared baseline instead.
 */
export async function loadServerAdaptive(
  hints: ServerAdaptiveHints = {},
): Promise<ServerAdaptiveLayout> {
  const adaptive = resolveServerAdaptive(hints);
  const profile = adaptive.resolution.layout;
  const entry = await layoutLoaders[profile]();
  if (entry.profile !== profile)
    throw new Error(`Layout module ${entry.profile} answered ${profile}`);
  const { className, navigation, cssText } = entry;
  if (typeof cssText !== 'string' || cssText.trim() === '')
    throw new Error(`Layout module ${profile} has no compiled CSS`);
  return { ...adaptive, initialLayout: { profile, className, navigation, cssText } };
}
