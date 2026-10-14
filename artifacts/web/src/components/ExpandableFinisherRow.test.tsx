// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import ExpandableFinisherRow from "./ExpandableFinisherRow";

describe("ExpandableFinisherRow", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("does not expose expand controls when the server withheld the path", async () => {
    await act(async () => {
      root.render(
        <ExpandableFinisherRow expanded={false} onToggle={() => {}}>
          <div>Winner row</div>
        </ExpandableFinisherRow>,
      );
    });

    expect(container.textContent).toContain("Winner row");
    expect(container.textContent).not.toContain("Reveal path");
    expect(container.querySelector("[data-testid='finisher-path']")).toBeNull();
  });

  it("toggles the path open and closed when gated data is present", async () => {
    function Harness() {
      const [expanded, setExpanded] = useState(false);
      return (
        <ExpandableFinisherRow
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
          path={["Earth", "Orbit", "Moon"]}
        >
          <div>Winner row</div>
        </ExpandableFinisherRow>
      );
    }

    await act(async () => {
      root.render(<Harness />);
    });

    const toggle = container.querySelector("button");
    expect(toggle?.textContent).toContain("Reveal path");
    expect(container.querySelector("[data-testid='finisher-path']")).toBeNull();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Hide path");
    expect(container.textContent).toContain("1.Earth");
    expect(container.textContent).toContain("3.Moon");

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Reveal path");
    expect(container.querySelector("[data-testid='finisher-path']")).toBeNull();
  });
});
