import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";

import { normalizeReturnPath, type AuthMode } from "./auth-flow";

export const OAUTH_AUTH_TRANSACTION_TTL_MS = 10 * 60 * 1_000;
export const EMAIL_CONFIRMATION_AUTH_TRANSACTION_TTL_MS = 24 * 60 * 60 * 1_000;
const AUTH_TRANSACTION_STORAGE_KEY = "wikipath.auth.transaction.v1";

export type AuthTransactionLifetime = "oauth" | "email-confirmation";

export interface AuthTransaction {
  version: 1;
  expectedGuestUserId: string | null;
  expiresAt: number;
  flowId: string;
  issuedAt: number;
  mode: AuthMode;
  next: string;
  redirectBase: string;
  redirectUri: string;
}

interface AuthTransactionStorage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

export interface AuthTransactionDependencies {
  createFlowId: () => string;
  now: () => number;
  storage: AuthTransactionStorage;
}

interface ConsumeAuthTransactionOptions {
  compatibleRedirectBases?: readonly string[];
}

interface IssueAuthTransactionOptions {
  expectedGuestUserId: string | null;
  lifetime?: AuthTransactionLifetime;
  mode: AuthMode;
  next: unknown;
  redirectBase: string;
}

const defaultDependencies: AuthTransactionDependencies = {
  createFlowId: randomUUID,
  now: Date.now,
  storage: AsyncStorage,
};

let storageQueue: Promise<void> = Promise.resolve();

function withStorageLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = storageQueue.then(operation, operation);
  storageQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export class AuthTransactionError extends Error {
  readonly code: string;
  readonly mode: AuthMode | null;
  readonly next: string;

  constructor(
    code: string,
    message: string,
    transaction?: Pick<AuthTransaction, "mode" | "next"> | null,
  ) {
    super(message);
    this.name = "AuthTransactionError";
    this.code = code;
    this.mode = transaction?.mode ?? null;
    this.next = transaction?.next ?? "/";
  }
}

function callbackBase(value: string): string {
  const queryIndex = value.indexOf("?");
  const fragmentIndex = value.indexOf("#");
  const boundary = [queryIndex, fragmentIndex]
    .filter((index) => index >= 0)
    .reduce((lowest, index) => Math.min(lowest, index), value.length);
  const base = value.slice(0, boundary);

  try {
    const parsed = new URL(base);
    if (!parsed.protocol || !parsed.pathname) throw new Error("invalid URI");
  } catch {
    throw new AuthTransactionError(
      "unexpected_callback_uri",
      "Authentication returned to an unexpected callback URI.",
    );
  }

  return base;
}

function callbackUri(
  redirectBase: string,
  flowId: string,
  mode: AuthMode,
  next: string,
): string {
  const url = new URL(redirectBase);
  url.searchParams.set("flow_id", flowId);
  url.searchParams.set("mode", mode);
  url.searchParams.set("next", next);
  return url.toString();
}

function isAuthTransaction(value: unknown): value is AuthTransaction {
  if (typeof value !== "object" || value === null) return false;
  const transaction = value as Partial<AuthTransaction>;
  return (
    transaction.version === 1 &&
    (transaction.mode === "claim" || transaction.mode === "signin") &&
    typeof transaction.flowId === "string" &&
    transaction.flowId.length > 0 &&
    typeof transaction.next === "string" &&
    typeof transaction.redirectBase === "string" &&
    typeof transaction.redirectUri === "string" &&
    typeof transaction.issuedAt === "number" &&
    Number.isFinite(transaction.issuedAt) &&
    typeof transaction.expiresAt === "number" &&
    Number.isFinite(transaction.expiresAt) &&
    (transaction.expectedGuestUserId === null ||
      typeof transaction.expectedGuestUserId === "string")
  );
}

async function readStoredTransaction(
  dependencies: AuthTransactionDependencies,
): Promise<AuthTransaction | null> {
  const serialized = await dependencies.storage.getItem(
    AUTH_TRANSACTION_STORAGE_KEY,
  );
  if (!serialized) return null;

  try {
    const parsed: unknown = JSON.parse(serialized);
    if (isAuthTransaction(parsed)) return parsed;
  } catch {
    // Invalid or legacy transaction state is discarded below.
  }

  await dependencies.storage.removeItem(AUTH_TRANSACTION_STORAGE_KEY);
  return null;
}

export function issueAuthTransaction(
  options: IssueAuthTransactionOptions,
  dependencies: AuthTransactionDependencies = defaultDependencies,
): Promise<AuthTransaction> {
  return withStorageLock(async () => {
    if (
      options.mode === "claim" &&
      (!options.expectedGuestUserId ||
        options.expectedGuestUserId.trim().length === 0)
    ) {
      throw new Error("A guest player is required to start account claiming.");
    }

    const redirectBase = callbackBase(options.redirectBase);
    const flowId = dependencies.createFlowId();
    if (!flowId) {
      throw new Error("Could not create a secure authentication flow.");
    }
    const issuedAt = dependencies.now();
    const ttl =
      options.lifetime === "email-confirmation"
        ? EMAIL_CONFIRMATION_AUTH_TRANSACTION_TTL_MS
        : OAUTH_AUTH_TRANSACTION_TTL_MS;
    const next = normalizeReturnPath(options.next);
    const transaction: AuthTransaction = {
      version: 1,
      expectedGuestUserId:
        options.mode === "claim" ? options.expectedGuestUserId : null,
      expiresAt: issuedAt + ttl,
      flowId,
      issuedAt,
      mode: options.mode,
      next,
      redirectBase,
      redirectUri: callbackUri(redirectBase, flowId, options.mode, next),
    };

    await dependencies.storage.setItem(
      AUTH_TRANSACTION_STORAGE_KEY,
      JSON.stringify(transaction),
    );
    return transaction;
  });
}

export function peekAuthTransaction(
  dependencies: AuthTransactionDependencies = defaultDependencies,
): Promise<AuthTransaction | null> {
  return withStorageLock(async () => {
    const transaction = await readStoredTransaction(dependencies);
    if (!transaction) return null;
    if (transaction.expiresAt <= dependencies.now()) {
      await dependencies.storage.removeItem(AUTH_TRANSACTION_STORAGE_KEY);
      return null;
    }
    return transaction;
  });
}

export function consumeAuthTransaction(
  callbackUrl: string,
  dependencies: AuthTransactionDependencies = defaultDependencies,
  options: ConsumeAuthTransactionOptions = {},
): Promise<AuthTransaction> {
  return withStorageLock(async () => {
    const transaction = await readStoredTransaction(dependencies);
    if (!transaction) {
      throw new AuthTransactionError(
        "missing_transaction",
        "This authentication callback was not started by WikiRace.",
      );
    }
    if (transaction.expiresAt <= dependencies.now()) {
      await dependencies.storage.removeItem(AUTH_TRANSACTION_STORAGE_KEY);
      throw new AuthTransactionError(
        "expired_transaction",
        "This authentication attempt expired. Please try again.",
        transaction,
      );
    }

    const incomingBase = callbackBase(callbackUrl);
    const compatibleRedirectBases = options.compatibleRedirectBases?.map(
      callbackBase,
    );
    const isCompatibleRedirect =
      incomingBase === transaction.redirectBase ||
      (compatibleRedirectBases?.includes(transaction.redirectBase) === true &&
        compatibleRedirectBases.includes(incomingBase));
    if (!isCompatibleRedirect) {
      throw new AuthTransactionError(
        "unexpected_callback_uri",
        "Authentication returned to an unexpected callback URI.",
        transaction,
      );
    }

    let flowId: string | null = null;
    try {
      flowId = new URL(callbackUrl).searchParams.get("flow_id");
    } catch {
      // callbackBase has already produced the stable URI error above.
    }
    if (!flowId) {
      throw new AuthTransactionError(
        "missing_flow_id",
        "Authentication callback did not include its flow ID.",
        transaction,
      );
    }
    if (flowId !== transaction.flowId) {
      throw new AuthTransactionError(
        "flow_mismatch",
        "Authentication callback did not match the active flow.",
        transaction,
      );
    }

    await dependencies.storage.removeItem(AUTH_TRANSACTION_STORAGE_KEY);
    return transaction;
  });
}

export function cancelAuthTransaction(
  flowId: string,
  dependencies: AuthTransactionDependencies = defaultDependencies,
): Promise<void> {
  return withStorageLock(async () => {
    const transaction = await readStoredTransaction(dependencies);
    if (transaction?.flowId === flowId) {
      await dependencies.storage.removeItem(AUTH_TRANSACTION_STORAGE_KEY);
    }
  });
}
