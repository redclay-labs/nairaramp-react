import { useState, useCallback, useRef, useEffect } from "react";
import {
  type Ramp,
  type TransactionStatus,
  type AnchorTransaction,
  TERMINAL_STATUSES,
  NairaRampError,
} from "@nairaramp/core";
import { ensureNairaRampError } from "./utils";

export type PayWithNairaPhase =
  | "idle"
  | "starting"
  | "awaiting_user"
  | "processing"
  | "completed"
  | "failed";

export interface UsePayWithNairaOptions {
  ramp: Ramp;
  assetCode: string;
}

export interface UsePayWithNairaResult {
  start: (amount?: string) => Promise<{ id: string; url: string } | undefined>;
  phase: PayWithNairaPhase;
  status: TransactionStatus | string | undefined;
  transactionId: string | undefined;
  url: string | undefined;
  error: NairaRampError | undefined;
  reset: () => void;
}

export function usePayWithNaira({
  ramp,
  assetCode,
}: UsePayWithNairaOptions): UsePayWithNairaResult {
  const [phase, setPhase] = useState<PayWithNairaPhase>("idle");
  const [status, setStatus] = useState<TransactionStatus | string | undefined>(undefined);
  const [transactionId, setTransactionId] = useState<string | undefined>(undefined);
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<NairaRampError | undefined>(undefined);

  const phaseRef = useRef<PayWithNairaPhase>("idle");
  const subscriptionRef = useRef<{ stop: () => void } | undefined>(undefined);
  const isMountedRef = useRef<boolean>(true);
  const attemptIdRef = useRef<number>(0);

  // Keep phaseRef in sync with state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopWatcher = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.stop();
      subscriptionRef.current = undefined;
    }
  }, []);

  const reset = useCallback(() => {
    attemptIdRef.current += 1;
    stopWatcher();
    phaseRef.current = "idle";
    if (isMountedRef.current) {
      setPhase("idle");
      setStatus(undefined);
      setTransactionId(undefined);
      setUrl(undefined);
      setError(undefined);
    }
  }, [stopWatcher]);

  const start = useCallback(
    async (amount?: string): Promise<{ id: string; url: string } | undefined> => {
      if (phaseRef.current !== "idle") {
        return undefined;
      }

      const attemptId = ++attemptIdRef.current;
      phaseRef.current = "starting";
      if (isMountedRef.current) {
        setPhase("starting");
        setError(undefined);
      }

      let depositResult: { id: string; url: string };
      try {
        depositResult = await ramp.deposit({
          assetCode,
          ...(amount !== undefined ? { amount } : {}),
        });
      } catch (err) {
        if (!isMountedRef.current || attemptId !== attemptIdRef.current) {
          return undefined;
        }
        const wrapped = ensureNairaRampError(err);
        phaseRef.current = "failed";
        setError(wrapped);
        setPhase("failed");
        return undefined;
      }

      if (!isMountedRef.current || attemptId !== attemptIdRef.current) {
        return undefined;
      }

      const { id, url: hostedUrl } = depositResult;
      setTransactionId(id);
      setUrl(hostedUrl);
      phaseRef.current = "awaiting_user";
      setPhase("awaiting_user");

      stopWatcher();

      const subscription = ramp.watch(id, {
        onStatus: (
          nextStatus: TransactionStatus | string,
          transaction?: AnchorTransaction
        ) => {
          if (!isMountedRef.current || attemptId !== attemptIdRef.current) return;
          setStatus(nextStatus);

          if (nextStatus === "completed") {
            stopWatcher();
            phaseRef.current = "completed";
            setPhase("completed");
          } else if (
            (TERMINAL_STATUSES as readonly string[]).includes(nextStatus)
          ) {
            stopWatcher();
            const detail = transaction?.message
              ? `Transaction ${nextStatus}: ${transaction.message}`
              : `Transaction ${nextStatus}`;
            setError(new NairaRampError("TRANSACTION_FAILED", detail));
            phaseRef.current = "failed";
            setPhase("failed");
          } else if (
            nextStatus === "pending_user_transfer_start" ||
            nextStatus === "incomplete"
          ) {
            phaseRef.current = "awaiting_user";
            setPhase("awaiting_user");
          } else {
            phaseRef.current = "processing";
            setPhase("processing");
          }
        },
        onComplete: () => {
          if (!isMountedRef.current || attemptId !== attemptIdRef.current) return;
          stopWatcher();
          setStatus("completed");
          phaseRef.current = "completed";
          setPhase("completed");
        },
        onError: (err: NairaRampError) => {
          if (!isMountedRef.current || attemptId !== attemptIdRef.current) return;
          stopWatcher();
          const wrapped = ensureNairaRampError(err);
          setError(wrapped);
          phaseRef.current = "failed";
          setPhase("failed");
        },
      });

      subscriptionRef.current = subscription;
      return depositResult;
    },
    [ramp, assetCode, stopWatcher]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      attemptIdRef.current += 1;
      stopWatcher();
    };
  }, [stopWatcher]);

  return {
    start,
    phase,
    status,
    transactionId,
    url,
    error,
    reset,
  };
}
