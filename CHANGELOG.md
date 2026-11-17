# Changelog

All notable changes to `@nairaramp/react` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **`useCashOutToNaira` & `CashOutToNaira`**: Off-ramp withdrawal hook and drop-in component integrating `ramp.withdraw`, `ramp.watch`, and automatic `ramp.completeWithdrawal`.
- **`useRampQuote`**: Debounced, pollable, race-safe hook wrapping `ramp.getPrice` for pre-transaction rate estimation.
- **Theming & Customization**: Added `theme?: "light" | "dark" | "system"`, `className`, and `style` props to `PayWithNaira` and `StatusTimeline`.
- **Nigerian Language Dictionaries**: Exported `YORUBA_LABELS`, `HAUSA_LABELS`, `IGBO_LABELS`, and `PIDGIN_LABELS` for `StatusTimeline`.
- **SSR & Accessibility Tests**: Added Node-environment `renderToString` SSR tests (`test/ssr.test.tsx`) and keyboard/ARIA accessibility tests (`test/a11y.test.tsx`).
- **Vite Integration Guide**: Added `docs/VITE_GUIDE.md`.
- **CI Enhancements**: Added `test:coverage`, `npm pack --dry-run`, and `pnpm audit --prod` checks.

### Fixed & Security
- Populated `NairaRampError` and stopped active watchers on terminal failure statuses in `usePayWithNaira`.
- Guarded `StatusTimeline` against unrecognized runtime status strings and widened `status` prop type to `TransactionStatus | string | undefined`.
- Added `http:`/`https:` URL protocol validation in `PayWithNaira` and `CashOutToNaira` before navigating popups or rendering fallback links.

---

## [0.1.0] - 2026-11-08

### Added
- **`usePayWithNaira` hook**: Complete ramp lifecycle management with 6 distinct phases (`idle`, `starting`, `awaiting_user`, `processing`, `completed`, `failed`), automatic watcher subscription and cleanup on unmount/reset, double-start protection, and error normalization as `NairaRampError`.
- **`PayWithNaira` component**: Drop-in payment button that opens the anchor flow synchronously via `window.open` before awaiting deposit response, handles popup blockers with a fallback `"Continue to the anchor"` link, enforces WCAG visible focus outlines, provides polite screen reader announcements (`aria-live="polite"`), and adapts to 360px mobile viewports.
- **`StatusTimeline` component**: Progress timeline displaying the 6 sequential steps (`Started`, `Waiting for your payment`, `Payment received`, `Anchor processing`, `Sending on Stellar`, `Completed`) with `aria-current="step"` on the active step, complete compile-time coverage for all 15 `TransactionStatus` values via `STATUS_MAP`, dedicated failure notifications (`role="alert"`), and custom translation support via `labels` prop.
- **Next.js App Router compatibility**: Configured `tsup` build banner to prepend `"use client";` to line 1 of all ESM and CJS bundles.
- **Packaging & CI**: Dual ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) builds with TypeScript declarations (`dist/index.d.ts`), comprehensive test coverage across 28 unit tests, and multi-version Node (20 & 22) CI pipeline.
