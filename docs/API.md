# @nairaramp/react API Reference

`@nairaramp/react` provides React components and hooks for integrating Pay with Naira fiat-to-crypto ramps powered by `@nairaramp/core`.

This document is the contract for client applications and demo implementations (including `nairaramp-demo`).

---

## Exports Overview

Exported from `@nairaramp/react`:
- `VERSION`
- `usePayWithNaira`
- `PayWithNaira`
- `StatusTimeline`
- Supporting TypeScript types and constants:
  - `UsePayWithNairaOptions`, `UsePayWithNairaResult`, `PayWithNairaPhase`
  - `PayWithNairaProps`
  - `StatusTimelineProps`, `TimelineStep`, `StatusMapping`, `StepStatusMapping`, `FailureStatusMapping`, `TIMELINE_STEPS`, `STATUS_MAP`, `YORUBA_LABELS`, `HAUSA_LABELS`, `IGBO_LABELS`, `PIDGIN_LABELS`

---

## 1. `VERSION`

```typescript
const VERSION = "0.1.0";
```

Package semver string representing the installed `@nairaramp/react` version.

---

## 2. `usePayWithNaira`

React hook that manages the end-to-end lifecycle of a Pay with Naira ramp transaction: starting the deposit, tracking hosted interactive flow URLs, monitoring status updates, and cleaning up watchers.

### Signature

```typescript
function usePayWithNaira(options: UsePayWithNairaOptions): UsePayWithNairaResult;
```

### Parameters

```typescript
interface UsePayWithNairaOptions {
  ramp: Ramp;
  assetCode: string;
}
```

- `ramp`: An initialized `Ramp` client instance from `@nairaramp/core` (`createRamp`).
- `assetCode`: The target on-chain asset to purchase (e.g., `"USDC"`, `"NGNC"`).

### Return Value

```typescript
interface UsePayWithNairaResult {
  start: (amount?: string) => Promise<{ id: string; url: string } | undefined>;
  phase: PayWithNairaPhase;
  status: TransactionStatus | string | undefined;
  transactionId: string | undefined;
  url: string | undefined;
  error: NairaRampError | undefined;
  reset: () => void;
}
```

- `start(amount?)`: Initiates a deposit. Returns `{ id, url }` on success, or `undefined` if deposit fails or if the hook is not in `"idle"` phase.
- `phase`: Current high-level lifecycle phase (`PayWithNairaPhase`).
- `status`: Low-level anchor transaction status (`TransactionStatus` or string).
- `transactionId`: Anchor transaction ID returned by `ramp.deposit`.
- `url`: Hosted anchor URL for user interaction.
- `error`: Normalized `NairaRampError` if an error occurred during deposit or polling.
- `reset()`: Resets hook state back to `"idle"` and cancels any active watcher.

### Lifecycle Phases (`PayWithNairaPhase`)

```typescript
type PayWithNairaPhase =
  | "idle"
  | "starting"
  | "awaiting_user"
  | "processing"
  | "completed"
  | "failed";
```

| Phase | Description |
| --- | --- |
| `idle` | Initial state. Ready to initiate a payment via `start()`. |
| `starting` | In-flight deposit request with `ramp.deposit({ assetCode, amount })`. |
| `awaiting_user` | Deposit initiated; `id` and `url` stored. Watcher running. Non-terminal statuses `"pending_user_transfer_start"` and `"incomplete"` keep this phase. |
| `processing` | User submitted payment; anchor is processing (`"pending_user_transfer_complete"`, `"pending_external"`, `"pending_anchor"`, `"pending_stellar"`, `"pending_trust"`, `"pending_user"`). |
| `completed` | Transaction terminal success (`"completed"`). |
| `failed` | Transaction terminal failure or deposit error (`"refunded"`, `"expired"`, `"no_market"`, `"too_small"`, `"too_large"`, `"error"`, or thrown exception). |

### Watcher Cleanup & Safety

- Active watcher subscriptions are stopped automatically on component unmount and when `reset()` is called.
- State updates arriving after component unmount are ignored to prevent memory leaks and React warnings.
- Calling `start()` while the hook is not in `idle` phase is a no-op that returns `undefined`.

### Example

```tsx
import { usePayWithNaira } from "@nairaramp/react";
import type { Ramp } from "@nairaramp/core";

function CustomRampFlow({ ramp }: { ramp: Ramp }) {
  const { start, phase, url, error, reset } = usePayWithNaira({
    ramp,
    assetCode: "USDC",
  });

  return (
    <div>
      {phase === "idle" && (
        <button type="button" onClick={() => start("5000")}>
          Pay ₦5,000 with Naira
        </button>
      )}
      {phase === "starting" && <p>Connecting...</p>}
      {phase === "awaiting_user" && url && (
        <a href={url} target="_blank" rel="noopener noreferrer">
          Open payment window
        </a>
      )}
      {phase === "processing" && <p>Processing payment...</p>}
      {phase === "completed" && <p>Payment complete!</p>}
      {phase === "failed" && (
        <div>
          <p>Error: {error?.message}</p>
          <button type="button" onClick={reset}>Try again</button>
        </div>
      )}
    </div>
  );
}
```

---

## 3. `PayWithNaira`

A drop-in UI component providing a complete payment button, anchor popup launcher, fallback link for blocked popups, and live status updates.

### Props

```typescript
interface PayWithNairaProps {
  ramp: Ramp;
  assetCode: string;
  amount?: string;
  onComplete?: () => void;
  onError?: (error: NairaRampError) => void;
  label?: string;
}
```

- `ramp` *(required)*: `Ramp` instance from `@nairaramp/core`.
- `assetCode` *(required)*: Stellar asset code (e.g., `"USDC"`).
- `amount` *(optional)*: Fiat or crypto amount passed to `ramp.deposit`.
- `onComplete` *(optional)*: Callback invoked exactly once when the transaction completes.
- `onError` *(optional)*: Callback invoked exactly once when the transaction fails.
- `label` *(optional)*: Button label in idle state (defaults to `"Pay with Naira"`).

### Behavior per Phase

- **`idle`**: Renders a primary button with `label` (defaults to `"Pay with Naira"`). On click, synchronously calls `window.open("", "nairaramp_anchor")` *before* awaiting deposit initiation. When the URL arrives, redirects the popup via `popup.location.href = url`. If `start()` fails, closes the popup.
- **`starting`**: Renders a disabled button with text `"Connecting..."`.
- **`awaiting_user`**: Displays `"Complete the steps in the anchor window"`. If popup was blocked (`window.open` returned `null`), renders fallback link `"Continue to the anchor"` (`target="_blank" rel="noopener noreferrer"`).
- **`processing`**: Displays `"Processing your payment"`.
- **`completed`**: Displays `"Payment completed"`. Fires `onComplete` callback once.
- **`failed`**: Displays the failure message and a `"Try again"` button that invokes `reset()`. Fires `onError` callback once.

### Accessibility Notes

- **Visible Focus**: All interactive buttons and links feature visible focus outlines compliant with WCAG 2.4.7.
- **Button Semantics**: All buttons specify `type="button"`.
- **Screen Reader Announcements**: Status transitions are announced via an `aria-live="polite"` region with `aria-atomic="true"`.
- **Responsive Sizing**: Inline styles specify `width: "100%"`, `maxWidth: "420px"`, and `boxSizing: "border-box"`, remaining legible and functional on 360px mobile viewports.

### Example

```tsx
import { PayWithNaira } from "@nairaramp/react";
import type { Ramp } from "@nairaramp/core";

function Checkout({ ramp }: { ramp: Ramp }) {
  return (
    <PayWithNaira
      ramp={ramp}
      assetCode="USDC"
      amount="10000"
      label="Fund with NGN"
      onComplete={() => console.log("Payment successful!")}
      onError={(err) => console.error("Payment failed:", err.message)}
    />
  );
}
```

---

## 4. `StatusTimeline`

Visual progress timeline component displaying the 6 sequential steps of an on-chain ramp transaction or a failure notification.

### Props

```typescript
interface StatusTimelineProps {
  status: TransactionStatus | undefined;
  message?: string;
  labels?: Partial<Record<TimelineStep, string>>;
}
```

- `status` *(required)*: Current transaction status from `@nairaramp/core` or `undefined` (defaults to `"Started"` step active).
- `message` *(optional)*: Human-readable status or error message from the anchor.
- `labels` *(optional)*: Custom label map for translating timeline steps.

### Ordered Steps (`TIMELINE_STEPS`)

```typescript
type TimelineStep =
  | "Started"
  | "Waiting for your payment"
  | "Payment received"
  | "Anchor processing"
  | "Sending on Stellar"
  | "Completed";

const TIMELINE_STEPS: readonly TimelineStep[] = [
  "Started",
  "Waiting for your payment",
  "Payment received",
  "Anchor processing",
  "Sending on Stellar",
  "Completed",
] as const;
```

### Status Mapping (`STATUS_MAP`)

All 15 `TransactionStatus` values are mapped through the typed `STATUS_MAP: Record<TransactionStatus, StatusMapping>`:

| Status | Mapping Type | Step Index | Default Label |
| --- | --- | --- | --- |
| `incomplete` | Step | 0 | Started |
| `pending_user_transfer_start` | Step | 1 | Waiting for your payment |
| `pending_user_transfer_complete` | Step | 2 | Payment received |
| `pending_external` | Step | 2 | Payment received |
| `pending_anchor` | Step | 3 | Anchor processing |
| `pending_stellar` | Step | 4 | Sending on Stellar |
| `pending_trust` | Step | 4 | Sending on Stellar |
| `pending_user` | Step | 1 | Waiting for your payment |
| `completed` | Step | 5 | Completed |
| `refunded` | Failure | — | Refunded |
| `expired` | Failure | — | Expired |
| `no_market` | Failure | — | No market |
| `too_small` | Failure | — | Too small |
| `too_large` | Failure | — | Too large |
| `error` | Failure | — | Error |

### Step States

- **Done** (`index < activeIndex`): Displayed with completed green checkmark (`✓`).
- **Active** (`index === activeIndex`): Highlighted in primary color; marked with `aria-current="step"`.
- **Pending** (`index > activeIndex`): Subdued gray styling.

### Failure State

Terminal failure statuses (`refunded`, `expired`, `no_market`, `too_small`, `too_large`, `error`) render a plain failure block with `role="alert"` showing the failure label and the optional anchor `message`.

### Accessibility Notes

- Semantic `<ol aria-label="Payment status timeline">` container.
- Active step element explicitly carries `aria-current="step"`.
- Step number and checkmark badges carry `aria-hidden="true"`.
- Failure container carries `role="alert"`.

### Example

```tsx
import { StatusTimeline } from "@nairaramp/react";
import type { TransactionStatus } from "@nairaramp/core";

function PaymentStatus({ status }: { status: TransactionStatus }) {
  return (
    <StatusTimeline
      status={status}
      message="Waiting for Nigerian bank transfer confirmation"
      labels={{
        "Waiting for your payment": "En attente de paiement",
        "Payment received": "Paiement reçu",
      }}
    />
  );
}
```

### Nigerian Language Label Sets (`YORUBA_LABELS`, `HAUSA_LABELS`, `IGBO_LABELS`, `PIDGIN_LABELS`)

`@nairaramp/react` exports pre-translated `Record<TimelineStep, string>` label dictionaries for Nigeria's most widely spoken languages:

- `YORUBA_LABELS` (Yorùbá)
- `HAUSA_LABELS` (Hausa)
- `IGBO_LABELS` (Igbo)
- `PIDGIN_LABELS` (Nigerian Pidgin)

```tsx
import {
  StatusTimeline,
  YORUBA_LABELS,
  HAUSA_LABELS,
  IGBO_LABELS,
  PIDGIN_LABELS,
} from "@nairaramp/react";
import type { TransactionStatus } from "@nairaramp/core";

type SupportedLocale = "en" | "yo" | "ha" | "ig" | "pcm";

const LOCALE_LABELS = {
  en: undefined,
  yo: YORUBA_LABELS,
  ha: HAUSA_LABELS,
  ig: IGBO_LABELS,
  pcm: PIDGIN_LABELS,
} as const;

function LocalizedPaymentStatus({
  status,
  locale = "pcm",
}: {
  status: TransactionStatus;
  locale?: SupportedLocale;
}) {
  return <StatusTimeline status={status} labels={LOCALE_LABELS[locale]} />;
}
```
