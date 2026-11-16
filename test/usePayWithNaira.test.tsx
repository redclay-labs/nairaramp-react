import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePayWithNaira } from "../src/usePayWithNaira";
import {
  type Ramp,
  type AnchorTransaction,
  NairaRampError,
  type WatchHandlers,
  type WatchSubscription,
} from "@nairaramp/core";

const mockTransaction = {
  id: "tx-123",
  status: "completed",
} as unknown as AnchorTransaction;

function createFakeRamp(overrides?: {
  depositImpl?: (options: { assetCode: string; amount?: string }) => Promise<{ id: string; url: string }>;
  watchImpl?: (id: string, handlers: WatchHandlers) => WatchSubscription;
}) {
  let capturedHandlers: WatchHandlers | undefined;
  const stopFn = vi.fn();

  const defaultDeposit = vi.fn().mockResolvedValue({
    id: "tx-123",
    url: "https://anchor.example.com/sep24/interactive?id=tx-123",
  });

  const defaultWatch = vi.fn().mockImplementation((_id: string, handlers: WatchHandlers) => {
    capturedHandlers = handlers;
    return { stop: stopFn };
  });

  const ramp = {
    anchor: {
      id: "test-anchor",
      name: "Test Anchor",
      homeDomain: "anchor.example.com",
      network: "testnet",
      assets: [{ code: "NGNC", issuer: "G..." }],
      seps: ["sep24"],
      countries: ["NG"],
      verifiedAt: "2026-11-08",
    },
    authenticate: vi.fn(),
    deposit: overrides?.depositImpl ?? defaultDeposit,
    withdraw: vi.fn(),
    getTransaction: vi.fn(),
    completeWithdrawal: vi.fn(),
    watch: overrides?.watchImpl ?? defaultWatch,
    getPrice: vi.fn(),
  } as unknown as Ramp;

  return {
    ramp,
    stopFn,
    getHandlers: () => capturedHandlers,
  };
}

describe("usePayWithNaira", () => {
  it("initializes with idle phase and undefined states", () => {
    const { ramp } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    expect(result.current.phase).toBe("idle");
    expect(result.current.status).toBeUndefined();
    expect(result.current.transactionId).toBeUndefined();
    expect(result.current.url).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it("handles standard start flow through awaiting_user and watcher activation", async () => {
    const { ramp, getHandlers } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    let startPromise: Promise<{ id: string; url: string } | undefined>;
    act(() => {
      startPromise = result.current.start("5000");
    });

    // Enters starting phase
    expect(result.current.phase).toBe("starting");

    const res = await act(async () => {
      return await startPromise;
    });

    expect(res).toEqual({
      id: "tx-123",
      url: "https://anchor.example.com/sep24/interactive?id=tx-123",
    });
    expect(result.current.phase).toBe("awaiting_user");
    expect(result.current.transactionId).toBe("tx-123");
    expect(result.current.url).toBe("https://anchor.example.com/sep24/interactive?id=tx-123");
    expect(ramp.watch).toHaveBeenCalledWith("tx-123", expect.any(Object));
    expect(getHandlers()).toBeDefined();
  });

  it("transitions phase accurately on watcher onStatus updates", async () => {
    const { ramp, getHandlers } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.phase).toBe("awaiting_user");

    const handlers = getHandlers()!;

    // Status pending_user_transfer_start keeps awaiting_user
    act(() => {
      handlers.onStatus!("pending_user_transfer_start", mockTransaction);
    });
    expect(result.current.phase).toBe("awaiting_user");
    expect(result.current.status).toBe("pending_user_transfer_start");

    // Status incomplete keeps awaiting_user
    act(() => {
      handlers.onStatus!("incomplete", mockTransaction);
    });
    expect(result.current.phase).toBe("awaiting_user");
    expect(result.current.status).toBe("incomplete");

    // Other non-terminal status transitions to processing
    act(() => {
      handlers.onStatus!("pending_anchor", mockTransaction);
    });
    expect(result.current.phase).toBe("processing");
    expect(result.current.status).toBe("pending_anchor");

    act(() => {
      handlers.onStatus!("pending_stellar", mockTransaction);
    });
    expect(result.current.phase).toBe("processing");
    expect(result.current.status).toBe("pending_stellar");

    // Completed transitions to completed
    act(() => {
      handlers.onStatus!("completed", mockTransaction);
    });
    expect(result.current.phase).toBe("completed");
    expect(result.current.status).toBe("completed");
  });

  it("transitions to failed on terminal statuses other than completed", async () => {
    const terminalStatuses = [
      "refunded",
      "expired",
      "no_market",
      "too_small",
      "too_large",
      "error",
    ] as const;

    for (const termStatus of terminalStatuses) {
      const { ramp, getHandlers, stopFn } = createFakeRamp();
      const { result } = renderHook(() =>
        usePayWithNaira({ ramp, assetCode: "NGNC" })
      );

      await act(async () => {
        await result.current.start();
      });

      act(() => {
        getHandlers()!.onStatus!(termStatus, mockTransaction);
      });

      expect(result.current.phase).toBe("failed");
      expect(result.current.status).toBe(termStatus);
      expect(result.current.error).toBeInstanceOf(NairaRampError);
      expect(result.current.error?.code).toBe("TRANSACTION_FAILED");
      expect(result.current.error?.message).toBe(`Transaction ${termStatus}`);
      expect(stopFn).toHaveBeenCalledTimes(1);
    }
  });

  it("includes anchor message in error on terminal failure status when present", async () => {
    const { ramp, getHandlers, stopFn } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      getHandlers()!.onStatus!("expired", {
        ...mockTransaction,
        message: "Deposit window closed",
      });
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBeInstanceOf(NairaRampError);
    expect(result.current.error?.message).toBe("Transaction expired: Deposit window closed");
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it("transitions to completed on watcher onComplete", async () => {
    const { ramp, getHandlers } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      getHandlers()!.onComplete!(mockTransaction);
    });

    expect(result.current.phase).toBe("completed");
    expect(result.current.status).toBe("completed");
  });

  it("transitions to failed and stores error on watcher onError", async () => {
    const { ramp, getHandlers } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });

    const customErr = new NairaRampError("ANCHOR_UNREACHABLE", "Anchor timeout");
    act(() => {
      getHandlers()!.onError!(customErr);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBe(customErr);
  });

  it("handles deposit rejection with NairaRampError", async () => {
    const customErr = new NairaRampError("UNSUPPORTED_ASSET", "Asset not supported");
    const { ramp } = createFakeRamp({
      depositImpl: vi.fn().mockRejectedValue(customErr),
    });

    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "INVALID" })
    );

    let startResult: { id: string; url: string } | undefined;
    await act(async () => {
      startResult = await result.current.start();
    });

    expect(startResult).toBeUndefined();
    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBe(customErr);
  });

  it("wraps non-NairaRampError into NairaRampError on deposit failure", async () => {
    const rawError = new Error("Network offline");
    const { ramp } = createFakeRamp({
      depositImpl: vi.fn().mockRejectedValue(rawError),
    });

    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBeInstanceOf(NairaRampError);
    expect(result.current.error?.code).toBe("TRANSACTION_FAILED");
    expect(result.current.error?.message).toBe("Network offline");
    expect(result.current.error?.cause).toBe(rawError);
  });

  it("ignores double start calls when not in idle phase", async () => {
    const { ramp } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.phase).toBe("awaiting_user");

    // Second start while awaiting_user
    let secondResult: { id: string; url: string } | undefined;
    await act(async () => {
      secondResult = await result.current.start();
    });

    expect(secondResult).toBeUndefined();
    expect(ramp.deposit).toHaveBeenCalledTimes(1);
  });

  it("stops watcher and resets state on reset()", async () => {
    const { ramp, stopFn } = createFakeRamp();
    const { result } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.phase).toBe("awaiting_user");
    expect(stopFn).not.toHaveBeenCalled();

    act(() => {
      result.current.reset();
    });

    expect(stopFn).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("idle");
    expect(result.current.status).toBeUndefined();
    expect(result.current.transactionId).toBeUndefined();
    expect(result.current.url).toBeUndefined();
    expect(result.current.error).toBeUndefined();

    // Able to start again after reset
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.phase).toBe("awaiting_user");
    expect(ramp.deposit).toHaveBeenCalledTimes(2);
  });

  it("stops watcher on unmount and ignores post-unmount updates", async () => {
    const { ramp, stopFn, getHandlers } = createFakeRamp();
    const { result, unmount } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    await act(async () => {
      await result.current.start();
    });

    const handlers = getHandlers()!;
    expect(stopFn).not.toHaveBeenCalled();

    unmount();
    expect(stopFn).toHaveBeenCalledTimes(1);

    // Callbacks after unmount should not throw or update state
    act(() => {
      handlers.onStatus!("completed", mockTransaction);
      handlers.onComplete!(mockTransaction);
      handlers.onError!(new NairaRampError("TRANSACTION_FAILED", "late error"));
    });
  });

  it("ignores deposit resolution if unmounted while deposit is pending", async () => {
    let resolveDeposit!: (val: { id: string; url: string }) => void;
    const depositPromise = new Promise<{ id: string; url: string }>((resolve) => {
      resolveDeposit = resolve;
    });

    const { ramp } = createFakeRamp({
      depositImpl: vi.fn().mockReturnValue(depositPromise),
    });

    const { result, unmount } = renderHook(() =>
      usePayWithNaira({ ramp, assetCode: "NGNC" })
    );

    let startPromise: Promise<{ id: string; url: string } | undefined>;
    act(() => {
      startPromise = result.current.start();
    });

    unmount();

    const res = await act(async () => {
      resolveDeposit({ id: "tx-late", url: "https://anchor.example.com/late" });
      return await startPromise;
    });

    expect(res).toBeUndefined();
    expect(ramp.watch).not.toHaveBeenCalled();
  });
});
