// Minimal react-dom render helpers for screen characterization tests.
import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export interface RenderedScreen {
  container: HTMLElement;
  unmount: () => Promise<void>;
}

const mounted = new Set<RenderedScreen>();

export async function flush(rounds = 3) {
  for (let round = 0; round < rounds; round++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

export async function render(element: ReactElement): Promise<RenderedScreen> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  await flush();
  const screen: RenderedScreen = {
    container,
    unmount: async () => {
      if (!mounted.delete(screen)) return;
      await act(async () => root.unmount());
      container.remove();
    },
  };
  mounted.add(screen);
  return screen;
}

export async function unmountAll() {
  for (const screen of [...mounted]) await screen.unmount();
}

export function textOf(node: Element): string {
  return (node.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function queryByLabel(root: Element, label: string): HTMLElement | null {
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>("[aria-label]"),
  )) {
    if (element.getAttribute("aria-label") === label) return element;
  }
  return null;
}

export function getByLabel(root: Element, label: string): HTMLElement {
  const element = queryByLabel(root, label);
  if (!element) throw new Error(`No element labelled "${label}"`);
  return element;
}

export function queryByTestId(
  root: Element,
  testID: string,
): HTMLElement | null {
  return root.querySelector<HTMLElement>(`[data-testid="${testID}"]`);
}

export function getByTestId(root: Element, testID: string): HTMLElement {
  const element = queryByTestId(root, testID);
  if (!element) throw new Error(`No element with testID "${testID}"`);
  return element;
}

export function isDisabled(element: Element): boolean {
  return element.getAttribute("aria-disabled") === "true";
}

export async function press(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await flush();
}

const valueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "value",
)?.set;

export async function typeInto(input: Element, value: string) {
  if (!(input instanceof HTMLInputElement) || !valueSetter) {
    throw new Error("typeInto needs a text input");
  }
  await act(async () => {
    valueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

export async function submit(input: Element) {
  await act(async () => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }),
    );
  });
  await flush();
}
