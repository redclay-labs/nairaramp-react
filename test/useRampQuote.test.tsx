import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRampQuote } from "../src/useRampQuote";
import { type Ramp, type Quote, NairaRampError } from "@nairaramp/core";

const sampleQuote: Quote = {
  sellAsset: "iso4217:NGN",
  buyAsset: "stellar:USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  sellAmount: "5000",
  buyAmount: "3.12",
  price: "1602.56",
  totalFee: "50",
  feeAsset: "iso4217:NGN",
};

function createFakeRamp(getPriceImpl?: Ramp["getPrice"]) {
  const defaultGetPrice = vi.fn().mockResolvedValue(sampleQuote);
  const ramp = {
    authenticate: vi.fn(),
    deposit: vi.fn(),
    withdraw: vi.fn(),
    getTransaction: vi.fn(),
    completeWithdrawal: vi.fn(),
    watch: vi.fn(),
    getPrice: getPriceImpl ?? defaultGetPrice,
  } as unknown as Ramp;

  return { ramp, getPriceMock: ramp.getPrice as ReturnType<typeof vi.fn> };
}

describe("useRampQuote", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces rapid amount changes and fetches quote once", async () => {
    const { ramp, getPriceMock } = createFakeRamp();

    const { result, rerender } = renderHook(
      ({ sellAmount }: { sellAmount: string }) =>
        useRampQuote({
          ramp,
          sellAsset: "iso4217:NGN",
          buyAsset: "stellar:USDC:G...",
          sellAmount,
          debounceMs: 300,
        }),
      { initialProps: { sellAmount: "1000" } }
    );

    expect(getPriceMock).not.toHaveBeenCalled();

    rerender({ sellAmount: "5000" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(getPriceMock).toHaveBeenCalledTimes(1);
    expect(getPriceMock).toHaveBeenCalledWith({
      sellAsset: "iso4217:NGN",
      buyAsset: "stellar:USDC:G...",
      sellAmount: "5000",
    });
    expect(result.current.quote).toEqual(sampleQuote);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it("skips fetching when disabled or amount is empty", async () => {
    const { ramp, getPriceMock } = createFakeRamp();

    renderHook(() =>
      useRampQuote({
        ramp,
        sellAsset: "iso4217:NGN",
        buyAsset: "stellar:USDC:G...",
        sellAmount: "",
        debounceMs: 0,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(getPriceMock).not.toHaveBeenCalled();
  });

  it("polls on interval and clears timers on unmount", async () => {
    const { ramp, getPriceMock } = createFakeRamp();

    const { unmount } = renderHook(() =>
      useRampQuote({
        ramp,
        sellAsset: "iso4217:NGN",
        buyAsset: "stellar:USDC:G...",
        sellAmount: "5000",
        debounceMs: 0,
        pollIntervalMs: 1000,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getPriceMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(getPriceMock).toHaveBeenCalledTimes(3);

    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(getPriceMock).toHaveBeenCalledTimes(3);
  });

  it("ignores stale responses when a newer request supersedes an older one", async () => {
    let resolveFirst!: (q: Quote) => void;
    let resolveSecond!: (q: Quote) => void;

    const getPriceMock = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Quote>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<Quote>((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { ramp } = createFakeRamp(getPriceMock);

    const { result, rerender } = renderHook(
      ({ sellAmount }: { sellAmount: string }) =>
        useRampQuote({
          ramp,
          sellAsset: "iso4217:NGN",
          buyAsset: "stellar:USDC:G...",
          sellAmount,
          debounceMs: 0,
        }),
      { initialProps: { sellAmount: "1000" } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    rerender({ sellAmount: "2000" });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    const newerQuote: Quote = { ...sampleQuote, sellAmount: "2000", buyAmount: "1.25" };

    await act(async () => {
      resolveSecond(newerQuote);
    });
    expect(result.current.quote).toEqual(newerQuote);

    // Resolving the older request afterward must not overwrite the newer quote
    await act(async () => {
      resolveFirst({ ...sampleQuote, sellAmount: "1000", buyAmount: "0.62" });
    });
    expect(result.current.quote).toEqual(newerQuote);
  });

  it("normalizes non-NairaRampError errors and supports manual refresh", async () => {
    const getPriceMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("Rate service down"))
      .mockResolvedValueOnce(sampleQuote);

    const { ramp } = createFakeRamp(getPriceMock);

    const { result } = renderHook(() =>
      useRampQuote({
        ramp,
        sellAsset: "iso4217:NGN",
        buyAsset: "stellar:USDC:G...",
        buyAmount: "3",
        context: "sep24",
        debounceMs: 0,
      })
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.error).toBeInstanceOf(NairaRampError);
    expect(result.current.error?.code).toBe("QUOTE_UNAVAILABLE");
    expect(result.current.error?.message).toBe("Rate service down");

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.error).toBeUndefined();
    expect(result.current.quote).toEqual(sampleQuote);
  });

  it("clears stale quote and error when amount is cleared or disabled", async () => {
    const { ramp } = createFakeRamp();

    const { result, rerender } = renderHook(
      ({ sellAmount, enabled }: { sellAmount: string; enabled: boolean }) =>
        useRampQuote({
          ramp,
          sellAsset: "iso4217:NGN",
          buyAsset: "stellar:USDC:G...",
          sellAmount,
          enabled,
          debounceMs: 0,
        }),
      { initialProps: { sellAmount: "5000", enabled: true } }
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.quote).toEqual(sampleQuote);

    // Clearing the amount must clear the stale quote
    rerender({ sellAmount: "", enabled: true });
    expect(result.current.quote).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.loading).toBe(false);

    // Re-populate and then disable
    rerender({ sellAmount: "5000", enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.quote).toEqual(sampleQuote);

    rerender({ sellAmount: "5000", enabled: false });
    expect(result.current.quote).toBeUndefined();
    expect(result.current.error).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });
});

