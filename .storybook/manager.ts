import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

addons.setConfig({
  theme: create({
    base: 'light',
    brandTitle: 'GenUX Components',
    fontBase: 'Outfit, sans-serif',
    fontCode: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    colorPrimary: '#a8071a',
    colorSecondary: '#a8071a',
    appBg: '#f5f3ee',
    appContentBg: '#f5f3ee',
    textColor: '#242622',
    textMutedColor: '#62665f',
  }),
});
