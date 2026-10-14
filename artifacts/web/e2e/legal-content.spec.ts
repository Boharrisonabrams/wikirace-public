import { expect, test } from "@playwright/test";

import {
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  SUPPORT_EMAIL,
  SUPPORT_SECTIONS,
} from "../src/lib/legal-content";

const privacyCopy = PRIVACY_SECTIONS.flatMap(
  (section) => section.paragraphs,
).join(" ");
const supportCopy = SUPPORT_SECTIONS.flatMap(
  (section) => section.paragraphs,
).join(" ");

test("privacy copy describes actual account, gameplay, service, and deletion behavior", () => {
  expect(PRIVACY_EFFECTIVE_DATE).toBe("July 14, 2026");
  expect(privacyCopy).toContain("Supabase");
  expect(privacyCopy).toContain("Railway");
  expect(privacyCopy).toContain("Wikipedia and Wikimedia");
  expect(privacyCopy).toContain("automatically created guest profiles");
  expect(privacyCopy).toContain("does not sell personal information");
  expect(privacyCopy).toContain("cross-app tracking");
});

test("support sends deletion to the in-app control and never asks for credentials", () => {
  expect(SUPPORT_EMAIL).toBe("support@example.com");
  expect(supportCopy).toContain("Account deletion is completed in the app");
  expect(supportCopy).toContain(
    "Do not send a password or authentication code",
  );
});
