import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { PayWithNaira } from "../src/PayWithNaira";
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
  } as unknown as Ramp;

  return {
    ramp,
    getHandlers: () => capturedHandlers,
    stopFn,
    depositMock: defaultDeposit,
  };
}

describe("PayWithNaira Component", () => {
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

  it("calls window.open synchronously before start resolves and sets href when url arrives", async () => {
    let resolveDeposit!: (val: { id: string; url: string }) => void;
    const depositPromise = new Promise<{ id: string; url: string }>((resolve) => {
      resolveDeposit = resolve;
    });

    const { ramp } = createFakeRamp({
      depositImpl: vi.fn().mockReturnValue(depositPromise),
    });

    render(<PayWithNaira ramp={ramp} assetCode="USDC" />);

    const button = screen.getByRole("button", { name: "Pay with Naira" });
    fireEvent.click(button);

    // Synchronously before start resolves:
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith("", "nairaramp_anchor");
    expect(mockPopup.location.href).toBe("");

    // Phase is starting: button is disabled with "Connecting..."
    const connectingBtn = screen.getByRole("button", { name: "Connecting..." }) as HTMLButtonElement;
    expect(connectingBtn.disabled).toBe(true);

    // Now resolve deposit
    await act(async () => {
      resolveDeposit({
        id: "tx-456",
        url: "https://anchor.example.com/flow?id=tx-456",
      });
    });

    expect(mockPopup.location.href).toBe("https://anchor.example.com/flow?id=tx-456");
    expect(screen.getByText("Complete the steps in the anchor window")).toBeTruthy();
  });

  it("renders blocked-popup fallback link when window.open returns null", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { ramp } = createFakeRamp();

    render(<PayWithNaira ramp={ramp} assetCode="USDC" />);

    const button = screen.getByRole("button", { name: "Pay with Naira" });
    await act(async () => {
      fireEvent.click(button);
    });

    // Fallback link should be rendered
    const fallbackLink = screen.getByRole("link", { name: "Continue to the anchor" });
    expect(fallbackLink.getAttribute("href")).toBe(
      "https://anchor.example.com/sep24/interactive?id=tx-123"
    );
    expect(fallbackLink.getAttribute("target")).toBe("_blank");
    expect(fallbackLink.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders expected content and attributes across every phase", async () => {
    const { ramp, getHandlers } = createFakeRamp();

    const { rerender } = render(
      <PayWithNaira ramp={ramp} assetCode="USDC" label="Custom Pay Label" />
    );

    // 1. idle phase: custom label button, type="button"
    const idleButton = screen.getByRole("button", { name: "Custom Pay Label" });
    expect(idleButton).toBeTruthy();
    expect(idleButton.getAttribute("type")).toBe("button");

    // Click to start
    await act(async () => {
      fireEvent.click(idleButton);
    });

    // 2. awaiting_user phase
    expect(screen.getByText("Complete the steps in the anchor window")).toBeTruthy();

    const handlers = getHandlers();
    expect(handlers).toBeDefined();

    // 3. processing phase
    await act(async () => {
      handlers?.onStatus?.("pending_anchor", mockTransaction);
    });
    expect(screen.getByText("Processing your payment")).toBeTruthy();

    // 4. completed phase
    await act(async () => {
      handlers?.onStatus?.("completed", mockTransaction);
    });
    expect(screen.getByText("Payment completed")).toBeTruthy();

    // Re-render does not crash or break live text
    rerender(<PayWithNaira ramp={ramp} assetCode="USDC" label="Custom Pay Label" />);
    expect(screen.getByText("Payment completed")).toBeTruthy();
  });

  it("renders failed phase with error message and allows reset via Try again button", async () => {
    const { ramp, getHandlers } = createFakeRamp();

    render(<PayWithNaira ramp={ramp} assetCode="USDC" />);

    const button = screen.getByRole("button", { name: "Pay with Naira" });
    await act(async () => {
      fireEvent.click(button);
    });

    const handlers = getHandlers();
    await act(async () => {
      handlers?.onError?.(
        new NairaRampError("TRANSACTION_FAILED", "Anchor declined the transaction")
      );
    });

    // failed phase
    expect(screen.getByText("Anchor declined the transaction")).toBeTruthy();
    const tryAgainBtn = screen.getByRole("button", { name: "Try again" });
    expect(tryAgainBtn).toBeTruthy();
    expect(tryAgainBtn.getAttribute("type")).toBe("button");

    // Click "Try again" calling reset()
    await act(async () => {
      fireEvent.click(tryAgainBtn);
    });

    // Returns to idle phase
    expect(screen.getByRole("button", { name: "Pay with Naira" })).toBeTruthy();
    expect(screen.queryByText("Anchor declined the transaction")).toBeNull();
  });

  it("fires onComplete and onError callbacks once each when reached", async () => {
    const onComplete = vi.fn();
    const onError = vi.fn();
    const { ramp, getHandlers } = createFakeRamp();

    const { rerender } = render(
      <PayWithNaira
        ramp={ramp}
        assetCode="USDC"
        onComplete={onComplete}
        onError={onError}
      />
    );

    const button = screen.getByRole("button", { name: "Pay with Naira" });
    await act(async () => {
      fireEvent.click(button);
    });

    const handlers = getHandlers();

    // Trigger complete
    await act(async () => {
      handlers?.onComplete?.(mockTransaction);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();

    // Re-rendering or another complete event should not fire onComplete again
    await act(async () => {
      handlers?.onStatus?.("completed", mockTransaction);
    });
    rerender(
      <PayWithNaira
        ramp={ramp}
        assetCode="USDC"
        onComplete={onComplete}
        onError={onError}
      />
    );
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("fires onError callback once on terminal failure", async () => {
    const onComplete = vi.fn();
    const onError = vi.fn();
    const { ramp, getHandlers } = createFakeRamp();

    render(
      <PayWithNaira
        ramp={ramp}
        assetCode="USDC"
        onComplete={onComplete}
        onError={onError}
      />
    );

    const button = screen.getByRole("button", { name: "Pay with Naira" });
    await act(async () => {
      fireEvent.click(button);
    });

    const handlers = getHandlers();

    // Terminal status error
    await act(async () => {
      handlers?.onStatus?.("error", mockTransaction);
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "NairaRampError",
      })
    );
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("closes the popup if start fails", async () => {
    const depositMock = vi
      .fn()
      .mockRejectedValue(new NairaRampError("TRANSACTION_FAILED", "Deposit rejected"));

    const { ramp } = createFakeRamp({
      depositImpl: depositMock,
    });

    const onError = vi.fn();

    render(<PayWithNaira ramp={ramp} assetCode="USDC" onError={onError} />);

    const button = screen.getByRole("button", { name: "Pay with Naira" });
    await act(async () => {
      fireEvent.click(button);
    });

    // Window was opened synchronously
    expect(window.open).toHaveBeenCalledTimes(1);

    // But deposit failed, so popup must be closed
    expect(mockPopup.close).toHaveBeenCalledTimes(1);
    expect(mockPopup.closed).toBe(true);
    expect(screen.getByText("Deposit rejected")).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("closes the popup if watch fails subsequently", async () => {
    const { ramp, getHandlers } = createFakeRamp();

    render(<PayWithNaira ramp={ramp} assetCode="USDC" />);

    const button = screen.getByRole("button", { name: "Pay with Naira" });
    await act(async () => {
      fireEvent.click(button);
    });

    expect(mockPopup.close).not.toHaveBeenCalled();

    const handlers = getHandlers();
    await act(async () => {
      handlers?.onError?.(new NairaRampError("TRANSACTION_FAILED", "Failed"));
    });

    expect(mockPopup.close).toHaveBeenCalledTimes(1);
  });

  it("applies custom className and style overrides to the root container", () => {
    const { ramp } = createFakeRamp();

    const { container } = render(
      <PayWithNaira
        ramp={ramp}
        assetCode="USDC"
        className="custom-pay-wrapper"
        style={{ marginTop: "16px", maxWidth: "500px" }}
      />
    );

    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.className).toBe("custom-pay-wrapper");
    expect(rootDiv.style.marginTop).toBe("16px");
    expect(rootDiv.style.maxWidth).toBe("500px");
    expect(rootDiv.style.width).toBe("100%");
  });

  it("has status text inside an aria-live region and adheres to 100% width and 420px max-width", () => {
    const { ramp } = createFakeRamp();

    const { container } = render(<PayWithNaira ramp={ramp} assetCode="USDC" />);

    // Container style constraints
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.style.width).toBe("100%");
    expect(rootDiv.style.maxWidth).toBe("420px");

    // aria-live polite region exists
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });
});
