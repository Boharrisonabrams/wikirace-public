import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  },
}));

vi.mock("expo-crypto", () => ({
  randomUUID: vi.fn(() => "default-flow-id"),
}));

import {
  EMAIL_CONFIRMATION_AUTH_TRANSACTION_TTL_MS,
  OAUTH_AUTH_TRANSACTION_TTL_MS,
  cancelAuthTransaction,
  consumeAuthTransaction,
  issueAuthTransaction,
  peekAuthTransaction,
  type AuthTransactionDependencies,
} from "./auth-transaction";

function transactionHarness(now = 1_000): {
  dependencies: AuthTransactionDependencies;
  getNow: () => number;
  setNow: (value: number) => void;
  storage: Map<string, string>;
} {
  const storage = new Map<string, string>();
  let currentTime = now;

  return {
    dependencies: {
      createFlowId: vi.fn(() => "8bd6cb2b-442f-4aa8-81f0-fb93db44db43"),
      now: () => currentTime,
      storage: {
        getItem: async (key) => storage.get(key) ?? null,
        removeItem: async (key) => {
          storage.delete(key);
        },
        setItem: async (key, value) => {
          storage.set(key, value);
        },
      },
    },
    getNow: () => currentTime,
    setNow: (value) => {
      currentTime = value;
    },
    storage,
  };
}

describe("auth transactions", () => {
  it("persists a ten-minute OAuth flow before returning its callback", async () => {
    const harness = transactionHarness();

    const transaction = await issueAuthTransaction(
      {
        expectedGuestUserId: "guest-uuid",
        mode: "claim",
        next: "https://evil.example",
        redirectBase: "exp://127.0.0.1:8081/--/auth/callback",
      },
      harness.dependencies,
    );

    expect(transaction).toMatchObject({
      expectedGuestUserId: "guest-uuid",
      flowId: "8bd6cb2b-442f-4aa8-81f0-fb93db44db43",
      issuedAt: harness.getNow(),
      expiresAt: harness.getNow() + OAUTH_AUTH_TRANSACTION_TTL_MS,
      mode: "claim",
      next: "/",
      redirectBase: "exp://127.0.0.1:8081/--/auth/callback",
    });
    expect(new URL(transaction.redirectUri).searchParams.get("flow_id")).toBe(
      transaction.flowId,
    );
    expect(new URL(transaction.redirectUri).searchParams.get("mode")).toBe(
      "claim",
    );
    expect(new URL(transaction.redirectUri).searchParams.get("next")).toBe("/");
    await expect(peekAuthTransaction(harness.dependencies)).resolves.toEqual(
      transaction,
    );
    expect(harness.storage.size).toBe(1);
  });

  it.each([
    {
      code: "missing_flow_id",
      callback:
        "wikipath://auth/callback#access_token=access&refresh_token=refresh",
    },
    {
      code: "flow_mismatch",
      callback:
        "wikipath://auth/callback?flow_id=wrong#access_token=access&refresh_token=refresh",
    },
    {
      code: "unexpected_callback_uri",
      callback:
        "wikipath://unexpected/callback?flow_id=8bd6cb2b-442f-4aa8-81f0-fb93db44db43#access_token=access&refresh_token=refresh",
    },
  ])(
    "rejects $code without consuming the issued flow",
    async ({ callback, code }) => {
      const harness = transactionHarness();
      const transaction = await issueAuthTransaction(
        {
          expectedGuestUserId: null,
          mode: "signin",
          next: "/leaderboard",
          redirectBase: "wikipath://auth/callback",
        },
        harness.dependencies,
      );

      await expect(
        consumeAuthTransaction(callback, harness.dependencies),
      ).rejects.toMatchObject({ code });
      await expect(peekAuthTransaction(harness.dependencies)).resolves.toEqual(
        transaction,
      );
    },
  );

  it("rejects and clears an OAuth flow at ten minutes", async () => {
    const harness = transactionHarness();
    const transaction = await issueAuthTransaction(
      {
        expectedGuestUserId: null,
        mode: "signin",
        next: "/",
        redirectBase: "wikipath://auth/callback",
      },
      harness.dependencies,
    );
    harness.setNow(transaction.issuedAt + OAUTH_AUTH_TRANSACTION_TTL_MS);

    await expect(
      consumeAuthTransaction(
        `${transaction.redirectUri}#access_token=access&refresh_token=refresh`,
        harness.dependencies,
      ),
    ).rejects.toMatchObject({
      code: "expired_transaction",
      mode: "signin",
      next: "/",
    });
    await expect(peekAuthTransaction(harness.dependencies)).resolves.toBeNull();
  });

  it("keeps email confirmation valid beyond the OAuth ten-minute window", async () => {
    const harness = transactionHarness();
    const transaction = await issueAuthTransaction(
      {
        expectedGuestUserId: null,
        lifetime: "email-confirmation",
        mode: "signin",
        next: "/",
        redirectBase: "wikipath://auth/callback",
      },
      harness.dependencies,
    );
    harness.setNow(transaction.issuedAt + OAUTH_AUTH_TRANSACTION_TTL_MS + 1);

    await expect(
      consumeAuthTransaction(
        `${transaction.redirectUri}#access_token=access&refresh_token=refresh`,
        harness.dependencies,
      ),
    ).resolves.toEqual(transaction);
    expect(transaction.expiresAt).toBe(
      transaction.issuedAt + EMAIL_CONFIRMATION_AUTH_TRANSACTION_TTL_MS,
    );
  });

  it("expires email confirmation after twenty-four hours", async () => {
    const harness = transactionHarness();
    const transaction = await issueAuthTransaction(
      {
        expectedGuestUserId: null,
        lifetime: "email-confirmation",
        mode: "signin",
        next: "/",
        redirectBase: "wikipath://auth/callback",
      },
      harness.dependencies,
    );
    harness.setNow(
      transaction.issuedAt + EMAIL_CONFIRMATION_AUTH_TRANSACTION_TTL_MS,
    );

    await expect(
      consumeAuthTransaction(
        `${transaction.redirectUri}#access_token=access&refresh_token=refresh`,
        harness.dependencies,
      ),
    ).rejects.toMatchObject({ code: "expired_transaction" });
    await expect(peekAuthTransaction(harness.dependencies)).resolves.toBeNull();
  });

  it("consumes a valid callback exactly once", async () => {
    const harness = transactionHarness();
    const transaction = await issueAuthTransaction(
      {
        expectedGuestUserId: null,
        mode: "signin",
        next: "/leaderboard",
        redirectBase: "wikipath://auth/callback",
      },
      harness.dependencies,
    );
    const callback = `${transaction.redirectUri}#access_token=access&refresh_token=refresh`;

    await expect(
      consumeAuthTransaction(callback, harness.dependencies),
    ).resolves.toEqual(transaction);
    await expect(
      consumeAuthTransaction(callback, harness.dependencies),
    ).rejects.toMatchObject({ code: "missing_transaction" });
  });

  it("accepts only an explicitly compatible legacy callback base", async () => {
    const harness = transactionHarness();
    const transaction = await issueAuthTransaction(
      {
        expectedGuestUserId: null,
        mode: "signin",
        next: "/leaderboard",
        redirectBase: "wikirace://auth/callback",
      },
      harness.dependencies,
    );
    const legacyCallback = transaction.redirectUri.replace(
      "wikirace://auth/callback",
      "wikipath://auth/callback",
    );

    await expect(
      consumeAuthTransaction(legacyCallback, harness.dependencies, {
        compatibleRedirectBases: [
          "wikirace://auth/callback",
          "wikipath://auth/callback",
        ],
      }),
    ).resolves.toEqual(transaction);
  });

  it("cancels only the matching outstanding flow", async () => {
    const harness = transactionHarness();
    const transaction = await issueAuthTransaction(
      {
        expectedGuestUserId: "guest-uuid",
        mode: "claim",
        next: "/result",
        redirectBase: "wikipath://auth/callback",
      },
      harness.dependencies,
    );

    await cancelAuthTransaction("different-flow", harness.dependencies);
    await expect(peekAuthTransaction(harness.dependencies)).resolves.toEqual(
      transaction,
    );

    await cancelAuthTransaction(transaction.flowId, harness.dependencies);
    await expect(peekAuthTransaction(harness.dependencies)).resolves.toBeNull();
  });
});
