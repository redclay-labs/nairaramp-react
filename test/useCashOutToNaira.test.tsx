import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCashOutToNaira } from "../src/useCashOutToNaira";
import {
  type Ramp,
  type AnchorTransaction,
  NairaRampError,
  type WatchHandlers,
  type WatchSubscription,
} from "@nairaramp/core";

const mockTransaction = {
  id: "wd-123",
  status: "completed",
} as unknown as AnchorTransaction;

function createFakeRamp(overrides?: {
  withdrawImpl?: (options: { assetCode: string; amount?: string }) => Promise<{ id: string; url: string }>;
  completeWithdrawalImpl?: (id: string) => Promise<{ hash: string }>;
  watchImpl?: (id: string, handlers: WatchHandlers) => WatchSubscription;
}) {
  let capturedHandlers: WatchHandlers | undefined;
  const stopFn = vi.fn();

  const defaultWithdraw = vi.fn().mockResolvedValue({
    id: "wd-123",
    url: "https://anchor.example.com/sep24/withdraw?id=wd-123",
  });

  const defaultCompleteWithdrawal = vi.fn().mockResolvedValue({
    hash: "stellar-hash-abc",
  });

  const defaultWatch = vi.fn().mockImplementation((_id: string, handlers: WatchHandlers) => {
    capturedHandlers = handlers;
    return { stop: stopFn };
  });

  const ramp = {
    authenticate: vi.fn(),
    deposit: vi.fn(),
    withdraw: overrides?.withdrawImpl ?? defaultWithdraw,
    getTransaction: vi.fn(),
    completeWithdrawal: overrides?.completeWithdrawalImpl ?? defaultCompleteWithdrawal,
    watch: overrides?.watchImpl ?? defaultWatch,
    getPrice: vi.fn(),
  } as unknown as Ramp;

  return {
    ramp,
    stopFn,
    getHandlers: () => capturedHandlers,
  };
}

describe("useCashOutToNaira", () => {
  it("initializes with idle phase and undefined states", () => {
    const { ramp } = createFakeRamp();
    const { result } = renderHook(() =>
      useCashOutToNaira({ ramp, assetCode: "USDC" })
    );

    expect(result.current.phase).toBe("idle");
    expect(result.current.status).toBeUndefined();
    expect(result.current.transactionId).toBeUndefined();
    expect(result.current.url).toBeUndefined();
    expect(result.current.txHash).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it("handles full withdrawal lifecycle including automatic completeWithdrawal", async () => {
    let resolveComplete!: (val: { hash: string }) => void;
    const completePromise = new Promise<{ hash: string }>((resolve) => {
      resolveComplete = resolve;
    });

    const completeMock = vi.fn().mockReturnValue(completePromise);
    const { ramp, getHandlers, stopFn } = createFakeRamp({
      completeWithdrawalImpl: completeMock,
    });

    const { result } = renderHook(() =>
      useCashOutToNaira({ ramp, assetCode: "USDC" })
    );

    await act(async () => {
      await result.current.start("2500");
    });

    expect(ramp.withdraw).toHaveBeenCalledWith({ assetCode: "USDC", amount: "2500" });
    expect(result.current.phase).toBe("awaiting_user");
    expect(result.current.transactionId).toBe("wd-123");

    const handlers = getHandlers()!;

    // Trigger pending_user_transfer_start twice; completeWithdrawal must only run once
    act(() => {
      handlers.onStatus!("pending_user_transfer_start", mockTransaction);
      handlers.onStatus!("pending_user_transfer_start", mockTransaction);
    });

    expect(result.current.phase).toBe("completing");
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledWith("wd-123");

    await act(async () => {
      resolveComplete({ hash: "stellar-hash-999" });
    });

    expect(result.current.txHash).toBe("stellar-hash-999");
    expect(result.current.phase).toBe("processing");

    act(() => {
      handlers.onStatus!("completed", mockTransaction);
    });

    expect(result.current.phase).toBe("completed");
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it("transitions to failed if completeWithdrawal rejects", async () => {
    const completeMock = vi
      .fn()
      .mockRejectedValue(new NairaRampError("SIGNER_REJECTED", "User declined signing"));
    const { ramp, getHandlers, stopFn } = createFakeRamp({
      completeWithdrawalImpl: completeMock,
    });

    const { result } = renderHook(() =>
      useCashOutToNaira({ ramp, assetCode: "USDC" })
    );

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      getHandlers()!.onStatus!("pending_user_transfer_start", mockTransaction);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBeInstanceOf(NairaRampError);
    expect(result.current.error?.code).toBe("SIGNER_REJECTED");
    expect(stopFn).toHaveBeenCalledTimes(1);
  });

  it("wraps non-NairaRampError on withdraw rejection and ignores double start", async () => {
    const { ramp } = createFakeRamp({
      withdrawImpl: vi.fn().mockRejectedValue(new Error("Anchor offline")),
    });

    const { result } = renderHook(() =>
      useCashOutToNaira({ ramp, assetCode: "USDC" })
    );

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBeInstanceOf(NairaRampError);
    expect(result.current.error?.message).toBe("Anchor offline");

    // Second start while failed should be ignored until reset
    let second: unknown;
    await act(async () => {
      second = await result.current.start();
    });
    expect(second).toBeUndefined();
    expect(ramp.withdraw).toHaveBeenCalledTimes(1);
  });

  it("stops watcher on terminal failure status, reset, and unmount", async () => {
    const { ramp, getHandlers, stopFn } = createFakeRamp();
    const { result, unmount } = renderHook(() =>
      useCashOutToNaira({ ramp, assetCode: "USDC" })
    );

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      getHandlers()!.onStatus!("expired", mockTransaction);
    });

    expect(result.current.phase).toBe("failed");
    expect(result.current.error?.message).toBe("Transaction expired");
    expect(stopFn).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeUndefined();

    await act(async () => {
      await result.current.start();
    });

    unmount();
    expect(stopFn).toHaveBeenCalledTimes(2);
  });

  it("ignores stale withdraw and completeWithdrawal promises after reset()", async () => {
    let resolveWithdraw!: (val: { id: string; url: string }) => void;
    let rejectComplete!: (err: Error) => void;

    const withdrawMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ id: string; url: string }>((resolve) => {
            resolveWithdraw = resolve;
          })
      )
      .mockResolvedValueOnce({
        id: "wd-second",
        url: "https://anchor.example.com/sep24/withdraw?id=wd-second",
      });

    const completeMock = vi.fn().mockImplementation(
      () =>
        new Promise<{ hash: string }>((_resolve, reject) => {
          rejectComplete = reject;
        })
    );

    const { ramp, getHandlers } = createFakeRamp({
      withdrawImpl: withdrawMock,
      completeWithdrawalImpl: completeMock,
    });

    const { result } = renderHook(() =>
      useCashOutToNaira({ ramp, assetCode: "USDC" })
    );

    // 1. Reset while withdraw() is in flight
    let firstPromise: Promise<{ id: string; url: string } | undefined>;
    act(() => {
      firstPromise = result.current.start("100");
    });
    act(() => {
      result.current.reset();
    });
    const firstRes = await act(async () => {
      resolveWithdraw({ id: "wd-stale", url: "https://anchor.example.com/stale" });
      return await firstPromise;
    });
    expect(firstRes).toBeUndefined();
    expect(result.current.phase).toBe("idle");
    expect(ramp.watch).not.toHaveBeenCalled();

    // 2. Reset while completeWithdrawal() is in flight
    await act(async () => {
      await result.current.start("200");
    });
    act(() => {
      getHandlers()!.onStatus!("pending_user_transfer_start", mockTransaction);
    });
    expect(result.current.phase).toBe("completing");

    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe("idle");

    await act(async () => {
      rejectComplete(new Error("late complete failure"));
    });
    expect(result.current.phase).toBe("idle");
    expect(result.current.error).toBeUndefined();
    expect(result.current.txHash).toBeUndefined();
  });
});

