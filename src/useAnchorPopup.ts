import { useState, useRef, useCallback, useEffect, type CSSProperties } from "react";
import { isSafeHttpUrl } from "./utils";

export const rampContainerStyle: CSSProperties = {
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

export const rampPrimaryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  color: "#ffffff",
  backgroundColor: "#059669",
};

export const rampDisabledButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  color: "#ffffff",
  backgroundColor: "#9ca3af",
  cursor: "not-allowed",
  opacity: 0.8,
};

export const rampRetryButtonStyle: CSSProperties = {
  ...baseButtonStyle,
  marginTop: "12px",
  padding: "10px 16px",
  fontSize: "15px",
  color: "#1f2937",
  backgroundColor: "#f3f4f6",
  border: "1px solid #d1d5db",
};

export const rampStatusTextStyle: CSSProperties = {
  margin: "8px 0",
  fontSize: "16px",
  fontWeight: 500,
  color: "#1f2937",
};

export const rampErrorTextStyle: CSSProperties = {
  margin: "8px 0",
  fontSize: "15px",
  fontWeight: 500,
  color: "#b91c1c",
  wordBreak: "break-word",
};

export const rampLinkStyle: CSSProperties = {
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  color: "#2563eb",
  textDecoration: "underline",
  wordBreak: "break-all",
  cursor: "pointer",
};

export interface UseAnchorPopupResult {
  popupBlocked: boolean;
  openPopup: () => Window | null;
  navigatePopup: (popup: Window | null, targetUrl: string | undefined) => void;
  closePopup: () => void;
  clearPopupBlocked: () => void;
}

/**
 * Shared popup window manager for interactive SEP-24 flows.
 * Opens synchronously on click to satisfy popup blockers and closes on failure/unmount.
 */
export function useAnchorPopup(): UseAnchorPopupResult {
  const [popupBlocked, setPopupBlocked] = useState<boolean>(false);
  const popupRef = useRef<Window | null>(null);

  const closePopup = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch {
        // ignore cross-origin or browser-blocked close errors
      }
      popupRef.current = null;
    }
  }, []);

  const openPopup = useCallback((): Window | null => {
    setPopupBlocked(false);
    let popup: Window | null = null;
    if (typeof window !== "undefined" && typeof window.open === "function") {
      try {
        popup = window.open("", "nairaramp_anchor");
      } catch {
        popup = null;
      }
    }
    popupRef.current = popup;
    if (!popup) {
      setPopupBlocked(true);
    }
    return popup;
  }, []);

  const navigatePopup = useCallback(
    (popup: Window | null, targetUrl: string | undefined) => {
      if (targetUrl && isSafeHttpUrl(targetUrl)) {
        if (popup && !popup.closed) {
          popup.location.href = targetUrl;
        }
      } else {
        closePopup();
      }
    },
    [closePopup]
  );

  const clearPopupBlocked = useCallback(() => {
    setPopupBlocked(false);
  }, []);

  useEffect(() => {
    return () => {
      closePopup();
    };
  }, [closePopup]);

  return {
    popupBlocked,
    openPopup,
    navigatePopup,
    closePopup,
    clearPopupBlocked,
  };
}

