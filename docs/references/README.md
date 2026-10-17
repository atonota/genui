# Reference material

Design references used while shaping the documentation shell. They are data, not runtime
code: nothing here is imported, built or served by the docs site.

## Documentation shell reference

- **File:** `genux-docs-shell-reference.html`, copied byte for byte by the root conductor
  from the HTML the user supplied with the drawer-core request. It is a local-only file:
  `.gitignore` excludes `/docs/references/*.html`, so it is not committed to or published
  with the public repository. Only this README is tracked.
- **Source:** user-provided single-file prototype "GenUX UI — Bileşen dokümantasyonu ·
  Etkileşimli prototip" (Turkish, `lang="tr"`).
- **Received:** 2026-10-15, for the P2-B documentation shell work
  (`genux-feature-20261014-drawer-core-01`).
- **License:** none stated. Keep it as an internal reference and do not copy its code into
  GenUX sources. The project's MIT license covers GenUX sources only; it does not cover
  this unlicensed raw reference, which stays outside the repository.

### What it informs

Only the layout hierarchy:

- a header with a menu button below the 875px content breakpoint;
- navigation sidebar, reading column and contents rail on wide screens, with the rail from
  1130px and roomier spacing from 1290px;
- navigation in an off-canvas Drawer with a close button below 875px;
- "On this page" contents as a closed disclosure below the rail breakpoint;
- a breadcrumb above the page title and previous/next links at the end of the page.

### What it does not inform

- Colours, shadows, radii, fonts and text sizes: GenUX tokens, Outfit and the 14 CSS px
  minimum apply.
- Focus styling: the reference draws surrounding outlines, which GenUX forbids.
- Motion: the central GenUX motion tokens apply, not the reference's `ease` transitions.
- Content model: its seven-section page anatomy, playground, native `<select>`, search
  dialog and `at-*` class names are prototype placeholders; GenUX keeps its eight
  documentation sections.
