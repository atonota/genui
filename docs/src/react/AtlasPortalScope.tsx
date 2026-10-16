import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { ConfigProvider } from 'antd';
import { registerSpatialPortal } from '../input-modality';
import type { AdaptiveContextValue } from './AdaptiveProvider';
import { previewDocumentSelector, usePreviewContext } from './PreviewContext';

/** Theme attributes of an AtlasProvider owner; every portal it scopes repeats them. */
export type AtlasPortalAttributes = Readonly<{
  'data-size-profile': string;
  'data-theme-mode': string;
  'data-atlas-appearance': string | undefined;
  'data-input-modality': string;
}>;

/** Themed body portal descriptor of the nearest AtlasProvider: its roles, paint and size. */
export type AtlasPortalDescriptor = Readonly<{
  className: string;
  style: CSSProperties;
  attributes: AtlasPortalAttributes;
}>;

/** Popup container of the nearest owner: an AtlasProvider, or a Shell inside one. */
export type AtlasPopupScope = Readonly<{ getPopupContainer: () => HTMLElement }>;

const PortalDescriptorContext = createContext<AtlasPortalDescriptor | null>(null);
export const AtlasPopupScopeContext = createContext<AtlasPopupScope | null>(null);

/** Adaptive attributes of an owner or a portal, read from one effective resolution. */
export function adaptivePortalAttributes({
  environment,
  resolution,
  surface,
}: AdaptiveContextValue) {
  return {
    'data-adaptive-layout': resolution.layout,
    'data-adaptive-band': resolution.band,
    'data-adaptive-input-layers': resolution.inputLayers.join(' '),
    'data-adaptive-active-input': environment.activeInput,
    'data-adaptive-surface': surface,
    'data-adaptive-short-height': resolution.shortHeight ? 'true' : 'false',
  };
}

/** Provider side: publishes the themed portal descriptor and the provider's own popup scope. */
export function AtlasPortalOwner({
  descriptor,
  getPopupContainer,
  children,
}: {
  descriptor: AtlasPortalDescriptor;
  getPopupContainer: () => HTMLElement;
  children: ReactNode;
}) {
  const scope = useMemo(() => ({ getPopupContainer }), [getPopupContainer]);
  return (
    <PortalDescriptorContext.Provider value={descriptor}>
      <AtlasPopupScopeContext.Provider value={scope}>{children}</AtlasPopupScopeContext.Provider>
    </PortalDescriptorContext.Provider>
  );
}

/**
 * Shell side: inside an AtlasProvider the Shell's effective surface owns its popups. A nested
 * ConfigProvider sets only getPopupContainer, so theme, locale and explicit containers stay as
 * they were, and native popups render into this scope's own body portal: the provider's theme
 * roles, this resolution's adaptive attributes, no layout class and display: contents outside
 * every container query. The portal registers to the actual owner element (the Shell root),
 * mounts after mount in the owner's own document and releases on unmount. Inside a preview it
 * mounts in the nearest preview document instead of the body, so popups stay in that same-page
 * mockup. Without a provider the scope adds nothing.
 */
export default function AtlasPortalScope({
  ownerRef,
  adaptive,
  children,
}: {
  ownerRef: RefObject<HTMLElement | null>;
  adaptive: AdaptiveContextValue;
  children: ReactNode;
}) {
  const descriptor = useContext(PortalDescriptorContext);
  const owned = descriptor !== null;
  const inPreview = usePreviewContext() !== null;
  const portalRef = useRef<HTMLDivElement>(null);
  // The portal target, read after mount: SSR and the hydration render add nothing. A preview
  // keeps it in the nearest preview document; elsewhere it is the owner's own document body.
  const [body, setBody] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!owned) return;
    const owner = ownerRef.current;
    const scope = inPreview ? owner?.closest<HTMLElement>(previewDocumentSelector) : null;
    setBody(scope ?? owner?.ownerDocument.body ?? null);
  }, [owned, ownerRef, inPreview]);
  useLayoutEffect(() => {
    const owner = ownerRef.current;
    const portal = portalRef.current;
    if (!body || !owner || !portal) return;
    return registerSpatialPortal(owner, portal);
  }, [body, ownerRef]);
  const getPopupContainer = useCallback(
    () => portalRef.current ?? ownerRef.current?.ownerDocument.body ?? document.body,
    [ownerRef],
  );
  const scope = useMemo(() => ({ getPopupContainer }), [getPopupContainer]);
  if (!descriptor) return <>{children}</>;
  return (
    <ConfigProvider getPopupContainer={getPopupContainer}>
      <AtlasPopupScopeContext.Provider value={scope}>
        {children}
        {body &&
          createPortal(
            <div
              ref={portalRef}
              className={descriptor.className}
              data-atlas-portal=""
              style={{ ...descriptor.style, display: 'contents' }}
              {...descriptor.attributes}
              {...adaptivePortalAttributes(adaptive)}
            />,
            body,
          )}
      </AtlasPopupScopeContext.Provider>
    </ConfigProvider>
  );
}
