# @nairaramp/react

React hook and UI components for adding Pay with Naira flows to React and Next.js applications, powered by [`@nairaramp/core`](https://www.npmjs.com/package/@nairaramp/core).

Status: early development, testnet only.

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Example](#quick-example)
- [Components](#components)
  - [PayWithNaira](#paywithnaira)
  - [StatusTimeline](#statustimeline)
- [Hook: usePayWithNaira](#hook-usepaywithnaira)
- [Next.js App Router](#nextjs-app-router)
- [Nigerian Language Localization](#nigerian-language-localization)
- [Stellar Wave Program](#stellar-wave-program)
- [Development & Testing](#development--testing)
- [Documentation](#documentation)

---

## Features

- **Drop-in UI Components**: `<PayWithNaira />` (on-ramp) and `<CashOutToNaira />` (off-ramp) handle button state, popup launching, fallback links, and completion/error callbacks.
- **Synchronous Popup Launcher**: Pre-opens the anchor window synchronously on user click before awaiting network requests, preventing browser popup blockers from suppressing the anchor interaction.
- **Resilient Fallback & URL Validation**: Validates anchor URLs (`http:`/`https:`) and renders an inline fallback link (`Continue to the anchor`) if the browser blocks popups.
- **Phased Lifecycle & Quote Hooks**: `usePayWithNaira()`, `useCashOutToNaira()`, and `useRampQuote()` manage deposit/withdrawal state machines and debounced/pollable SEP-38 rate estimation.
- **Themeable & Customizable**: Supports `theme` (`"light" | "dark" | "system"`), `className`, and `style` overrides, plus pre-built Nigerian language label sets (`YORUBA_LABELS`, `HAUSA_LABELS`, `IGBO_LABELS`, `PIDGIN_LABELS`).
- **Visual Status Tracking**: `<StatusTimeline />` visually represents all 6 transaction milestones with 100% coverage across all 15 Stellar SEP-24 transaction statuses.
- **Full Accessibility (a11y)**: Semantic `<ol>` lists, `aria-current="step"`, live screen-reader status announcements via `aria-live="polite"`, visible focus outlines, and responsive design down to 360 px viewports.
- **Native Next.js Support**: Built-in `"use client";` directive enables direct import in Next.js Server Component pages without manual wrappers.
- **Zero Runtime Bloat**: Lightweight dual ESM and CommonJS bundles with TypeScript declarations, with zero dependencies outside of `@nairaramp/core`, `react`, and `react-dom`.

---

## Installation

```bash
# Using pnpm (recommended)
pnpm add @nairaramp/react @nairaramp/core

# Using npm
npm install @nairaramp/react @nairaramp/core

# Using yarn
yarn add @nairaramp/react @nairaramp/core
```

---

## Quick Example

```tsx
import { useState } from "react";
import { createRamp, freighterSigner, type TransactionStatus } from "@nairaramp/core";
import { PayWithNaira, StatusTimeline } from "@nairaramp/react";

const ramp = createRamp({
  network: "testnet",
  anchorId: "test-anchor",
  signer: freighterSigner(),
});

export function Checkout() {
  const [status, setStatus] = useState<TransactionStatus | undefined>(undefined);

  return (
    <div>
      <PayWithNaira ramp={ramp} assetCode="USDC" onComplete={() => setStatus("completed")} />
      <StatusTimeline status={status} />
    </div>
  );
}
```

---

## Components

### `PayWithNaira` & `CashOutToNaira`

`<PayWithNaira />` (on-ramp) and `<CashOutToNaira />` (off-ramp) provide complete payment/withdrawal buttons, automated anchor popup launchers, fallback links for blocked popups, and live status updates. Both support `theme` (`"light" | "dark" | "system"`), `className`, and `style` props, and can read `ramp` from `<NairaRampProvider>`.

```tsx
<NairaRampProvider ramp={ramp}>
  <CashOutToNaira
    assetCode="USDC"
    amount="25"
    theme="dark"
    onComplete={(txHash) => console.log("Cash out sent:", txHash)}
    onError={(err) => console.error("Cash out failed:", err.message)}
  />
</NairaRampProvider>
```

#### Props (`PayWithNaira`)

The `<PayWithNaira />` component provides a complete payment button, automated anchor popup launcher, fallback link for blocked popups, and live status updates.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `ramp` | `Ramp` | *required* | Initialized `Ramp` client instance from `@nairaramp/core`. |
| `assetCode` | `string` | *required* | Target Stellar on-chain asset (e.g. `"USDC"`, `"NGNC"`). |
| `amount` | `string` | `undefined` | Optional fiat or crypto amount for the deposit. |
| `label` | `string` | `"Pay with Naira"` | Button text in the idle state. |
| `onComplete` | `() => void` | `undefined` | Callback fired exactly once when transaction reaches `"completed"`. |
| `onError` | `(error: NairaRampError) => void` | `undefined` | Callback fired exactly once if deposit or watcher fails. |

```tsx
<PayWithNaira
  ramp={ramp}
  assetCode="USDC"
  amount="5000"
  label="Pay ₦5,000"
  onComplete={() => console.log("Payment confirmed!")}
  onError={(err) => console.error("Payment failed:", err.message)}
/>
```

---

### `StatusTimeline`

The `<StatusTimeline />` component renders a visual 6-step progress indicator or a failure notification. It maps all 15 `TransactionStatus` enum values through a typed record ensuring zero unhandled statuses at compile time.

#### Ordered Milestones

1. **Started** (`incomplete`)
2. **Waiting for your payment** (`pending_user_transfer_start`, `pending_user`)
3. **Payment received** (`pending_user_transfer_complete`, `pending_external`)
4. **Anchor processing** (`pending_anchor`)
5. **Sending on Stellar** (`pending_stellar`, `pending_trust`)
6. **Completed** (`completed`)

Terminal failure statuses (`refunded`, `expired`, `no_market`, `too_small`, `too_large`, `error`) automatically switch the component into a failure alert view displaying the failure label and anchor message.

#### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `status` | `TransactionStatus \| undefined` | *required* | Current anchor transaction status (defaults to `"Started"` step active if `undefined`). |
| `message` | `string` | `undefined` | Optional human-readable message from the anchor. |
| `labels` | `Partial<Record<TimelineStep, string>>` | `undefined` | Optional localized label map for translating step names. |

---

## Hook: `usePayWithNaira`

For applications requiring completely bespoke checkout interfaces, the `usePayWithNaira` hook exposes the underlying lifecycle state machine and watcher subscriptions:

```tsx
import { createRamp, freighterSigner } from "@nairaramp/core";
import { usePayWithNaira } from "@nairaramp/react";

const ramp = createRamp({
  network: "testnet",
  anchorId: "test-anchor",
  signer: freighterSigner(),
});

export function CustomCheckout() {
  const { start, phase, url, error, reset } = usePayWithNaira({
    ramp,
    assetCode: "USDC",
  });

  return (
    <div>
      {phase === "idle" && (
        <button type="button" onClick={() => start("10000")}>
          Pay ₦10,000 with Naira
        </button>
      )}

      {phase === "starting" && <p>Connecting to anchor...</p>}

      {phase === "awaiting_user" && url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Complete transfer in anchor window
        </a>
      )}

      {phase === "processing" && <p>Processing on Stellar network...</p>}
      {phase === "completed" && <p>Deposit confirmed!</p>}

      {phase === "failed" && (
        <div>
          <p>Payment failed: {error?.message}</p>
          <button type="button" onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}
```

### Lifecycle Phases

| Phase | Description |
|---|---|
| `idle` | Initial state. Ready to initiate payment via `start()`. |
| `starting` | In-flight deposit request with anchor. |
| `awaiting_user` | Deposit initialized; interactive anchor URL is available and popup/window is open. |
| `processing` | User submitted payment; anchor is processing the transfer on Stellar. |
| `completed` | Transaction reached terminal success. |
| `failed` | Transaction reached terminal failure or thrown exception. |

---

## Next.js App Router

Every distribution bundle of `@nairaramp/react` includes the `"use client";` banner directive on line 1. You can import and use `<PayWithNaira />`, `<StatusTimeline />`, and `usePayWithNaira()` directly inside Server Component pages without adding a manual `"use client";` wrapper file.

---

## Nigerian Language Localization

You can easily translate `<StatusTimeline />` labels into Nigerian languages such as Yoruba, Hausa, Igbo, or Nigerian Pidgin by supplying the `labels` prop:

```tsx
<StatusTimeline
  status={status}
  labels={{
    "Started": "Bẹrẹ",
    "Waiting for your payment": "Nduro de owo rẹ",
    "Payment received": "A ti gba owo",
    "Anchor processing": "Anchor n ṣiṣẹ lori rẹ",
    "Sending on Stellar": "Nfi ranṣẹ lori Stellar",
    "Completed": "Pari",
  }}
/>
```

---

## Stellar Wave Program

This repository participates in the **Stellar Wave** program on Drips. Contributors can pick up curated seed issues, submit pull requests, and earn points:

- **Trivial Issues (100 pts)**: Language translations, docs examples, style enhancements.
- **Medium Issues (150 pts)**: A11y tests, dark-mode themes, test coverage improvements, SSR tests.
- **High Issues (200 pts)**: Component extensions (e.g. `CashOutToNaira`), quote estimation hooks.

Check out [`docs/seed-issues.md`](docs/seed-issues.md) for the active list of seed issues and instructions to apply at [drips.network/wave](https://drips.network/wave).

---

## Development & Testing

```bash
# Install dependencies
pnpm install

# Build ESM, CJS, and DTS bundles
pnpm build

# Run ESLint
pnpm lint

# Run TypeScript type check
pnpm typecheck

# Run unit and component test suites (Vitest + jsdom + RTL)
pnpm test

# Run tests with v8 coverage report
pnpm test:coverage
```

---

## Documentation

- [API Reference](docs/API.md) - Complete contract, hook lifecycle phases, component props, and accessibility details.
- [Vite Integration Guide](docs/VITE_GUIDE.md) - Setup and example for Vite + React SPAs.
- [Contributing Guide](CONTRIBUTING.md) - Development setup, Stellar Wave participation, and testing rules.
- [Security Policy](SECURITY.md) - Vulnerability disclosure process.
- [License](LICENSE) - Apache License 2.0.

Related repositories: nairaramp-core, nairaramp-demo
