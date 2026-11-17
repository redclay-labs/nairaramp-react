# Seed Issues

This document tracks candidate issues identified from gaps in `@nairaramp/react` for the Stellar Wave program on Drips.

> **Status Note:** All 9 initial seed issues below have been implemented across PRs #14–#21 and `docs-align-and-vite-guide`. They are retained here as a historical record of resolved work.

---

## Issue Summary

| # | Title | Complexity | Points | Labels | Body File |
|---|---|---|---|---|---|
| 01 | Add CashOutToNaira component for off-ramp withdrawal flows | High | 200 | `enhancement`, `Stellar Wave` | [01.md](seed-issues/01.md) |
| 02 | Add useRampQuote hook for live rate estimation | High | 200 | `enhancement`, `Stellar Wave` | [02.md](seed-issues/02.md) |
| 03 | Add dark-mode theme support to PayWithNaira and StatusTimeline | Medium | 150 | `enhancement`, `Stellar Wave` | [03.md](seed-issues/03.md) |
| 04 | Add keyboard navigation and automated accessibility tests | Medium | 150 | `testing`, `Stellar Wave` | [04.md](seed-issues/04.md) |
| 05 | Add SSR and Next.js React Server Component compatibility tests | Medium | 150 | `testing`, `Stellar Wave` | [05.md](seed-issues/05.md) |
| 06 | Increase PayWithNaira test coverage above 90% | Medium | 150 | `testing`, `Stellar Wave` | [06.md](seed-issues/06.md) |
| 07 | Export Nigerian language label sets for StatusTimeline (Yoruba, Hausa, Igbo, Pidgin) | Trivial | 100 | `enhancement`, `good first issue`, `Stellar Wave` | [07.md](seed-issues/07.md) |
| 08 | Add Vite and React SPA integration guide and sample app to docs | Trivial | 100 | `documentation`, `good first issue`, `Stellar Wave` | [08.md](seed-issues/08.md) |
| 09 | Add custom CSS className and style props to PayWithNaira and StatusTimeline | Trivial | 100 | `enhancement`, `good first issue`, `Stellar Wave` | [09.md](seed-issues/09.md) |

### Complexity Distribution
- **Trivial (100)**: 3 issues (33%)
- **Medium (150)**: 4 issues (44%)
- **High (200)**: 2 issues (22%)
- **Total**: 9 issues (Mix requirement: >=3 Trivial, >=3 Medium, <=3 High).

---

## Issue Creation Commands

Run these commands using the GitHub CLI (`gh`) to create the issues on GitHub:

```bash
gh issue create --title "Add CashOutToNaira component for off-ramp withdrawal flows" --body-file docs/seed-issues/01.md --label "enhancement,Stellar Wave"
gh issue create --title "Add useRampQuote hook for live rate estimation" --body-file docs/seed-issues/02.md --label "enhancement,Stellar Wave"
gh issue create --title "Add dark-mode theme support to PayWithNaira and StatusTimeline" --body-file docs/seed-issues/03.md --label "enhancement,Stellar Wave"
gh issue create --title "Add keyboard navigation and automated accessibility tests" --body-file docs/seed-issues/04.md --label "testing,Stellar Wave"
gh issue create --title "Add SSR and Next.js React Server Component compatibility tests" --body-file docs/seed-issues/05.md --label "testing,Stellar Wave"
gh issue create --title "Increase PayWithNaira test coverage above 90%" --body-file docs/seed-issues/06.md --label "testing,Stellar Wave"
gh issue create --title "Export Nigerian language label sets for StatusTimeline (Yoruba, Hausa, Igbo, Pidgin)" --body-file docs/seed-issues/07.md --label "enhancement,good first issue,Stellar Wave"
gh issue create --title "Add Vite and React SPA integration guide and sample app to docs" --body-file docs/seed-issues/08.md --label "documentation,good first issue,Stellar Wave"
gh issue create --title "Add custom CSS className and style props to PayWithNaira and StatusTimeline" --body-file docs/seed-issues/09.md --label "enhancement,good first issue,Stellar Wave"
```
