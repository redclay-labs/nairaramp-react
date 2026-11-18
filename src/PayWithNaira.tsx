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
import { useResolvedTheme, type ThemeMode } from "./theme";
import { isSafeHttpUrl } from "./utils";
import {
  useAnchorPopup,
  rampContainerStyle,
  rampPrimaryButtonStyle,
  rampDisabledButtonStyle,
  rampRetryButtonStyle,
  rampStatusTextStyle,
  rampErrorTextStyle,
  rampLinkStyle,
} from "./useAnchorPopup";

export interface PayWithNairaProps {
  ramp: Ramp;
  assetCode: string;
  amount?: string;
  onComplete?: () => void;
  onError?: (error: NairaRampError) => void;
  label?: string;
  theme?: ThemeMode;
  className?: string;
  style?: CSSProperties;
}

export function PayWithNaira({
  ramp,
  assetCode,
  amount,
  onComplete,
  onError,
  label = "Pay with Naira",
  theme = "system",
  className,
  style,
}: PayWithNairaProps): ReactElement {
  const tokens = useResolvedTheme(theme);
  const { start, phase, error, url, reset } = usePayWithNaira({
    ramp,
    assetCode,
  });
  const {
    popupBlocked,
    openPopup,
    navigatePopup,
    closePopup,
    clearPopupBlocked,
  } = useAnchorPopup();

  const [isPrimaryFocused, setIsPrimaryFocused] = useState<boolean>(false);
  const [isRetryFocused, setIsRetryFocused] = useState<boolean>(false);
  const [isLinkFocused, setIsLinkFocused] = useState<boolean>(false);

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

  const handleClick = useCallback(async () => {
    const popup = openPopup();
    const result = await start(amount);
    navigatePopup(popup, result?.url);
  }, [openPopup, start, amount, navigatePopup]);

  const handleRetry = useCallback(() => {
    clearPopupBlocked();
    closePopup();
    completedFiredRef.current = false;
    errorFiredRef.current = false;
    reset();
  }, [clearPopupBlocked, closePopup, reset]);

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
    <div className={className} style={{ ...rampContainerStyle, color: tokens.text, ...style }}>
      {phase === "idle" && (
        <button
          type="button"
          onClick={handleClick}
          onFocus={() => setIsPrimaryFocused(true)}
          onBlur={() => setIsPrimaryFocused(false)}
          style={{
            ...rampPrimaryButtonStyle,
            color: tokens.primaryBtnText,
            backgroundColor: tokens.primaryBtnBg,
            outline: isPrimaryFocused
              ? `3px solid ${tokens.focusPrimary}`
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
            style={{
              ...rampDisabledButtonStyle,
              color: tokens.disabledBtnText,
              backgroundColor: tokens.disabledBtnBg,
            }}
          >
            Connecting...
          </button>
        )}

        {phase === "awaiting_user" && (
          <div>
            <p style={{ ...rampStatusTextStyle, color: tokens.secondaryText }}>
              Complete the steps in the anchor window
            </p>
            {popupBlocked && url && isSafeHttpUrl(url) && (
              <p style={{ margin: "8px 0 0 0" }}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onFocus={() => setIsLinkFocused(true)}
                  onBlur={() => setIsLinkFocused(false)}
                  style={{
                    ...rampLinkStyle,
                    color: tokens.linkText,
                    outline: isLinkFocused
                      ? `2px solid ${tokens.focusAccent}`
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
          <p style={{ ...rampStatusTextStyle, color: tokens.secondaryText }}>
            Processing your payment
          </p>
        )}

        {phase === "completed" && (
          <p style={{ ...rampStatusTextStyle, color: tokens.secondaryText }}>
            Payment completed
          </p>
        )}

        {phase === "failed" && (
          <div>
            <p style={{ ...rampErrorTextStyle, color: tokens.errorText }}>
              {error?.message ?? "Payment failed"}
            </p>
            <button
              type="button"
              onClick={handleRetry}
              onFocus={() => setIsRetryFocused(true)}
              onBlur={() => setIsRetryFocused(false)}
              style={{
                ...rampRetryButtonStyle,
                color: tokens.retryBtnText,
                backgroundColor: tokens.retryBtnBg,
                border: `1px solid ${tokens.retryBtnBorder}`,
                outline: isRetryFocused
                  ? `2px solid ${tokens.focusAccent}`
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
