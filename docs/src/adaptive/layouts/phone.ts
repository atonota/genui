import cssText from '../../styles/adaptive-layouts/phone.scss?inline';
import { withLayoutStyles } from '../layout-styles';

/** Phone: a drawer the person opens; nothing overlays the main journey. */
export const layoutModule = withLayoutStyles(
  { profile: 'phone', className: 'adaptive-layout-phone', navigation: 'drawer' },
  cssText,
);
