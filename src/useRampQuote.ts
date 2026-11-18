import { useState, useCallback, useRef, useEffect } from "react";
import {
  type Ramp,
  type Quote,
  type GetPriceOptions,
  NairaRampError,
  isNairaRampError,
} from "@nairaramp/core";
import { useNairaRamp } from "./NairaRampContext";

export interface UseRampQuoteOptions {
  ramp?: Ramp;
  sellAsset: string;
  buyAsset: string;
  sellAmount?: string;
  buyAmount?: string;
  context?: "sep6" | "sep24" | "sep31";
  debounceMs?: number;
  pollIntervalMs?: number;
  enabled?: boolean;
}

export interface UseRampQuoteResult {
  quote: Quote | undefined;
  loading: boolean;
  error: NairaRampError | undefined;
  refresh: () => Promise<void>;
}

function toQuoteError(err: unknown): NairaRampError {
  if (isNairaRampError(err)) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new NairaRampError("QUOTE_UNAVAILABLE", message, { cause: err });
}

export function useRampQuote({
  ramp: rampOption,
  sellAsset,
  buyAsset,
  sellAmount,
  buyAmount,
  context,
  debounceMs = 300,
  pollIntervalMs,
  enabled = true,
}: UseRampQuoteOptions): UseRampQuoteResult {
  const ramp = useNairaRamp(rampOption);
  const [quote, setQuote] = useState<Quote | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<NairaRampError | undefined>(undefined);

  const isMountedRef = useRef<boolean>(true);
  const requestIdRef = useRef<number>(0);

  const hasAmount =
    (sellAmount !== undefined && sellAmount.trim() !== "") ||
    (buyAmount !== undefined && buyAmount.trim() !== "");

  const fetchQuote = useCallback(async () => {
    if (!enabled || !hasAmount) {
      return;
    }

    const reqId = ++requestIdRef.current;
    if (isMountedRef.current) {
      setLoading(true);
      setError(undefined);
    }

    const options: GetPriceOptions = {
      sellAsset,
      buyAsset,
      ...(sellAmount !== undefined && sellAmount.trim() !== "" ? { sellAmount } : {}),
      ...(buyAmount !== undefined && buyAmount.trim() !== "" ? { buyAmount } : {}),
      ...(context !== undefined ? { context } : {}),
    };

    try {
      const nextQuote = await ramp.getPrice(options);
      if (!isMountedRef.current || reqId !== requestIdRef.current) {
        return;
      }
      setQuote(nextQuote);
      setError(undefined);
    } catch (err) {
      if (!isMountedRef.current || reqId !== requestIdRef.current) {
        return;
      }
      setError(toQuoteError(err));
    } finally {
      if (isMountedRef.current && reqId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [ramp, sellAsset, buyAsset, sellAmount, buyAmount, context, enabled, hasAmount]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || !hasAmount) {
      requestIdRef.current++;
      setQuote(undefined);
      setError(undefined);
      setLoading(false);
      return;
    }

    const delay = Math.max(0, debounceMs);
    const debounceTimer = setTimeout(() => {
      void fetchQuote();
    }, delay);

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [enabled, hasAmount, debounceMs, fetchQuote]);

  useEffect(() => {
    if (!enabled || !hasAmount || !pollIntervalMs || pollIntervalMs <= 0) {
      return;
    }

    const interval = setInterval(() => {
      void fetchQuote();
    }, pollIntervalMs);

    return () => {
      clearInterval(interval);
    };
  }, [enabled, hasAmount, pollIntervalMs, fetchQuote]);

  return {
    quote,
    loading,
    error,
    refresh: fetchQuote,
  };
}

