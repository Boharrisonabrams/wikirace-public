import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchWikipediaSuggestions: vi.fn(),
}));

vi.mock("../lib/wikipedia", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/wikipedia")>()),
  searchWikipediaSuggestions: mocks.searchWikipediaSuggestions,
}));

import { createApp } from "../app";

async function request(path: string) {
  const server = createApp().listen(0);
  try {
    const address = server.address() as AddressInfo;
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

afterEach(() => {
  mocks.searchWikipediaSuggestions.mockReset();
});

describe("GET /api/wikipedia/suggestions", () => {
  it("requires a non-empty query", async () => {
    const response = await request("/api/wikipedia/suggestions");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Query parameter is required",
    });
    expect(mocks.searchWikipediaSuggestions).not.toHaveBeenCalled();
  });

  it("caps the request and response at six suggestions", async () => {
    mocks.searchWikipediaSuggestions.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        title: `Castle ${index}`,
        description: index === 0 ? null : `Result ${index}`,
      }))
    );

    const response = await request("/api/wikipedia/suggestions?q=castle&limit=99");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      suggestions: Array.from({ length: 6 }, (_, index) => ({
        title: `Castle ${index}`,
        description: index === 0 ? null : `Result ${index}`,
      })),
    });
    expect(mocks.searchWikipediaSuggestions).toHaveBeenCalledWith("castle", 6);
  });

  it("returns a stable upstream error without leaking its body", async () => {
    mocks.searchWikipediaSuggestions.mockRejectedValue(new Error("upstream secret body"));

    const response = await request("/api/wikipedia/suggestions?q=castle");

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to load Wikipedia suggestions",
    });
  });
});
