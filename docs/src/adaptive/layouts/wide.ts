import cssText from '../../styles/adaptive-layouts/wide.scss?inline';
import { withLayoutStyles } from '../layout-styles';

/** Wide: three panes with wider context; reading stays at a readable measure. */
export const layoutModule = withLayoutStyles(
  { profile: 'wide', className: 'adaptive-layout-wide', navigation: 'persistent' },
  cssText,
);
