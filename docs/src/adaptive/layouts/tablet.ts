import cssText from '../../styles/adaptive-layouts/tablet.scss?inline';
import { withLayoutStyles } from '../layout-styles';

/** Tablet: a rail beside main; context follows main. */
export const layoutModule = withLayoutStyles(
  { profile: 'tablet', className: 'adaptive-layout-tablet', navigation: 'rail' },
  cssText,
);
