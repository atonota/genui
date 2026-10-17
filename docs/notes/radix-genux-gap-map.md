# Radix, supplied variant PDF and GenUX: coverage and remaining standards

Snapshot: 2026-10-14. This compares the official Radix catalog, the supplied PDF and actual GenUX source. A catalog entry is documentation coverage, not proof of runtime, device or GenUX acceptance. Parallel changes in this session have their own integration evidence.

## Radix Primitives

The current official catalog lists Accordion, Alert Dialog, Aspect Ratio, Avatar, Checkbox, Collapsible, Context Menu, Dialog, Dropdown Menu, Form (preview), Hover Card, Label, Menubar, Navigation Menu, One-Time Password Field (preview), Password Toggle Field (preview), Popover, Progress, Radio Group, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toast, Toggle, Toggle Group, Toolbar and Tooltip. Utilities include Accessible Icon, Direction Provider, Portal, Slot and Visually Hidden.

Radix supplies unstyled interaction building blocks, including focus management, keyboard behavior and ARIA support. Brand styling and the finished product composition remain application responsibilities. The absence of a component from this catalog is not proof that it cannot be composed from primitives.

Source: [Official introduction and component catalog](https://www.radix-ui.com/primitives/docs/overview/introduction).

## Needs that this primitive catalog does not itself deliver

This is a comparison inference from the published catalog, not a claim about every Radix product or community package:

- GenUX visual identity, semantic tokens, typography, surface recipes and theme editing.
- A finished styled Button/Input/Textarea/Card component family.
- Complete editable combobox, multi-select, date/time family, upload, hierarchical picker and color editor experiences.
- Data grid, query/filter builder, saved views, Kanban/Gantt and record workspaces.
- Authorization, business validation, synchronization, persistence contracts and server integration.

## What the PDF defines, and what later decisions supersede

The supplied one-page `variants_definations.pdf` was visually inspected because its embedded text extraction is corrupt.

| PDF category     | What is actually present                                             | Later GenUX decision / missing contract                                                                                       |
| ---------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Border           | Numbers 1–6                                                          | Later request adds 0 and defines CSS px; applicable sides, color and states need semantic ownership.                          |
| Shadow           | XS, SM, MD, LG, XL, XP labels                                        | Later request uses SM/MD/LG with full geometry. Labels alone do not define a shadow.                                          |
| Spacing          | 12,24,32,48,64,72,96,128,160,240                                     | Later request defines three increasing SM/MD/LG groups. Values need usage roles.                                              |
| Margin & Padding | 4,6,8,12,16,24,36,60,92,120                                          | Later shared inset policy supersedes this independent list.                                                                   |
| Size / Radius    | XS through XP                                                        | Later SM/MD/LG sizes, square and capsule/circle distinction supersede these labels.                                           |
| Pseudo classes   | Active/DeActive mix with Default/Hover/Focus/Disabled/Error/Collapse | Availability, editability, pointer, focus, selection, disclosure, validation, operation and dirty state must remain separate. |
| Style colors     | Light/Dark each with Success/Info/Warning/Danger/Disabled            | Scheme, semantic role and availability are separate axes; text/surface/border/focus/selection roles are needed.               |

## GenUX source coverage

Before the six new feedback/date routes in this delivery, the actual catalog has 24 component entries: Button, Input, AutoComplete, Cascader, Select, Checkbox, Radio, Switch, Slider, Accordion, Form, Drawer, Pill, Dropdown, Pagination, Steps, Breadcrumb, Splitter, Card, Data table, Collection views, Record details, Record forms and Record workspace.

Radix patterns without a dedicated GenUX catalog page include Avatar, Aspect Ratio, Context Menu, Hover Card, Menubar, Navigation Menu, OTP, Popover, Progress, Scroll Area, Separator, Tabs, Toggle, Toggle Group, Toolbar and Tooltip. This is a **documentation/public adapter gap**; it does not assert the underlying AntD feature is absent.

The shared GenUX Input.Password is relevant to password toggling, Accordion to Collapsible, and Drawer/Modal to dialog behavior; these are related patterns, not automatic API-equivalent replacements.

## Standards still requiring completion or evidence

- Complete theme consumption by each control and every state: provider presence alone does not prove height, radius, inset, placeholder or status inheritance.
- Numeric type roles exist, but line height, tracking, truncation/reveal and long-label behavior need consistent component ownership and documentation.
- Surface, state and layer metadata must be consumed by actual adapters. A documented layer number is not runtime stacking proof.
- Shared sizes need actual native target/handle measurements, especially switches and secondary actions.
- Feedback queues, dismissal, focus return and announcement behavior need bounded acceptance on actual routes.
- GenUX requires serializable contracts, validation, registry admission and trusted rendering. A React export or example page does not register a capability.
- The old date serialization candidate remains unaccepted; native date controls must not claim that candidate validates them.
- CI, physical devices and full browser coverage are not inferred from builds or source inspection.

Related references: `/token-standards/`, `/theme-builder/`, `docs/src/data/catalog.ts`, `docs/src/theme-builder/definitions.json`, `docs/src/theme-builder/states.ts` and the active-request/evidence ledger in the GenUX Temporal project.
