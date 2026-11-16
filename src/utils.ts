import { NairaRampError, isNairaRampError } from "@nairaramp/core";

/**
 * Normalizes any thrown value into a `NairaRampError` instance.
 */
export function ensureNairaRampError(err: unknown): NairaRampError {
  if (isNairaRampError(err)) {
    return err;
  }
  const message = err instanceof Error ? err.message : String(err);
  return new NairaRampError("TRANSACTION_FAILED", message, { cause: err });
}

/**
 * Returns true only for well-formed `http:` or `https:` URLs.
 */
export function isSafeHttpUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

