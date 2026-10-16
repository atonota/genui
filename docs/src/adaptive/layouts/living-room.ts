import cssText from '../../styles/adaptive-layouts/living-room.scss?inline';
import {
  getSpatialPortalsFor,
  requestSpatialInputModality,
  subscribeSpatialPortals,
} from '../../input-modality';
import { withLayoutStyles } from '../layout-styles';
import { isSpatialBoundaryOwned, SpatialNavigationAdapter } from '../spatial';
import { WebOSInputAdapter } from '../webos';

const markAttribute = 'data-spatial-target';
const markValue = 'living-room';
// Native controls the remote may reach; once focused, fields and composites keep their arrows.
const nativeTargets =
  'a[href], button, input:not([type=hidden]), select, textarea, [role=combobox]';

/**
 * Marks owned native controls and moves focus spatially inside one TV root: the Shell or an owned
 * body portal root. onOwnership runs after a Shell or surface attribute change in the root.
 */
function attachSpatialRoot(root: HTMLElement, onOwnership: () => void): () => void {
  const marked = new WeakSet<Element>();
  const unmark = (target: Element) => {
    if (marked.has(target) && target.getAttribute(markAttribute) === markValue)
      target.removeAttribute(markAttribute);
    marked.delete(target);
  };
  // Marks native controls this TV controller owns; caller-owned data-spatial-target values are
  // never overwritten, and own markers inside a nested Shell or web surface are removed.
  const mark = (node: Node) => {
    // Node.ELEMENT_NODE without relying on the realm's global Node.
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const found = Array.from(element.querySelectorAll(nativeTargets));
    if (element.matches(nativeTargets)) found.push(element);
    for (const target of found) {
      if (!isSpatialBoundaryOwned(target, root)) {
        unmark(target);
      } else if (!target.hasAttribute(markAttribute)) {
        target.setAttribute(markAttribute, markValue);
        marked.add(target);
      }
    }
  };
  mark(root);
  // Inserted AI cards are marked; a Shell or surface attribute change re-checks ownership. The
  // filter excludes data-spatial-target, so marker writes never feed back.
  const view = root.ownerDocument.defaultView;
  const observer = view?.MutationObserver
    ? new view.MutationObserver(records => {
        if (records.some(record => record.type === 'attributes')) {
          mark(root);
          onOwnership();
        } else for (const record of records) record.addedNodes.forEach(mark);
      })
    : null;
  observer?.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-adaptive-shell', 'data-adaptive-surface'],
  });
  const spatial = new SpatialNavigationAdapter(root, {
    surface: 'living-room',
    refocusOnRemoval: true,
    // Only an actual handled move asks the central owner, which rejects a generic root and
    // focus inside a nested web surface or another Shell.
    onNavigate: () => requestSpatialInputModality(root),
  });
  let attached = true;
  return () => {
    if (!attached) return;
    attached = false;
    observer?.disconnect();
    spatial.dispose();
    for (const target of root.querySelectorAll(`[${markAttribute}]`)) unmark(target);
  };
}

/** One physical controller per body portal root, shared by every Shell its owner holds. */
type PortalController = { holders: Set<() => void>; detach: () => void };
const portalControllers = new WeakMap<Element, PortalController>();

function holdPortal(portal: HTMLElement, holder: () => void): void {
  let controller = portalControllers.get(portal);
  if (!controller) {
    const holders = new Set<() => void>();
    // A portal surface change re-checks each holding Shell, which releases a portal gone web.
    const detach = attachSpatialRoot(portal, () => {
      for (const sync of [...holders]) sync();
    });
    controller = { holders, detach };
    portalControllers.set(portal, controller);
  }
  controller.holders.add(holder);
}

function releasePortal(portal: HTMLElement, holder: () => void): void {
  const controller = portalControllers.get(portal);
  if (!controller || !controller.holders.delete(holder) || controller.holders.size > 0) return;
  portalControllers.delete(portal);
  controller.detach();
}

/**
 * Remote arrows move focus spatially inside the explicit TV root through the shared adapters.
 * Native Modal and Drawer layers render into the owner's body portal, outside this root, so each
 * owned TV portal root gets the same pooled engine. Back stays with the Shell onBack port, so
 * the webOS adapter only observes real events.
 */
function attach(root: HTMLElement): () => void {
  const held = new Set<HTMLElement>();
  let attached = true;
  const syncPortals = () => {
    const owned = new Set(attached ? getSpatialPortalsFor(root) : []);
    for (const portal of held) {
      if (owned.has(portal)) continue;
      held.delete(portal);
      releasePortal(portal, syncPortals);
    }
    for (const portal of owned) {
      if (held.has(portal)) continue;
      held.add(portal);
      holdPortal(portal, syncPortals);
    }
  };
  const detachRoot = attachSpatialRoot(root, syncPortals);
  const unsubscribe = subscribeSpatialPortals(root.ownerDocument, syncPortals);
  syncPortals();
  const remote = new WebOSInputAdapter(root.ownerDocument, { surface: 'living-room' });
  return () => {
    if (!attached) return;
    attached = false;
    unsubscribe();
    syncPortals();
    detachRoot();
    remote.dispose();
  };
}

/** Living room: only the explicitly selected TV surface loads this module. */
export const layoutModule = withLayoutStyles(
  {
    profile: 'living-room',
    className: 'adaptive-layout-living-room',
    navigation: 'spatial',
    attach,
  },
  cssText,
);
