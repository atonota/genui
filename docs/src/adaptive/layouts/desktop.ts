import cssText from '../../styles/adaptive-layouts/desktop.scss?inline';
import { withLayoutStyles } from '../layout-styles';

/** Desktop: persistent navigation, main and context as three panes. */
export const layoutModule = withLayoutStyles(
  { profile: 'desktop', className: 'adaptive-layout-desktop', navigation: 'persistent' },
  cssText,
);
