import type { ReactElement, CSSProperties } from "react";
import type { TransactionStatus } from "@nairaramp/core";

export type TimelineStep =
  | "Started"
  | "Waiting for your payment"
  | "Payment received"
  | "Anchor processing"
  | "Sending on Stellar"
  | "Completed";

export const TIMELINE_STEPS: readonly TimelineStep[] = [
  "Started",
  "Waiting for your payment",
  "Payment received",
  "Anchor processing",
  "Sending on Stellar",
  "Completed",
] as const;

export const YORUBA_LABELS: Record<TimelineStep, string> = {
  Started: "Bẹrẹ",
  "Waiting for your payment": "Nduro de owo rẹ",
  "Payment received": "A ti gba owo",
  "Anchor processing": "Anchor n ṣiṣẹ lori rẹ",
  "Sending on Stellar": "Nfi ranṣẹ lori Stellar",
  Completed: "Pari",
};

export const HAUSA_LABELS: Record<TimelineStep, string> = {
  Started: "An fara",
  "Waiting for your payment": "Ana jiran biyan ku",
  "Payment received": "An karɓi biya",
  "Anchor processing": "Anchor yana sarrafawa",
  "Sending on Stellar": "Ana aikawa ta Stellar",
  Completed: "An kammala",
};

export const IGBO_LABELS: Record<TimelineStep, string> = {
  Started: "Amalitela",
  "Waiting for your payment": "Na-eche ugwo gi",
  "Payment received": "Anatala ugwo",
  "Anchor processing": "Anchor na-arụ ọrụ",
  "Sending on Stellar": "Na-eziga na Stellar",
  Completed: "Emechala",
};

export const PIDGIN_LABELS: Record<TimelineStep, string> = {
  Started: "Don start",
  "Waiting for your payment": "Dey wait for your money",
  "Payment received": "We don collect the money",
  "Anchor processing": "Anchor dey process am",
  "Sending on Stellar": "Dey send am on Stellar",
  Completed: "Don finish",
};

export interface StepStatusMapping {
  kind: "step";
  stepIndex: number;
  label: TimelineStep;
}

export interface FailureStatusMapping {
  kind: "failure";
  label: string;
}

export type StatusMapping = StepStatusMapping | FailureStatusMapping;

export const STATUS_MAP: Record<TransactionStatus, StatusMapping> = {
  incomplete: {
    kind: "step",
    stepIndex: 0,
    label: "Started",
  },
  pending_user_transfer_start: {
    kind: "step",
    stepIndex: 1,
    label: "Waiting for your payment",
  },
  pending_user_transfer_complete: {
    kind: "step",
    stepIndex: 2,
    label: "Payment received",
  },
  pending_external: {
    kind: "step",
    stepIndex: 2,
    label: "Payment received",
  },
  pending_anchor: {
    kind: "step",
    stepIndex: 3,
    label: "Anchor processing",
  },
  pending_stellar: {
    kind: "step",
    stepIndex: 4,
    label: "Sending on Stellar",
  },
  pending_trust: {
    kind: "step",
    stepIndex: 4,
    label: "Sending on Stellar",
  },
  pending_user: {
    kind: "step",
    stepIndex: 1,
    label: "Waiting for your payment",
  },
  completed: {
    kind: "step",
    stepIndex: 5,
    label: "Completed",
  },
  refunded: {
    kind: "failure",
    label: "Refunded",
  },
  expired: {
    kind: "failure",
    label: "Expired",
  },
  no_market: {
    kind: "failure",
    label: "No market",
  },
  too_small: {
    kind: "failure",
    label: "Too small",
  },
  too_large: {
    kind: "failure",
    label: "Too large",
  },
  error: {
    kind: "failure",
    label: "Error",
  },
};

export interface StatusTimelineProps {
  status: TransactionStatus | string | undefined;
  message?: string;
  labels?: Partial<Record<TimelineStep, string>>;
  className?: string;
  style?: CSSProperties;
}

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  boxSizing: "border-box",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: "15px",
  lineHeight: 1.5,
  color: "#111827",
};

const listStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const failureContainerStyle: CSSProperties = {
  ...containerStyle,
  padding: "16px",
  borderRadius: "8px",
  backgroundColor: "#fef2f2",
  border: "1px solid #fee2e2",
  textAlign: "center",
};

const failureTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 600,
  color: "#991b1b",
};

const messageTextStyle: CSSProperties = {
  margin: "6px 0 0 0",
  fontSize: "14px",
  color: "#4b5563",
};

function resolveStatusMapping(
  status: TransactionStatus | string | undefined
): StatusMapping {
  if (status === undefined) {
    return {
      kind: "step",
      stepIndex: 0,
      label: "Started",
    };
  }
  if (Object.prototype.hasOwnProperty.call(STATUS_MAP, status)) {
    return STATUS_MAP[status as TransactionStatus];
  }
  return {
    kind: "failure",
    label: "Unknown status",
  };
}

export function StatusTimeline({
  status,
  message,
  labels,
  className,
  style,
}: StatusTimelineProps): ReactElement {
  const mapping = resolveStatusMapping(status);

  if (mapping.kind === "failure") {
    return (
      <div
        className={className}
        style={{ ...failureContainerStyle, ...style }}
        role="alert"
      >
        <p style={failureTitleStyle}>{mapping.label}</p>
        {message && <p style={messageTextStyle}>{message}</p>}
      </div>
    );
  }

  const activeIndex = mapping.stepIndex;

  return (
    <div className={className} style={{ ...containerStyle, ...style }}>
      <ol style={listStyle} aria-label="Payment status timeline">
        {TIMELINE_STEPS.map((step, index) => {
          const isDone = index < activeIndex;
          const isActive = index === activeIndex;

          const displayLabel = labels?.[step] ?? step;

          const itemStyle: CSSProperties = {
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: isActive
              ? "#111827"
              : isDone
              ? "#059669"
              : "#9ca3af",
            fontWeight: isActive ? 600 : isDone ? 500 : 400,
          };

          const badgeStyle: CSSProperties = {
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: 700,
            boxSizing: "border-box",
            backgroundColor: isActive
              ? "#2563eb"
              : isDone
              ? "#059669"
              : "#e5e7eb",
            color: isActive || isDone ? "#ffffff" : "#6b7280",
          };

          return (
            <li
              key={step}
              aria-current={isActive ? "step" : undefined}
              style={itemStyle}
            >
              <span style={badgeStyle} aria-hidden="true">
                {isDone ? "✓" : index + 1}
              </span>
              <span>{displayLabel}</span>
            </li>
          );
        })}
      </ol>
      {message && <p style={messageTextStyle}>{message}</p>}
    </div>
  );
}
