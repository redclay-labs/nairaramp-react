import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactElement,
  type CSSProperties,
} from "react";
import {
  type Ramp,
  type NairaRampError,
  NairaRampError as NairaRampErrorClass,
} from "@nairaramp/core";
import { usePayWithNaira } from "./usePayWithNaira";

export interface PayWithNairaProps {
  ramp: Ramp;
  assetCode: string;
  amount?: string;
  onComplete?: () => void;
  onError?: (error: NairaRampError) => void;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  boxSizing: "border-box",
  fontFamily:
    "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: "16px",
  lineHeight: 1.5,
  color: "#111827",
  textAlign: "center",
};

const baseButtonStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 16px",
  fontSize: "16px",
  fontWeight: 600,
  borderRadius: "8px",
  border: "1px solid transparent",
  cursor: "pointer",
  textAlign: "center",
  display: "inline-block",
  transition: "outline 0.15s ease",
};

const primaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  color: "#ffffff",
  backgroundColor: "#059669",
};

const disabledButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  color: "#ffffff",
  backgroundColor: "#9ca3af",
  cursor: "not-allowed",
  opacity: 0.8,
};

const retryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  marginTop: "12px",
  padding: "10px 16px",
  fontSize: "15px",
  color: "#1f2937",
  backgroundColor: "#f3f4f6",
  border: "1px solid #d1d5db",
};

const statusTextStyle: CSSProperties = {
  margin: "8px 0",
  fontSize: "16px",
  fontWeight: 500,
  color: "#1f2937",
};

const errorTextStyle: CSSProperties = {
  margin: "8px 0",
  fontSize: "15px",
  fontWeight: 500,
  color: "#b91c1c",
  wordBreak: "break-word",
};

const linkStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  color: "#2563eb",
  textDecoration: "underline",
  wordBreak: "break-all",
  cursor: "pointer",
};

export function PayWithNaira({
  ramp,
  assetCode,
  amount,
  onComplete,
  onError,
  label = "Pay with Naira",
  className,
  style,
}: PayWithNairaProps): ReactElement {
  const { start, phase, error, url, reset } = usePayWithNaira({
    ramp,
    assetCode,
  });

  const [popupBlocked, setPopupBlocked] = useState<boolean>(false);
  const [isPrimaryFocused, setIsPrimaryFocused] = useState<boolean>(false);
  const [isRetryFocused, setIsRetryFocused] = useState<boolean>(false);
  const [isLinkFocused, setIsLinkFocused] = useState<boolean>(false);

  const popupRef = useRef<Window | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const completedFiredRef = useRef<boolean>(false);
  const errorFiredRef = useRef<boolean>(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  const closePopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch {
        // ignore
      }
      popupRef.current = null;
    }
  }, []);

  const handleClick = useCallback(async () => {
    setPopupBlocked(false);
    let popup: Window | null = null;
    try {
      popup = window.open("", "nairaramp_anchor");
    } catch {
      popup = null;
    }
    popupRef.current = popup;
    if (!popup) {
      setPopupBlocked(true);
    }

    try {
      const result = await start(amount);
      if (result?.url) {
        if (popup && !popup.closed) {
          popup.location.href = result.url;
        }
      } else {
        closePopup();
      }
    } catch {
      closePopup();
    }
  }, [start, amount, closePopup]);

  const handleRetry = useCallback(() => {
    setPopupBlocked(false);
    closePopup();
    completedFiredRef.current = false;
    errorFiredRef.current = false;
    reset();
  }, [reset, closePopup]);

  useEffect(() => {
    if (phase === "completed") {
      if (!completedFiredRef.current) {
        completedFiredRef.current = true;
        onCompleteRef.current?.();
      }
    } else if (phase === "failed") {
      closePopup();
      if (!errorFiredRef.current) {
        errorFiredRef.current = true;
        const finalError =
          error ?? new NairaRampErrorClass("TRANSACTION_FAILED", "Payment failed");
        onErrorRef.current?.(finalError);
      }
    } else if (phase === "idle") {
      completedFiredRef.current = false;
      errorFiredRef.current = false;
    }
  }, [phase, error, closePopup]);

  return (
    <div className={className} style={{ ...containerStyle, ...style }}>
      {phase === "idle" && (
        <button
          type="button"
          onClick={handleClick}
          onFocus={() => setIsPrimaryFocused(true)}
          onBlur={() => setIsPrimaryFocused(false)}
          style={{
            ...primaryButtonStyle,
            outline: isPrimaryFocused
              ? "3px solid #047857"
              : "2px solid transparent",
            outlineOffset: "2px",
          }}
        >
          {label}
        </button>
      )}

      <div aria-live="polite" aria-atomic="true">
        {phase === "starting" && (
          <button
            type="button"
            disabled
            style={disabledButtonStyle}
          >
            Connecting...
          </button>
        )}

        {phase === "awaiting_user" && (
          <div>
            <p style={statusTextStyle}>
              Complete the steps in the anchor window
            </p>
            {popupBlocked && url && (
              <p style={{ margin: "8px 0 0 0" }}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onFocus={() => setIsLinkFocused(true)}
                  onBlur={() => setIsLinkFocused(false)}
                  style={{
                    ...linkStyle,
                    outline: isLinkFocused
                      ? "2px solid #2563eb"
                      : "2px solid transparent",
                    outlineOffset: "2px",
                  }}
                >
                  Continue to the anchor
                </a>
              </p>
            )}
          </div>
        )}

        {phase === "processing" && (
          <p style={statusTextStyle}>Processing your payment</p>
        )}

        {phase === "completed" && (
          <p style={statusTextStyle}>Payment completed</p>
        )}

        {phase === "failed" && (
          <div>
            <p style={errorTextStyle}>{error?.message ?? "Payment failed"}</p>
            <button
              type="button"
              onClick={handleRetry}
              onFocus={() => setIsRetryFocused(true)}
              onBlur={() => setIsRetryFocused(false)}
              style={{
                ...retryButtonStyle,
                outline: isRetryFocused
                  ? "2px solid #2563eb"
                  : "2px solid transparent",
                outlineOffset: "2px",
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
