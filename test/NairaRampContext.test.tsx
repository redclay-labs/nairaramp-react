import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Ramp, Quote } from "@nairaramp/core";
import {
  NairaRampProvider,
  useNairaRamp,
  PayWithNaira,
  CashOutToNaira,
  usePayWithNaira,
  useCashOutToNaira,
  useRampQuote,
} from "../src/index";

function createFakeRamp(idPrefix = "tx") {
  const ramp = {
    authenticate: vi.fn(),
    deposit: vi.fn().mockResolvedValue({
      id: `${idPrefix}-dep`,
      url: `https://anchor.example.com/deposit/${idPrefix}`,
    }),
    withdraw: vi.fn().mockResolvedValue({
      id: `${idPrefix}-wd`,
      url: `https://anchor.example.com/withdraw/${idPrefix}`,
    }),
    getTransaction: vi.fn(),
    completeWithdrawal: vi.fn().mockResolvedValue({ hash: "hash-1" }),
    watch: vi.fn().mockReturnValue({ stop: vi.fn() }),
    getPrice: vi.fn().mockResolvedValue({
      sellAsset: "iso4217:NGN",
      buyAsset: "stellar:USDC:G...",
      sellAmount: "5000",
      buyAmount: "3.1",
      price: "1612.90",
      totalFee: "50",
      feeAsset: "iso4217:NGN",
    } as Quote),
  } as unknown as Ramp;
  return ramp;
}

describe("NairaRampProvider and useNairaRamp", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("throws a descriptive error when no ramp prop or provider is present", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => renderHook(() => useNairaRamp())).toThrow(
      /No Ramp instance found/
    );
  });

  it("provides ramp to hooks and components without explicit ramp prop", async () => {
    const contextRamp = createFakeRamp("ctx");
    vi.spyOn(window, "open").mockReturnValue(null);

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NairaRampProvider ramp={contextRamp}>{children}</NairaRampProvider>
    );

    const { result: payHook } = renderHook(
      () => usePayWithNaira({ assetCode: "USDC" }),
      { wrapper }
    );
    await act(async () => {
      await payHook.current.start("1000");
    });
    expect(contextRamp.deposit).toHaveBeenCalledWith({
      assetCode: "USDC",
      amount: "1000",
    });

    const { result: cashOutHook } = renderHook(
      () => useCashOutToNaira({ assetCode: "USDC" }),
      { wrapper }
    );
    await act(async () => {
      await cashOutHook.current.start("500");
    });
    expect(contextRamp.withdraw).toHaveBeenCalledWith({
      assetCode: "USDC",
      amount: "500",
    });

    const { result: quoteHook } = renderHook(
      () =>
        useRampQuote({
          sellAsset: "iso4217:NGN",
          buyAsset: "stellar:USDC:G...",
          sellAmount: "5000",
          debounceMs: 5000,
        }),
      { wrapper }
    );
    await act(async () => {
      await quoteHook.current.refresh();
    });
    expect(contextRamp.getPrice).toHaveBeenCalledTimes(1);

    render(
      <NairaRampProvider ramp={contextRamp}>
        <PayWithNaira assetCode="USDC" />
        <CashOutToNaira assetCode="USDC" />
      </NairaRampProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pay with Naira" }));
      fireEvent.click(screen.getByRole("button", { name: "Cash out to Naira" }));
    });
    expect(contextRamp.deposit).toHaveBeenCalledTimes(2);
    expect(contextRamp.withdraw).toHaveBeenCalledTimes(2);
  });

  it("prefers explicit ramp override over NairaRampProvider context", () => {
    const contextRamp = createFakeRamp("ctx");
    const overrideRamp = createFakeRamp("ovr");

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NairaRampProvider ramp={contextRamp}>{children}</NairaRampProvider>
    );

    const { result } = renderHook(() => useNairaRamp(overrideRamp), { wrapper });
    expect(result.current).toBe(overrideRamp);
  });
});

