# Atlas project instructions

Follow [AGENTS.md](AGENTS.md), [docs/AGENTS.md](docs/AGENTS.md) for documentation code,
and [CONTRIBUTING.md](CONTRIBUTING.md) for every contribution. Claude, Codex and human
contributors use the same acceptance gates.

English is the default language and the canonical message source. Turkish is the
secondary locale. Keep translated display text separate from stable component keys,
values and routes; language changes must preserve user input, selection and focus.

Visual state changes ease in and out; semantic state and user input update immediately.
Respect reduced motion and the shared motion tokens.

The user's latest 2026-10-14 typography policy requires a minimum of 14 CSS px
for every readable text surface. The former 1rem minimum is removed; rem remains
an allowed unit. Preserve larger text, heading hierarchy, semantic tokens, browser
root size and zoom. Documentation keeps its existing 14px/22px native-pixel profile.

## Mandatory delivery and shared verification budget — human instruction 2026-10-14

Before starting, state the delivered behavior, owned files and necessary verification in at most four lines. Do not ask again for authorized routine work. The goal is delivery; testing, review and orchestration must not become growing independent projects.

For a small behavior change, the default shared ceiling across all agents is one new/changed test file, three new scenarios, five minutes of focused local test execution and two correction cycles. These are ceilings, not targets. Splitting, renaming, another agent/chat or task does not reset or multiply them. Test first for meaningful behavior: necessary actual failing check, implementation, same check passing; never manufacture RED.

After relevant checks pass, implement/deliver. Do not repeat successful checks or expand fixtures, matrices or review without a new change or concrete new defect. Reviewer recommendations, hypothetical safety and completeness do not authorize scope increases; only explicit human instruction can enlarge this budget. At the ceiling stop extra verification, report the missing evidence and concrete risk, and continue authorized independent work.

Preserve existing required CI/release gates, assertions and security protections. Do not bypass a failed check or mark unverified delivery DONE. Never create tests, reports, reviews, infrastructure or repeated tasks merely to fill agent counts. Report any concrete blocker requiring more budget; do not invent an exception, process or quality gate. Live supervision only; no scheduled task or automatic future wakeup.

Latest definitive input standard and input-first priority are recorded in `AGENTS.md` under “Definitive input standard — human decision 2026-10-14”; follow that shared source and the shared verification ceiling.
