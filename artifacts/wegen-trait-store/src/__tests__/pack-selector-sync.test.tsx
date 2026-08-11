/**
 * Pack selector sync tests
 *
 * Verifies that the global PackSelectorBar and the in-panel PanelPackSelector
 * always reflect the same activePack value. Both are production components
 * exported from Store.tsx and used exactly as Store wires them:
 *
 *   • Store renders <PackSelectorBar … onPackChange={setActivePack} />
 *   • Store passes activePack + onPackChange={setActivePack} down to
 *     NftPreviewBanner, which renders <PanelPackSelector … /> with those props
 *
 * The tests render the real production components inside a stateful harness
 * that mirrors Store's single `activePack` state, with no mocks needed since
 * both components are pure controlled UI with no context or API dependencies.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { PackSelectorBar, PanelPackSelector } from "../pages/Store";

// ── Test harness ──────────────────────────────────────────────────────────────

const ACCENT = "hsl(272 100% 62%)";
const PACKS  = ["Midnight", "Neon"];

/**
 * Mirrors Store's activePack state wiring exactly:
 *   <PackSelectorBar … onPackChange={setActivePack} />
 *   <PanelPackSelector … activePack={activePack} onPackChange={setActivePack} />
 *
 * Both components are pure UI with no context dependencies, so the harness
 * needs no provider wrappers.
 */
function PackSyncHarness({ packs = PACKS }: { packs?: string[] }) {
  const [activePack, setActivePack] = useState<string | undefined>();
  return (
    <div>
      <PackSelectorBar
        allPacks={packs}
        activePack={activePack}
        onPackChange={setActivePack}
        accent={ACCENT}
      />
      <PanelPackSelector
        allPacks={packs}
        activePack={activePack}
        onPackChange={setActivePack}
        accent={ACCENT}
      />
    </div>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Pack selector sync — PackSelectorBar (global) ↔ PanelPackSelector (in-panel)", () => {
  it("initial state: both selectors show Original as active", () => {
    render(<PackSyncHarness />);

    // Global selector
    expect(screen.getByTestId("global-pack-original")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const pack of PACKS) {
      expect(screen.getByTestId(`global-pack-${pack}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }

    // Panel selector mirrors the same state
    expect(screen.getByTestId("panel-pack-original")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const pack of PACKS) {
      expect(screen.getByTestId(`panel-pack-${pack}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("selecting a pack in the global selector highlights it in the panel selector", async () => {
    const user = userEvent.setup();
    render(<PackSyncHarness />);

    await user.click(screen.getByTestId("global-pack-Midnight"));

    // Global: Midnight selected, Original cleared
    expect(screen.getByTestId("global-pack-Midnight")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("global-pack-original")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Panel selector must immediately mirror the global selection
    expect(screen.getByTestId("panel-pack-Midnight")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("panel-pack-original")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("selecting a pack in the panel selector highlights it in the global selector", async () => {
    const user = userEvent.setup();
    render(<PackSyncHarness />);

    await user.click(screen.getByTestId("panel-pack-Neon"));

    // Panel: Neon selected
    expect(screen.getByTestId("panel-pack-Neon")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("panel-pack-original")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Global selector must immediately mirror the panel selection
    expect(screen.getByTestId("global-pack-Neon")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("global-pack-original")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicking Original in the global selector clears the selection in both", async () => {
    const user = userEvent.setup();
    render(<PackSyncHarness />);

    // Activate a pack via the panel selector
    await user.click(screen.getByTestId("panel-pack-Midnight"));

    // Clear it via the global Original button
    await user.click(screen.getByTestId("global-pack-original"));

    expect(screen.getByTestId("global-pack-original")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("panel-pack-original")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const pack of PACKS) {
      expect(screen.getByTestId(`global-pack-${pack}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(screen.getByTestId(`panel-pack-${pack}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("clicking Original in the panel selector clears the selection in both", async () => {
    const user = userEvent.setup();
    render(<PackSyncHarness />);

    // Activate a pack via the global selector
    await user.click(screen.getByTestId("global-pack-Neon"));

    // Clear it via the panel Original button
    await user.click(screen.getByTestId("panel-pack-original"));

    expect(screen.getByTestId("global-pack-original")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("panel-pack-original")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    for (const pack of PACKS) {
      expect(screen.getByTestId(`global-pack-${pack}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(screen.getByTestId(`panel-pack-${pack}`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
  });

  it("switching packs repeatedly keeps both selectors in sync throughout", async () => {
    const user = userEvent.setup();
    render(<PackSyncHarness />);

    // Global: pick Midnight
    await user.click(screen.getByTestId("global-pack-Midnight"));
    expect(screen.getByTestId("panel-pack-Midnight")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // Panel: switch to Neon
    await user.click(screen.getByTestId("panel-pack-Neon"));
    expect(screen.getByTestId("global-pack-Neon")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("global-pack-Midnight")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Global: back to Original
    await user.click(screen.getByTestId("global-pack-original"));
    expect(screen.getByTestId("panel-pack-original")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("panel-pack-Neon")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
