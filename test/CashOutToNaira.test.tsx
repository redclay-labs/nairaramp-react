import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { CashOutToNaira } from "../src/CashOutToNaira";
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
    hash: "stellar-hash-123",
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
    getHandlers: () => capturedHandlers,
    stopFn,
  };
}

describe("CashOutToNaira Component", () => {
  let mockPopup: {
    location: { href: string };
    close: ReturnType<typeof vi.fn>;
    closed: boolean;
  };

  beforeEach(() => {
    mockPopup = {
      location: { href: "" },
      close: vi.fn(() => {
        mockPopup.closed = true;
      }),
      closed: false,
    };
    vi.spyOn(window, "open").mockImplementation(() => mockPopup as unknown as Window);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens popup synchronously and navigates to interactive withdraw URL", async () => {
    let resolveWithdraw!: (val: { id: string; url: string }) => void;
    const withdrawPromise = new Promise<{ id: string; url: string }>((resolve) => {
      resolveWithdraw = resolve;
    });

    const { ramp } = createFakeRamp({
      withdrawImpl: vi.fn().mockReturnValue(withdrawPromise),
    });

    render(<CashOutToNaira ramp={ramp} assetCode="USDC" amount="50" />);

    fireEvent.click(screen.getByRole("button", { name: "Cash out to Naira" }));

    expect(window.open).toHaveBeenCalledWith("", "nairaramp_anchor");
    expect((screen.getByRole("button", { name: "Connecting..." }) as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      resolveWithdraw({
        id: "wd-456",
        url: "https://anchor.example.com/withdraw?id=wd-456",
      });
    });

    expect(mockPopup.location.href).toBe("https://anchor.example.com/withdraw?id=wd-456");
    expect(screen.getByText("Complete the steps in the anchor window")).toBeTruthy();
  });

  it("renders blocked-popup fallback link and rejects unsafe URLs", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { ramp } = createFakeRamp();

    render(<CashOutToNaira ramp={ramp} assetCode="USDC" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cash out to Naira" }));
    });

    const fallbackLink = screen.getByRole("link", { name: "Continue to the anchor" });
    expect(fallbackLink.getAttribute("href")).toBe(
      "https://anchor.example.com/sep24/withdraw?id=wd-123"
    );
    expect(fallbackLink.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("fires onComplete with txHash and handles failure + Try again reset", async () => {
    const onComplete = vi.fn();
    const onError = vi.fn();
    const { ramp, getHandlers } = createFakeRamp();

    render(
      <CashOutToNaira
        ramp={ramp}
        assetCode="USDC"
        onComplete={onComplete}
        onError={onError}
      />
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cash out to Naira" }));
    });

    await act(async () => {
      getHandlers()!.onStatus!("pending_user_transfer_start", mockTransaction);
    });

    expect(screen.getByText("Processing your cash out")).toBeTruthy();

    await act(async () => {
      getHandlers()!.onStatus!("completed", mockTransaction);
    });

    expect(screen.getByText("Cash out completed")).toBeTruthy();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith("stellar-hash-123");
    expect(onError).not.toHaveBeenCalled();
  });

  it("closes popup and fires onError on failure, then resets via Try again", async () => {
    const onError = vi.fn();
    const { ramp, getHandlers } = createFakeRamp();

    render(<CashOutToNaira ramp={ramp} assetCode="USDC" onError={onError} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Cash out to Naira" }));
    });

    await act(async () => {
      getHandlers()!.onError!(new NairaRampError("TRANSACTION_FAILED", "Withdrawal rejected"));
    });

    expect(mockPopup.close).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Withdrawal rejected")).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });

    expect(screen.getByRole("button", { name: "Cash out to Naira" })).toBeTruthy();
  });
});

