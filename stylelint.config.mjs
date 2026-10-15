import focusPlugin, { ruleName } from './tools/stylelint-focus-plugin.mjs';

// Only the local focus gate runs here; ignoreDisables keeps stylelint-disable comments from
// exempting any stylesheet or declaration.
export default {
  plugins: [focusPlugin],
  ignoreDisables: true,
  rules: { [ruleName]: true },
};
