/** Canonical preview profiles for the isolated preview document. The reader selects a
    profile manually; it is never detected from the user agent or the host viewport and makes
    no hardware claim. Screen dimensions stay in the one central data/preview-devices module. */
import {
  isPreviewOrientation,
  previewScreen,
  type PreviewDevice,
  type PreviewScreen,
} from '../data/preview-devices';

export type PreviewProfile = 'large' | 'medium' | 'small' | 'tv';

export const previewProfiles: readonly PreviewProfile[] = ['large', 'medium', 'small', 'tv'];
export const DEFAULT_PREVIEW_PROFILE: PreviewProfile = 'large';

const profileDevices: Readonly<Record<PreviewProfile, PreviewDevice>> = {
  large: 'macbook',
  medium: 'ipad',
  small: 'iphone',
  tv: 'tv',
};

export function isPreviewProfile(value: unknown): value is PreviewProfile {
  return typeof value === 'string' && (previewProfiles as readonly string[]).includes(value);
}

export function previewProfileDevice(profile: PreviewProfile): PreviewDevice {
  return profileDevices[profile];
}

export function previewProfileForDevice(device: PreviewDevice): PreviewProfile {
  return (
    previewProfiles.find(profile => profileDevices[profile] === device) ?? DEFAULT_PREVIEW_PROFILE
  );
}

export type PreviewProfileScreen = PreviewScreen & { readonly profile: PreviewProfile };

/** Validates an untrusted selection; unknown profiles or orientations throw. */
export function parsePreviewProfile(profile: unknown, orientation?: unknown): PreviewProfileScreen {
  if (!isPreviewProfile(profile)) throw new TypeError('Unknown preview profile.');
  if (orientation !== undefined && !isPreviewOrientation(orientation))
    throw new TypeError('Unknown preview orientation.');
  return { profile, ...previewScreen(profileDevices[profile], orientation) };
}
