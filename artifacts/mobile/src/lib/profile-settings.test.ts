import { describe, expect, it } from "vitest";

import {
  canSendFriendRequest,
  normalizeFriendCode,
  profileDeletionDescription,
} from "./profile-settings";

describe("profile settings presentation", () => {
  it("normalizes friend codes to the six supported characters", () => {
    expect(normalizeFriendCode(" ab-c12!z9 ")).toBe("ABC12Z");
    expect(canSendFriendRequest("ABC12Z")).toBe(true);
    expect(canSendFriendRequest("ABC12")).toBe(false);
  });

  it("explains that continuing after deletion creates a new guest profile", () => {
    expect(profileDeletionDescription()).toContain(
      "fresh guest profile if you keep playing",
    );
  });
});
