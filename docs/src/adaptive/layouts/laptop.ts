import cssText from '../../styles/adaptive-layouts/laptop.scss?inline';
import { withLayoutStyles } from '../layout-styles';

/** Laptop: rail and one capped working pane; data journeys gain a context column. */
export const layoutModule = withLayoutStyles(
  { profile: 'laptop', className: 'adaptive-layout-laptop', navigation: 'rail' },
  cssText,
);
