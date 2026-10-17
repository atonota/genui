# Component contributions and motion acceptance contract

This contract applies equally to employees, freelancers, community contributors,
Claude and Codex. New and changed components must pass the relevant project checks
before acceptance.

## Required motion behavior

- Normal visual state changes use the shared symmetric curve for both entry and
  exit. The default is easeInOutCubic: `cubic-bezier(0.65, 0, 0.35, 1)`.
- The single source is `docs/src/data/motion.json`. `docs:data` generates CSS
  tokens; `GenUXProvider` applies the same source to every Ant Design motion
  easing slot. Do not edit generated `genux-motion.css` manually.
- Fast press uses 80 ms, feedback 140 ms, normal surfaces 200 ms, selection 320 ms
  and the compatibility deliberate transition 500 ms. Documentation Button feedback
  is 116.667 ms; finite click waves use 400 ms. Initial delay is0ms.
  Use semantic tokens instead of repeating durations, curves or delays in components.
- Custom controls use the shared `.genux-control` base. The normal outer body
  transitions only explicitly listed paint properties; `transition: all` is
  prohibited. Intentional movement belongs to a thumb or a separate
  `.genux-motion-layer`.
- Treat hover, press, selection, opening and closing together. Rapid pointer entry
  and exit redirect the transition from its current visual state. The root, label
  and hit area stay fixed. Preserve the library exit lifecycle before removing a
  closing panel from the DOM.
- Normal states reject linear/steps/one-way easing, implicit default curves,
  `transition: none`, `animation: none`, zero duration and inline motion
  overrides. The source guard covers newly authored styles and motion overrides.
  Do not weaken tests to allow a different behavior.

## Immediate behavior

Values, `checked`, ARIA, business state and keyboard focus update immediately
on the user action. Only presentation is animated. Do not delay typing, the caret
or a visible focus indicator. Do not delay operations, approvals or input with
timers/debounce to create motion. `prefers-reduced-motion: reduce` disables
unnecessary motion and is an explicit accessibility exception.

## Language and content

English is the canonical source and initial SSR language across the project.
Turkish is the secondary language. Use English phrase keys with the shared
`translate` / `useI18n` APIs and `data-i18n` markers on static leaf text.
Translate accessible names, placeholders, status, validation and library controls
as well as visible copy. Keep source code examples in English. Preserve public
identifiers, option values, API properties, story IDs and approved decisions.

Turkish dictionaries live under `docs/src/locales/tr/` and are loaded only when
Turkish is selected or restored from an explicit saved preference. Language changes
must preserve values, validation, selection, open panels and focus, without remounting
controls. Preference storage failure must not prevent interaction. Use complete
messages and interpolation for variable content; use distinct English phrases when
contexts need different translations. Search must match both stable English component
identifiers and translated visible names through the shared normalization function.

## Acceptance gates

From the project root, run `npm run docs:verify`. If shared React/theme/Storybook
sources change, also run `npm run storybook:verify`; if legacy HTML sources
change, also run `npm run verify`. Use existing tools without installing packages
or browsers for a check. Preserve the Git authorship guard and running services.

The interaction-stability guard in `docs:test` recursively checks authored
styles, inline motion definitions, shared tokens and the component base. Violations
fail the check. The source guard does not prove every dynamic state or browser
interpolation. Review entry, exit, interrupted reversals, keyboard focus and reduced
motion through actual interaction when access is allowed. Report unexecuted browser,
CI and device checks as `not_run`.

This document and successful local tests do not prove remote CI or branch protection.
When a remote repository is connected, make the same gates required PR checks.
Do not blindly or collectively update visual references.

New click feedback must use the shared controller and target color, remain
transient, preserve immediate semantics and reduced-motion, and never replace
the visible single-edge keyboard focus marker. Keep public sizes sm/md/lg only
and all Buttons at least 48 px. The shared initial graph budget stays8KiB; optional
feedback loads on real interaction intent and never replays business activation.
