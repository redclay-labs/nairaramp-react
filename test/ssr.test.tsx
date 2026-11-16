// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import type { Ramp } from "@nairaramp/core";
import {
  PayWithNaira,
  CashOutToNaira,
  StatusTimeline,
  usePayWithNaira,
  useCashOutToNaira,
  useRampQuote,
} from "../src/index";

const fakeRamp = {
  authenticate: vi.fn(),
  deposit: vi.fn(),
  withdraw: vi.fn(),
  getTransaction: vi.fn(),
  completeWithdrawal: vi.fn(),
  watch: vi.fn(),
  getPrice: vi.fn(),
} as unknown as Ramp;

describe("SSR / Node environment compatibility", () => {
  it("runs in a pure Node environment without window or document", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
  });

  it("renders StatusTimeline with renderToString in step and failure states", () => {
    const stepHtml = renderToString(
      <StatusTimeline status="pending_anchor" message="Processing on anchor" />
    );
    expect(stepHtml).toContain("Anchor processing");
    expect(stepHtml).toContain("Processing on anchor");
    expect(stepHtml).toContain('aria-current="step"');

    const failHtml = renderToString(
      <StatusTimeline status="expired" message="Window closed" />
    );
    expect(failHtml).toContain("Expired");
    expect(failHtml).toContain("Window closed");
    expect(failHtml).toContain('role="alert"');
  });

  it("renders PayWithNaira idle button with renderToString without window", () => {
    const html = renderToString(
      <PayWithNaira ramp={fakeRamp} assetCode="USDC" label="Pay ₦5,000" />
    );
    expect(html).toContain("<button");
    expect(html).toContain("Pay ₦5,000");
    expect(html).toContain('aria-live="polite"');
  });

  it("renders CashOutToNaira idle button with renderToString without window", () => {
    const html = renderToString(
      <CashOutToNaira ramp={fakeRamp} assetCode="USDC" label="Withdraw Naira" />
    );
    expect(html).toContain("<button");
    expect(html).toContain("Withdraw Naira");
    expect(html).toContain('aria-live="polite"');
  });

  it("exports hooks safely in server runtime contexts", () => {
    expect(typeof usePayWithNaira).toBe("function");
    expect(typeof useCashOutToNaira).toBe("function");
    expect(typeof useRampQuote).toBe("function");
  });
});
