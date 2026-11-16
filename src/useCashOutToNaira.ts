import { useState, useCallback, useRef, useEffect } from "react";
import {
  type Ramp,
  type TransactionStatus,
  type AnchorTransaction,
  TERMINAL_STATUSES,
  NairaRampError,
} from "@nairaramp/core";
import { ensureNairaRampError } from "./utils";

export type CashOutToNairaPhase =
  | "idle"
  | "starting"
  | "awaiting_user"
  | "completing"
  | "processing"
  | "completed"
  | "failed";

export interface UseCashOutToNairaOptions {
  ramp: Ramp;
  assetCode: string;
}

export interface UseCashOutToNairaResult {
  start: (amount?: string) => Promise<{ id: string; url: string } | undefined>;
  phase: CashOutToNairaPhase;
  status: TransactionStatus | string | undefined;
  transactionId: string | undefined;
  url: string | undefined;
  txHash: string | undefined;
  error: NairaRampError | undefined;
  reset: () => void;
}

export function useCashOutToNaira({
  ramp,
  assetCode,
}: UseCashOutToNairaOptions): UseCashOutToNairaResult {
  const [phase, setPhase] = useState<CashOutToNairaPhase>("idle");
  const [status, setStatus] = useState<TransactionStatus | string | undefined>(undefined);
  const [transactionId, setTransactionId] = useState<string | undefined>(undefined);
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [txHash, setTxHash] = useState<string | undefined>(undefined);
  const [error, setError] = useState<NairaRampError | undefined>(undefined);

  const phaseRef = useRef<CashOutToNairaPhase>("idle");
  const subscriptionRef = useRef<{ stop: () => void } | undefined>(undefined);
  const isMountedRef = useRef<boolean>(true);
  const completionStartedRef = useRef<boolean>(false);

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
    stopWatcher();
    phaseRef.current = "idle";
    completionStartedRef.current = false;
    if (isMountedRef.current) {
      setPhase("idle");
      setStatus(undefined);
      setTransactionId(undefined);
      setUrl(undefined);
      setTxHash(undefined);
      setError(undefined);
    }
  }, [stopWatcher]);

  const start = useCallback(
    async (amount?: string): Promise<{ id: string; url: string } | undefined> => {
      if (phaseRef.current !== "idle") {
        return undefined;
      }

      completionStartedRef.current = false;
      phaseRef.current = "starting";
      if (isMountedRef.current) {
        setPhase("starting");
        setError(undefined);
        setTxHash(undefined);
      }

      let withdrawResult: { id: string; url: string };
      try {
        withdrawResult = await ramp.withdraw({
          assetCode,
          ...(amount !== undefined ? { amount } : {}),
        });
      } catch (err) {
        const wrapped = ensureNairaRampError(err);
        phaseRef.current = "failed";
        if (isMountedRef.current) {
          setError(wrapped);
          setPhase("failed");
        }
        return undefined;
      }

      if (!isMountedRef.current) {
        return undefined;
      }

      const { id, url: hostedUrl } = withdrawResult;
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
          if (!isMountedRef.current) return;
          setStatus(nextStatus);

          if (nextStatus === "completed") {
            stopWatcher();
            phaseRef.current = "completed";
            setPhase("completed");
            return;
          }

          if ((TERMINAL_STATUSES as readonly string[]).includes(nextStatus)) {
            stopWatcher();
            const detail = transaction?.message
              ? `Transaction ${nextStatus}: ${transaction.message}`
              : `Transaction ${nextStatus}`;
            setError(new NairaRampError("TRANSACTION_FAILED", detail));
            phaseRef.current = "failed";
            setPhase("failed");
            return;
          }

          if (nextStatus === "pending_user_transfer_start") {
            if (!completionStartedRef.current) {
              completionStartedRef.current = true;
              phaseRef.current = "completing";
              setPhase("completing");
              ramp
                .completeWithdrawal(id)
                .then(({ hash }) => {
                  if (!isMountedRef.current) return;
                  setTxHash(hash);
                  if (phaseRef.current === "completing") {
                    phaseRef.current = "processing";
                    setPhase("processing");
                  }
                })
                .catch((err) => {
                  if (!isMountedRef.current) return;
                  stopWatcher();
                  setError(ensureNairaRampError(err));
                  phaseRef.current = "failed";
                  setPhase("failed");
                });
            }
            return;
          }

          if (nextStatus === "incomplete" || nextStatus === "pending_user") {
            phaseRef.current = "awaiting_user";
            setPhase("awaiting_user");
          } else {
            phaseRef.current = "processing";
            setPhase("processing");
          }
        },
        onComplete: () => {
          if (!isMountedRef.current) return;
          stopWatcher();
          setStatus("completed");
          phaseRef.current = "completed";
          setPhase("completed");
        },
        onError: (err: NairaRampError) => {
          if (!isMountedRef.current) return;
          stopWatcher();
          setError(ensureNairaRampError(err));
          phaseRef.current = "failed";
          setPhase("failed");
        },
      });

      subscriptionRef.current = subscription;
      return withdrawResult;
    },
    [ramp, assetCode, stopWatcher]
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopWatcher();
    };
  }, [stopWatcher]);

  return {
    start,
    phase,
    status,
    transactionId,
    url,
    txHash,
    error,
    reset,
  };
}

