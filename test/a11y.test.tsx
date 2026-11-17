import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { PayWithNaira } from "../src/PayWithNaira";
import { CashOutToNaira } from "../src/CashOutToNaira";
import { StatusTimeline } from "../src/StatusTimeline";
import {
  type Ramp,
  type WatchHandlers,
  NairaRampError,
} from "@nairaramp/core";

function createFakeRamp() {
  let capturedHandlers: WatchHandlers | undefined;
  const stopFn = vi.fn();

  const ramp = {
    authenticate: vi.fn(),
    deposit: vi.fn().mockResolvedValue({
      id: "tx-a11y",
      url: "https://anchor.example.com/sep24/interactive?id=tx-a11y",
    }),
    withdraw: vi.fn().mockResolvedValue({
      id: "wd-a11y",
      url: "https://anchor.example.com/sep24/withdraw?id=wd-a11y",
    }),
    getTransaction: vi.fn(),
    completeWithdrawal: vi.fn().mockResolvedValue({ hash: "hash-a11y" }),
    watch: vi.fn().mockImplementation((_id: string, handlers: WatchHandlers) => {
      capturedHandlers = handlers;
      return { stop: stopFn };
    }),
    getPrice: vi.fn(),
  } as unknown as Ramp;

  return { ramp, getHandlers: () => capturedHandlers };
}

describe("Accessibility and Keyboard Navigation", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("PayWithNaira exposes accessible button semantics, visible focus, and aria-live announcements", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { ramp, getHandlers } = createFakeRamp();

    const { container } = render(<PayWithNaira ramp={ramp} assetCode="USDC" />);

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");

    // Primary button is keyboard focusable with visible focus outline
    const payBtn = screen.getByRole("button", { name: "Pay with Naira" });
    expect(payBtn.getAttribute("type")).toBe("button");
    expect(payBtn.tabIndex).toBe(0);

    fireEvent.focus(payBtn);
    expect(payBtn.style.outline).toContain("3px solid");

    // Activate via Enter / click
    await act(async () => {
      fireEvent.keyDown(payBtn, { key: "Enter", code: "Enter" });
      fireEvent.click(payBtn);
    });

    // Fallback link is keyboard focusable with safe rel attributes
    const fallbackLink = screen.getByRole("link", { name: "Continue to the anchor" });
    expect(fallbackLink.getAttribute("rel")).toBe("noopener noreferrer");
    fireEvent.focus(fallbackLink);
    expect(fallbackLink.style.outline).toContain("2px solid");

    // Error state exposes retry button with visible focus
    await act(async () => {
      getHandlers()?.onError?.(new NairaRampError("TRANSACTION_FAILED", "Declined"));
    });

    const retryBtn = screen.getByRole("button", { name: "Try again" });
    expect(retryBtn.getAttribute("type")).toBe("button");
    fireEvent.focus(retryBtn);
    expect(retryBtn.style.outline).toContain("2px solid");
  });

  it("CashOutToNaira exposes accessible button semantics, visible focus, and aria-live announcements", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const { ramp, getHandlers } = createFakeRamp();

    const { container } = render(<CashOutToNaira ramp={ramp} assetCode="USDC" />);

    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute("aria-atomic")).toBe("true");

    const cashOutBtn = screen.getByRole("button", { name: "Cash out to Naira" });
    expect(cashOutBtn.getAttribute("type")).toBe("button");
    cashOutBtn.focus();
    expect(document.activeElement).toBe(cashOutBtn);

    await act(async () => {
      fireEvent.click(cashOutBtn);
    });

    const fallbackLink = screen.getByRole("link", { name: "Continue to the anchor" });
    expect(fallbackLink.getAttribute("rel")).toBe("noopener noreferrer");

    await act(async () => {
      getHandlers()?.onError?.(new NairaRampError("TRANSACTION_FAILED", "Failed"));
    });

    const retryBtn = screen.getByRole("button", { name: "Try again" });
    expect(retryBtn.getAttribute("type")).toBe("button");
    retryBtn.focus();
    expect(document.activeElement).toBe(retryBtn);
  });

  it("StatusTimeline uses semantic list, aria-current='step', aria-hidden badges, and role='alert'", () => {
    const { container, rerender } = render(
      <StatusTimeline status="pending_anchor" />
    );

    const list = screen.getByRole("list", { name: "Payment status timeline" });
    expect(list.tagName).toBe("OL");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(6);
    expect(items[3]?.getAttribute("aria-current")).toBe("step");

    const hiddenBadges = container.querySelectorAll('[aria-hidden="true"]');
    expect(hiddenBadges).toHaveLength(6);

    rerender(<StatusTimeline status="expired" message="Session expired" />);
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Expired");
    expect(alert.textContent).toContain("Session expired");
  });
});
