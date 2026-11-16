import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import {
  StatusTimeline,
  STATUS_MAP,
  TIMELINE_STEPS,
  type TimelineStep,
} from "../src/StatusTimeline";
import type { TransactionStatus } from "@nairaramp/core";

const ALL_STATUSES: readonly TransactionStatus[] = [
  "incomplete",
  "pending_user_transfer_start",
  "pending_user_transfer_complete",
  "pending_external",
  "pending_anchor",
  "pending_stellar",
  "pending_trust",
  "pending_user",
  "completed",
  "refunded",
  "expired",
  "no_market",
  "too_small",
  "too_large",
  "error",
] as const;

describe("StatusTimeline Component", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders and shows the expected label for every TransactionStatus (loop over the full list)", () => {
    for (const status of ALL_STATUSES) {
      const mapping = STATUS_MAP[status];
      const { unmount } = render(
        <StatusTimeline status={status} message={`Message for ${status}`} />
      );

      // Verify the expected label for this status is rendered in the document
      expect(screen.getByText(mapping.label)).toBeTruthy();

      if (mapping.kind === "step") {
        // Must render the <ol> timeline
        const ol = screen.getByRole("list", { name: "Payment status timeline" });
        expect(ol).toBeTruthy();

        // The step corresponding to activeIndex must have aria-current="step"
        const activeItem = screen.getByText(mapping.label).closest("li");
        expect(activeItem).toBeTruthy();
        expect(activeItem?.getAttribute("aria-current")).toBe("step");

        // Verify earlier steps do NOT have aria-current="step"
        const allItems = screen.getAllByRole("listitem");
        expect(allItems).toHaveLength(6);

        for (let i = 0; i < 6; i++) {
          const item = allItems[i]!;
          if (i === mapping.stepIndex) {
            expect(item.getAttribute("aria-current")).toBe("step");
          } else {
            expect(item.getAttribute("aria-current")).toBeNull();
          }
        }
      } else {
        // Failure status: must render plain failure line plus anchor message
        expect(screen.getByText(`Message for ${status}`)).toBeTruthy();
        // Failure status must NOT render the <ol> timeline
        expect(
          screen.queryByRole("list", { name: "Payment status timeline" })
        ).toBeNull();
      }

      unmount();
      cleanup();
    }
  });

  it("renders default Started step as active when status is undefined", () => {
    const { container } = render(<StatusTimeline status={undefined} />);

    const ol = screen.getByRole("list", { name: "Payment status timeline" });
    expect(ol).toBeTruthy();

    const activeItem = screen.getByText("Started").closest("li");
    expect(activeItem?.getAttribute("aria-current")).toBe("step");

    // Container width constraints
    const rootDiv = container.firstChild as HTMLElement;
    expect(rootDiv.style.width).toBe("100%");
    expect(rootDiv.style.maxWidth).toBe("420px");
  });

  it("supports custom translations via the optional labels prop", () => {
    const customLabels: Partial<Record<TimelineStep, string>> = {
      Started: "Iniciado",
      "Waiting for your payment": "En attente de paiement",
      "Anchor processing": "Traitement de l'ancre",
    };

    render(
      <StatusTimeline
        status="pending_anchor"
        labels={customLabels}
      />
    );

    // Custom translated label should appear
    expect(screen.getByText("Traitement de l'ancre")).toBeTruthy();
    expect(screen.getByText("Iniciado")).toBeTruthy();
    expect(screen.getByText("En attente de paiement")).toBeTruthy();

    // Untranslated step should use default English label
    expect(screen.getByText("Payment received")).toBeTruthy();
    expect(screen.getByText("Sending on Stellar")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();

    // Active step should correspond to Anchor processing ("Traitement de l'ancre")
    const activeItem = screen.getByText("Traitement de l'ancre").closest("li");
    expect(activeItem?.getAttribute("aria-current")).toBe("step");
  });

  it("renders failure statuses with role='alert' and anchor message when provided", () => {
    render(
      <StatusTimeline
        status="expired"
        message="The deposit window expired after 24 hours."
      />
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Expired")).toBeTruthy();
    expect(
      screen.getByText("The deposit window expired after 24 hours.")
    ).toBeTruthy();
  });

  it("renders failure status without message when message is not given", () => {
    render(<StatusTimeline status="too_small" />);

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Too small")).toBeTruthy();
  });

  it("renders message on in-progress status when provided", () => {
    render(
      <StatusTimeline
        status="pending_stellar"
        message="Stellar transaction submitted to network"
      />
    );

    expect(
      screen.getByText("Stellar transaction submitted to network")
    ).toBeTruthy();
    expect(screen.getByText("Sending on Stellar")).toBeTruthy();
  });

  it("renders safe fallback alert for unknown runtime status strings", () => {
    const { rerender } = render(
      <StatusTimeline status="custom_anchor_hold" message="Manual review" />
    );

    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Unknown status")).toBeTruthy();
    expect(screen.getByText("Manual review")).toBeTruthy();

    // Prototype property names should also fall back safely
    rerender(<StatusTimeline status="toString" />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Unknown status")).toBeTruthy();
  });

  it("exports all 6 timeline steps in correct order", () => {
    expect(TIMELINE_STEPS).toEqual([
      "Started",
      "Waiting for your payment",
      "Payment received",
      "Anchor processing",
      "Sending on Stellar",
      "Completed",
    ]);
  });
});
