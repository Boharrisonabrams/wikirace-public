import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({ api: vi.fn() }));

import { finalizeProfileClaim } from "./profile-claim";

describe("profile-only claim finalization", () => {
  it("posts only the authenticated profile claim endpoint", async () => {
    const request = vi.fn().mockResolvedValue({ claimed: true });

    await expect(finalizeProfileClaim(request)).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith("/profile/claim", {
      method: "POST",
    });
  });

  it("can retry the same idempotent finalization after an error", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce({ claimed: true });

    await expect(finalizeProfileClaim(request)).rejects.toThrow(
      "network unavailable",
    );
    await expect(finalizeProfileClaim(request)).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenNthCalledWith(1, "/profile/claim", {
      method: "POST",
    });
    expect(request).toHaveBeenNthCalledWith(2, "/profile/claim", {
      method: "POST",
    });
  });
});
