import AsyncStorage from "@react-native-async-storage/async-storage";
import { randomUUID } from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { deviceTimeZone } from "./daily-context";

export const DAILY_REMINDER_STORAGE_KEY = "wikipath.daily-reminder.v1";
export const DAILY_REMINDER_TRANSITION_KEY =
  "wikipath.daily-reminder.transition.v1";
export const DAILY_REMINDER_IDENTIFIER_PREFIX = "wikipath.daily.v3.";
export const DAILY_REMINDER_HORIZON_DAYS = 28;
const IOS_PENDING_NOTIFICATION_LIMIT = 64;
const DEFAULT_REMINDER_HOUR = 9;
export const DAILY_NOTIFICATION_CONTENT = {
  body: "A new Daily Path is waiting.",
  data: { route: "/" },
  title: "Today's WikiRace is ready",
} as const;

export type ReminderPermission =
  | "denied"
  | "granted"
  | "provisional"
  | "undetermined";

export interface ReminderDelivery {
  id: string;
  localDate: string;
  scheduledAt: number;
}

export interface ReminderState {
  deliveries: ReminderDelivery[];
  enabled: boolean;
  hour: number;
  legacyIds: string[];
  permission: ReminderPermission;
  reconciledLocalDate: string;
  timeZone: string;
  version: 3;
}

interface LegacyReminderStateV1 {
  enabled: boolean;
  hour: number;
  notificationId: string | null;
  permission: ReminderPermission;
  timeZone: string;
  version: 1;
}

interface LegacyReminderStateV2 extends Omit<LegacyReminderStateV1, "version"> {
  scheduleKind: "disabled" | "repeating" | "seed";
  seedDate: string | null;
  version: 2;
}

interface ReminderTransition {
  cleanupIds: string[];
  installIds: string[];
  legacySource?: unknown;
  operation: "cleanup-invalid" | "transition";
  source: ReminderState | null;
  target: ReminderState;
  version: 2;
}

interface LegacyReminderTransitionV1 {
  cleanupIds: string[];
  source: LegacyReminderStateV2;
  target: LegacyReminderStateV2;
  version: 1;
}

type StoredReminderTransition = LegacyReminderTransitionV1 | ReminderTransition;

interface ReminderStorage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

type ReminderPlatform = "android" | "ios" | "other";

export interface ReminderDependencies {
  cancel(identifier: string): Promise<void>;
  createIdentifier(): string;
  getPermission(): Promise<ReminderPermission>;
  isDevelopment: boolean;
  listScheduled(): Promise<Array<{ identifier: string }>>;
  now(): Date;
  platform: ReminderPlatform;
  requestPermission(): Promise<ReminderPermission>;
  schedule(request: Notifications.NotificationRequestInput): Promise<string>;
  storage: ReminderStorage;
  timeZone(): string;
}

export interface ReminderService {
  disableDailyReminder(): Promise<ReminderState>;
  enableDailyReminder(hour?: number): Promise<ReminderState>;
  getDailyReminderState(): Promise<ReminderState>;
  reconcileDailyReminder(): Promise<ReminderState>;
  scheduleReminderTest(seconds: number): Promise<string>;
}

interface CivilDate {
  day: number;
  month: number;
  year: number;
}

interface LocalDateTime extends CivilDate {
  hour: number;
  minute: number;
}

type StableRead =
  | { kind: "absent" }
  | { kind: "invalid"; raw: unknown }
  | { kind: "valid"; needsPersist: boolean; state: ReminderState };

export function reminderPermissionFromNative(
  permission: Notifications.NotificationPermissionsStatus,
): ReminderPermission {
  if (
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return "provisional";
  }
  if (
    permission.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL
  ) {
    return "granted";
  }
  if (permission.granted || permission.status === "granted") return "granted";
  if (permission.status === "undetermined") return "undetermined";
  return "denied";
}

const defaultDependencies: ReminderDependencies = {
  cancel: Notifications.cancelScheduledNotificationAsync,
  createIdentifier: randomUUID,
  getPermission: async () =>
    reminderPermissionFromNative(await Notifications.getPermissionsAsync()),
  isDevelopment: typeof __DEV__ !== "undefined" && __DEV__,
  listScheduled: Notifications.getAllScheduledNotificationsAsync,
  now: () => new Date(),
  platform:
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : "other",
  requestPermission: async () =>
    reminderPermissionFromNative(
      await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
      }),
    ),
  schedule: Notifications.scheduleNotificationAsync,
  storage: AsyncStorage,
  timeZone: deviceTimeZone,
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isHour(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 23;
}

function isPermission(value: unknown): value is ReminderPermission {
  return (
    value === "denied" ||
    value === "granted" ||
    value === "provisional" ||
    value === "undetermined"
  );
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function parseCivilDate(value: unknown): CivilDate | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1970 || year > 9999 || month < 1 || month > 12 || day < 1) {
    return null;
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() + 1 === month &&
    candidate.getUTCDate() === day
    ? { day, month, year }
    : null;
}

function isoDate(date: CivilDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

function addCivilDays(value: string, days: number): string {
  const parsed = parseCivilDate(value);
  if (!parsed) throw new Error("Cannot advance an invalid civil date.");
  const next = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + days),
  );
  return isoDate({
    day: next.getUTCDate(),
    month: next.getUTCMonth() + 1,
    year: next.getUTCFullYear(),
  });
}

function localDateTime(date: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => {
    const value = Number(parts.find((entry) => entry.type === type)?.value);
    if (!Number.isInteger(value)) {
      throw new Error(`Could not resolve local ${type}.`);
    }
    return value;
  };
  return {
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    month: part("month"),
    year: part("year"),
  };
}

function localDate(date: Date, timeZone: string): string {
  return isoDate(localDateTime(date, timeZone));
}

function zonedDateTimeEpoch(
  localDateValue: string,
  hour: number,
  timeZone: string,
): number {
  const date = parseCivilDate(localDateValue);
  if (!date) throw new Error("Cannot schedule an invalid civil date.");
  const desired = Date.UTC(date.year, date.month - 1, date.day, hour, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const represented = localDateTime(new Date(guess), timeZone);
    const representedUtc = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
    );
    const adjustment = desired - representedUtc;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return guess;
}

function isUnique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

const LEGACY_V1_KEYS = [
  "enabled",
  "hour",
  "notificationId",
  "permission",
  "timeZone",
  "version",
] as const;
const LEGACY_V2_KEYS = [...LEGACY_V1_KEYS, "scheduleKind", "seedDate"] as const;

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    keys.every((key) => expected.includes(key))
  );
}

function isDelivery(
  value: unknown,
  hour: number,
  timeZone: string,
): value is ReminderDelivery {
  if (!isObject(value)) return false;
  if (
    !isIdentifier(value.id) ||
    !value.id.startsWith(DAILY_REMINDER_IDENTIFIER_PREFIX) ||
    !parseCivilDate(value.localDate) ||
    !Number.isSafeInteger(value.scheduledAt)
  ) {
    return false;
  }
  try {
    return (
      value.scheduledAt ===
      zonedDateTimeEpoch(value.localDate as string, hour, timeZone)
    );
  } catch {
    return false;
  }
}

function isReminderState(value: unknown): value is ReminderState {
  if (!isObject(value)) return false;
  if (
    value.version !== 3 ||
    typeof value.enabled !== "boolean" ||
    !isHour(value.hour) ||
    !isPermission(value.permission) ||
    !isValidTimeZone(value.timeZone) ||
    !parseCivilDate(value.reconciledLocalDate) ||
    !Array.isArray(value.deliveries) ||
    !Array.isArray(value.legacyIds) ||
    !value.legacyIds.every(isIdentifier) ||
    !isUnique(value.legacyIds) ||
    !value.deliveries.every((delivery) =>
      isDelivery(delivery, value.hour as number, value.timeZone as string),
    )
  ) {
    return false;
  }
  const deliveries = value.deliveries as ReminderDelivery[];
  const deliveryIds = deliveries.map((delivery) => delivery.id);
  const deliveryDates = deliveries.map((delivery) => delivery.localDate);
  if (
    !isUnique([...deliveryIds, ...value.legacyIds]) ||
    !isUnique(deliveryDates)
  ) {
    return false;
  }
  if (!value.enabled) {
    return deliveries.length === 0 && value.legacyIds.length === 0;
  }
  if (value.legacyIds.length > 0) return deliveries.length === 0;
  if (deliveries.length !== DAILY_REMINDER_HORIZON_DAYS) return false;
  const firstOffset =
    deliveries[0]?.localDate === value.reconciledLocalDate ? 0 : 1;
  return deliveries.every(
    (delivery, index) =>
      delivery.localDate ===
      addCivilDays(value.reconciledLocalDate as string, index + firstOffset),
  );
}

function isLegacyV1(value: unknown): value is LegacyReminderStateV1 {
  if (!isObject(value)) return false;
  return (
    hasExactKeys(value, LEGACY_V1_KEYS) &&
    value.version === 1 &&
    typeof value.enabled === "boolean" &&
    isHour(value.hour) &&
    (value.notificationId === null || isIdentifier(value.notificationId)) &&
    isPermission(value.permission) &&
    isValidTimeZone(value.timeZone) &&
    (value.enabled
      ? value.notificationId !== null
      : value.notificationId === null)
  );
}

function isLegacyV2(value: unknown): value is LegacyReminderStateV2 {
  if (!isObject(value)) return false;
  const seedDateValid =
    value.scheduleKind === "seed"
      ? Boolean(parseCivilDate(value.seedDate))
      : value.seedDate === null;
  return (
    hasExactKeys(value, LEGACY_V2_KEYS) &&
    value.version === 2 &&
    typeof value.enabled === "boolean" &&
    isHour(value.hour) &&
    (value.notificationId === null || isIdentifier(value.notificationId)) &&
    isPermission(value.permission) &&
    isValidTimeZone(value.timeZone) &&
    (value.scheduleKind === "disabled" ||
      value.scheduleKind === "repeating" ||
      value.scheduleKind === "seed") &&
    seedDateValid &&
    (value.enabled
      ? value.notificationId !== null && value.scheduleKind !== "disabled"
      : value.notificationId === null && value.scheduleKind === "disabled")
  );
}

function migrateLegacyState(
  value: LegacyReminderStateV1 | LegacyReminderStateV2,
  now: Date,
): ReminderState {
  return {
    deliveries: [],
    enabled: value.enabled,
    hour: value.hour,
    legacyIds:
      value.enabled && value.notificationId ? [value.notificationId] : [],
    permission: value.permission,
    reconciledLocalDate: localDate(now, value.timeZone),
    timeZone: value.timeZone,
    version: 3,
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isIdentifier) && isUnique(value);
}

function stateOwnedIds(state: ReminderState): string[] {
  return [
    ...state.deliveries.map((delivery) => delivery.id),
    ...state.legacyIds,
  ];
}

function setDifference(left: string[], right: string[]): string[] {
  const excluded = new Set(right);
  return left.filter((value) => !excluded.has(value));
}

function sameIdentifierSet(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((identifier) => right.includes(identifier))
  );
}

function legacyOwnedNotificationId(value: unknown): string | null {
  if (
    !isObject(value) ||
    value.enabled !== true ||
    !isHour(value.hour) ||
    !isIdentifier(value.notificationId) ||
    !isPermission(value.permission) ||
    !isValidTimeZone(value.timeZone)
  ) {
    return null;
  }
  if (value.version === 1) {
    return hasExactKeys(value, LEGACY_V1_KEYS) ? value.notificationId : null;
  }
  if (
    value.version !== 2 ||
    !hasExactKeys(value, LEGACY_V2_KEYS) ||
    (value.scheduleKind !== "seed" && value.scheduleKind !== "repeating") ||
    (value.scheduleKind === "repeating"
      ? value.seedDate !== null
      : typeof value.seedDate !== "string")
  ) {
    return null;
  }
  return value.notificationId;
}

function isReminderTransition(value: unknown): value is ReminderTransition {
  if (!isObject(value)) return false;
  if (
    value.version !== 2 ||
    (value.operation !== "transition" &&
      value.operation !== "cleanup-invalid") ||
    !isReminderState(value.target) ||
    !isStringArray(value.installIds) ||
    !isStringArray(value.cleanupIds) ||
    !value.installIds.every((id) =>
      id.startsWith(DAILY_REMINDER_IDENTIFIER_PREFIX),
    )
  ) {
    return false;
  }
  const installIds = value.installIds as string[];
  const cleanupIds = value.cleanupIds as string[];
  if (value.operation === "cleanup-invalid") {
    const legacyId = legacyOwnedNotificationId(value.legacySource);
    const permittedCleanupIds = cleanupIds.filter(
      (identifier) =>
        identifier.startsWith(DAILY_REMINDER_IDENTIFIER_PREFIX) ||
        identifier === legacyId,
    );
    return (
      value.source === null &&
      installIds.length === 0 &&
      value.target.enabled === false &&
      sameIdentifierSet(cleanupIds, permittedCleanupIds)
    );
  }
  if (!isReminderState(value.source)) return false;
  const sourceIds = stateOwnedIds(value.source);
  const targetIds = stateOwnedIds(value.target);
  return (
    sameIdentifierSet(installIds, setDifference(targetIds, sourceIds)) &&
    sameIdentifierSet(cleanupIds, setDifference(sourceIds, targetIds))
  );
}

function isLegacyReminderTransitionV1(
  value: unknown,
): value is LegacyReminderTransitionV1 {
  if (
    !isObject(value) ||
    value.version !== 1 ||
    !isLegacyV2(value.source) ||
    !isLegacyV2(value.target) ||
    !isStringArray(value.cleanupIds)
  ) {
    return false;
  }
  const expectedCleanupIds = value.source.notificationId
    ? [value.source.notificationId]
    : [];
  return sameIdentifierSet(value.cleanupIds, expectedCleanupIds);
}

function sameDelivery(left: ReminderDelivery, right: ReminderDelivery) {
  return (
    left.id === right.id &&
    left.localDate === right.localDate &&
    left.scheduledAt === right.scheduledAt
  );
}

function sameState(left: ReminderState, right: ReminderState): boolean {
  return (
    left.enabled === right.enabled &&
    left.hour === right.hour &&
    left.permission === right.permission &&
    left.reconciledLocalDate === right.reconciledLocalDate &&
    left.timeZone === right.timeZone &&
    left.legacyIds.length === right.legacyIds.length &&
    left.legacyIds.every((id, index) => id === right.legacyIds[index]) &&
    left.deliveries.length === right.deliveries.length &&
    left.deliveries.every((delivery, index) =>
      sameDelivery(delivery, right.deliveries[index]!),
    )
  );
}

function extractStoredIds(raw: unknown): string[] {
  if (!isObject(raw)) return [];
  const ids: string[] = [];
  const legacyId = legacyOwnedNotificationId(raw);
  if (legacyId) ids.push(legacyId);
  if (raw.version === 3) {
    if (Array.isArray(raw.legacyIds)) {
      for (const id of raw.legacyIds) {
        if (
          isIdentifier(id) &&
          id.startsWith(DAILY_REMINDER_IDENTIFIER_PREFIX)
        ) {
          ids.push(id);
        }
      }
    }
    if (Array.isArray(raw.deliveries)) {
      for (const delivery of raw.deliveries) {
        if (
          isObject(delivery) &&
          isIdentifier(delivery.id) &&
          delivery.id.startsWith(DAILY_REMINDER_IDENTIFIER_PREFIX)
        ) {
          ids.push(delivery.id);
        }
      }
    }
  }
  return [...new Set(ids)];
}

function disabledState(
  now: Date,
  timeZone: string,
  permission: ReminderPermission = "undetermined",
  hour = DEFAULT_REMINDER_HOUR,
): ReminderState {
  return {
    deliveries: [],
    enabled: false,
    hour,
    legacyIds: [],
    permission,
    reconciledLocalDate: localDate(now, timeZone),
    timeZone,
    version: 3,
  };
}

function permissionAllowsReminder(permission: ReminderPermission): boolean {
  return permission === "granted" || permission === "provisional";
}

function namespaceIdentifier(raw: string): string {
  return raw.startsWith(DAILY_REMINDER_IDENTIFIER_PREFIX)
    ? raw
    : `${DAILY_REMINDER_IDENTIFIER_PREFIX}${raw}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function recoveryError(primary: unknown, recovery: unknown): Error {
  return new Error(
    `${errorMessage(primary)}; reminder recovery failed: ${errorMessage(recovery)}`,
  );
}

export function createReminderService(
  dependencies: ReminderDependencies,
): ReminderService {
  let queue: Promise<void> = Promise.resolve();

  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async function writeState(state: ReminderState): Promise<ReminderState> {
    await dependencies.storage.setItem(
      DAILY_REMINDER_STORAGE_KEY,
      JSON.stringify(state),
    );
    return state;
  }

  async function readStable(): Promise<StableRead> {
    const stored = await dependencies.storage.getItem(
      DAILY_REMINDER_STORAGE_KEY,
    );
    if (!stored) return { kind: "absent" };
    let parsed: unknown;
    try {
      parsed = JSON.parse(stored);
    } catch {
      return { kind: "invalid", raw: stored };
    }
    if (isReminderState(parsed)) {
      return { kind: "valid", needsPersist: false, state: parsed };
    }
    if (isLegacyV1(parsed) || isLegacyV2(parsed)) {
      return {
        kind: "valid",
        needsPersist: true,
        state: migrateLegacyState(parsed, dependencies.now()),
      };
    }
    return { kind: "invalid", raw: parsed };
  }

  async function readTransition(): Promise<StoredReminderTransition | null> {
    const stored = await dependencies.storage.getItem(
      DAILY_REMINDER_TRANSITION_KEY,
    );
    if (!stored) return null;
    try {
      const parsed: unknown = JSON.parse(stored);
      if (isReminderTransition(parsed)) return parsed;
      if (isLegacyReminderTransitionV1(parsed)) return parsed;
    } catch {
      // Corrupt ownership must be retained and surfaced below.
    }
    throw new Error("Daily reminder recovery state is invalid.");
  }

  async function writeTransition(transition: ReminderTransition) {
    await dependencies.storage.setItem(
      DAILY_REMINDER_TRANSITION_KEY,
      JSON.stringify(transition),
    );
  }

  async function removeTransition() {
    await dependencies.storage.removeItem(DAILY_REMINDER_TRANSITION_KEY);
  }

  async function cancelOwnedIdentifiers(identifiers: string[]) {
    const failures: unknown[] = [];
    for (const identifier of identifiers) {
      try {
        await dependencies.cancel(identifier);
      } catch (error) {
        failures.push(error);
      }
    }
    if (failures.length > 0) throw failures[0];
  }

  function requestForDelivery(
    delivery: ReminderDelivery,
  ): Notifications.NotificationRequestInput {
    return {
      content: DAILY_NOTIFICATION_CONTENT,
      identifier: delivery.id,
      trigger: {
        date: delivery.scheduledAt,
        type: Notifications.SchedulableTriggerInputTypes.DATE,
      },
    };
  }

  function missingFutureDeliveries(
    state: ReminderState,
    scheduled: Array<{ identifier: string }>,
  ): ReminderDelivery[] {
    const nativeIds = new Set(scheduled.map((request) => request.identifier));
    const now = dependencies.now().getTime();
    return state.deliveries.filter(
      (delivery) => delivery.scheduledAt > now && !nativeIds.has(delivery.id),
    );
  }

  function assertPendingCapacity(
    scheduled: Array<{ identifier: string }>,
    installIds: string[],
  ) {
    if (dependencies.platform !== "ios") return;
    const pendingIds = new Set(scheduled.map((request) => request.identifier));
    const genuinelyNewCount = installIds.filter(
      (identifier) => !pendingIds.has(identifier),
    ).length;
    if (scheduled.length + genuinelyNewCount > IOS_PENDING_NOTIFICATION_LIMIT) {
      throw new Error(
        "Daily reminder transition exceeds iOS pending notification capacity.",
      );
    }
  }

  function assertFutureDeliveriesPending(
    state: ReminderState,
    scheduled: Array<{ identifier: string }>,
  ) {
    const missing = missingFutureDeliveries(state, scheduled);
    if (missing.length > 0) {
      throw new Error(
        `Native scheduler did not retain future WikiRace delivery ${missing[0]!.id}.`,
      );
    }
  }

  async function ensureFutureDeliveriesPending(state: ReminderState) {
    let scheduled = await dependencies.listScheduled();
    const missing = missingFutureDeliveries(state, scheduled);
    if (missing.length === 0) return;
    assertPendingCapacity(
      scheduled,
      missing.map((delivery) => delivery.id),
    );
    for (const delivery of missing) {
      const identifier = await dependencies.schedule(
        requestForDelivery(delivery),
      );
      if (identifier !== delivery.id) {
        throw new Error("Native scheduler returned an unexpected identifier.");
      }
    }
    scheduled = await dependencies.listScheduled();
    assertFutureDeliveriesPending(state, scheduled);
  }

  async function recoverInvalidState(raw: unknown): Promise<ReminderState> {
    const native = await dependencies.listScheduled();
    const cleanupIds = [
      ...extractStoredIds(raw),
      ...native
        .map((request) => request.identifier)
        .filter((id) => id.startsWith(DAILY_REMINDER_IDENTIFIER_PREFIX)),
    ].filter((id, index, all) => all.indexOf(id) === index);
    const target = disabledState(dependencies.now(), dependencies.timeZone());
    const transition: ReminderTransition = {
      cleanupIds,
      installIds: [],
      legacySource: legacyOwnedNotificationId(raw) ? raw : undefined,
      operation: "cleanup-invalid",
      source: null,
      target,
      version: 2,
    };
    await writeTransition(transition);
    await writeState(target);
    await cancelOwnedIdentifiers(cleanupIds);
    await removeTransition();
    return target;
  }

  async function ensureStable(): Promise<ReminderState> {
    const record = await readStable();
    if (record.kind === "invalid") return recoverInvalidState(record.raw);
    if (record.kind === "absent") {
      return writeState(
        disabledState(dependencies.now(), dependencies.timeZone()),
      );
    }
    if (record.needsPersist) await writeState(record.state);
    return record.state;
  }

  async function repairTransition(): Promise<ReminderState> {
    const transition = await readTransition();
    if (!transition) return ensureStable();
    const record = await readStable();

    if (transition.version === 1) {
      if (record.kind !== "valid") {
        throw new Error(
          "Daily reminder recovery state does not match its source or target.",
        );
      }
      const source = migrateLegacyState(transition.source, dependencies.now());
      const target = migrateLegacyState(transition.target, dependencies.now());
      if (sameState(record.state, target)) {
        await writeState(target);
        await cancelOwnedIdentifiers(transition.cleanupIds);
        await removeTransition();
        return target;
      }
      if (sameState(record.state, source)) {
        if (transition.target.notificationId) {
          await cancelOwnedIdentifiers([transition.target.notificationId]);
        }
        await writeState(source);
        await removeTransition();
        return source;
      }
      throw new Error(
        "Daily reminder recovery state does not match its source or target.",
      );
    }

    if (transition.operation === "cleanup-invalid") {
      if (
        record.kind !== "valid" ||
        !sameState(record.state, transition.target)
      ) {
        await writeState(transition.target);
      }
      await cancelOwnedIdentifiers(transition.cleanupIds);
      await removeTransition();
      return transition.target;
    }

    if (record.kind !== "valid" || !transition.source) {
      throw new Error(
        "Daily reminder recovery state does not match its source or target.",
      );
    }
    if (sameState(record.state, transition.target)) {
      await ensureFutureDeliveriesPending(transition.target);
      await cancelOwnedIdentifiers(transition.cleanupIds);
      await ensureFutureDeliveriesPending(transition.target);
      await removeTransition();
      return transition.target;
    }
    if (sameState(record.state, transition.source)) {
      await cancelOwnedIdentifiers(transition.installIds);
      await ensureFutureDeliveriesPending(transition.source);
      await removeTransition();
      return transition.source;
    }
    throw new Error(
      "Daily reminder recovery state does not match its source or target.",
    );
  }

  async function rollbackUncommitted(
    transition: ReminderTransition,
    primaryError: unknown,
  ): Promise<never> {
    try {
      await cancelOwnedIdentifiers(transition.installIds);
      await removeTransition();
    } catch (rollbackError) {
      throw recoveryError(primaryError, rollbackError);
    }
    throw primaryError;
  }

  async function transitionState(
    source: ReminderState,
    target: ReminderState,
    installRequests: Notifications.NotificationRequestInput[],
  ): Promise<ReminderState> {
    const sourceIds = stateOwnedIds(source);
    const targetIds = stateOwnedIds(target);
    const installIds = setDifference(targetIds, sourceIds);
    const cleanupIds = setDifference(sourceIds, targetIds);
    const requestIds = installRequests.map((request) => request.identifier!);
    if (!sameIdentifierSet(requestIds, installIds)) {
      throw new Error(
        "Daily reminder install requests do not match their ownership transition.",
      );
    }
    if (
      installIds.length > DAILY_REMINDER_HORIZON_DAYS ||
      cleanupIds.length > DAILY_REMINDER_HORIZON_DAYS
    ) {
      throw new Error("Daily reminder transition exceeds its safe horizon.");
    }
    const transition: ReminderTransition = {
      cleanupIds,
      installIds,
      operation: "transition",
      source,
      target,
      version: 2,
    };
    const scheduledBefore = await dependencies.listScheduled();
    assertPendingCapacity(scheduledBefore, installIds);
    await writeTransition(transition);

    try {
      for (const request of installRequests) {
        const identifier = await dependencies.schedule(request);
        if (identifier !== request.identifier) {
          throw new Error(
            "Native scheduler returned an unexpected identifier.",
          );
        }
      }
      assertFutureDeliveriesPending(target, await dependencies.listScheduled());
    } catch (scheduleError) {
      return rollbackUncommitted(transition, scheduleError);
    }

    try {
      await writeState(target);
    } catch (storageError) {
      return rollbackUncommitted(transition, storageError);
    }

    await cancelOwnedIdentifiers(cleanupIds);
    assertFutureDeliveriesPending(target, await dependencies.listScheduled());
    await removeTransition();
    return target;
  }

  async function resolvePermission(): Promise<ReminderPermission> {
    const current = await dependencies.getPermission();
    return current === "undetermined"
      ? dependencies.requestPermission()
      : current;
  }

  function buildHorizon(
    source: ReminderState,
    hour: number,
    permission: ReminderPermission,
    timeZone: string,
    includeToday: boolean,
    scheduled: Array<{ identifier: string }>,
  ): {
    requests: Notifications.NotificationRequestInput[];
    state: ReminderState;
  } {
    const reconciledLocalDate = localDate(dependencies.now(), timeZone);
    const now = dependencies.now().getTime();
    const nativeIds = new Set(scheduled.map((request) => request.identifier));
    const reservedIds = new Set([
      ...stateOwnedIds(source),
      ...scheduled.map((request) => request.identifier),
    ]);
    const deliveries = Array.from(
      { length: DAILY_REMINDER_HORIZON_DAYS },
      (_, index): ReminderDelivery => {
        const localDateValue = addCivilDays(
          reconciledLocalDate,
          index + (includeToday ? 0 : 1),
        );
        const scheduledAt = zonedDateTimeEpoch(localDateValue, hour, timeZone);
        const reusable = source.deliveries.find(
          (delivery) =>
            delivery.localDate === localDateValue &&
            delivery.scheduledAt === scheduledAt &&
            (delivery.scheduledAt <= now || nativeIds.has(delivery.id)),
        );
        if (reusable) return reusable;
        const rawIdentifier = dependencies.createIdentifier();
        if (!rawIdentifier) {
          throw new Error("Could not create reminder identifier.");
        }
        const id = namespaceIdentifier(rawIdentifier);
        if (reservedIds.has(id)) {
          throw new Error("Could not create unique reminder identifiers.");
        }
        reservedIds.add(id);
        return {
          id,
          localDate: localDateValue,
          scheduledAt,
        };
      },
    );
    if (!isUnique(deliveries.map((delivery) => delivery.id))) {
      throw new Error("Could not create unique reminder identifiers.");
    }
    const state: ReminderState = {
      deliveries,
      enabled: true,
      hour,
      legacyIds: [],
      permission,
      reconciledLocalDate,
      timeZone,
      version: 3,
    };
    const sourceIds = new Set(stateOwnedIds(source));
    const requests = deliveries
      .filter((delivery) => !sourceIds.has(delivery.id))
      .map(
        (delivery): Notifications.NotificationRequestInput => ({
          ...requestForDelivery(delivery),
        }),
      );
    return { requests, state };
  }

  async function disableState(
    source: ReminderState,
    permission = source.permission,
  ): Promise<ReminderState> {
    const target = disabledState(
      dependencies.now(),
      dependencies.timeZone(),
      permission,
      source.hour,
    );
    return source.enabled
      ? transitionState(source, target, [])
      : writeState(target);
  }

  async function reconcileEnabledState(
    source: ReminderState,
    permission: ReminderPermission,
    desiredHour = source.hour,
  ): Promise<ReminderState> {
    if (!permissionAllowsReminder(permission)) {
      return disableState(source, "denied");
    }
    const timeZone = dependencies.timeZone();
    const today = localDate(dependencies.now(), timeZone);
    const scheduled = await dependencies.listScheduled();
    const horizonCurrent =
      source.timeZone === timeZone &&
      source.hour === desiredHour &&
      source.reconciledLocalDate === today &&
      source.legacyIds.length === 0 &&
      source.deliveries.length === DAILY_REMINDER_HORIZON_DAYS;
    const missingCurrentFuture = horizonCurrent
      ? missingFutureDeliveries(source, scheduled)
      : [];
    if (horizonCurrent && missingCurrentFuture.length === 0) {
      return source.permission === permission
        ? source
        : writeState({ ...source, permission });
    }
    const includeToday = horizonCurrent
      ? source.deliveries[0]?.localDate === today
      : source.timeZone === timeZone &&
        source.hour === desiredHour &&
        source.reconciledLocalDate !== today &&
        localDateTime(dependencies.now(), timeZone).hour < desiredHour;
    const next = buildHorizon(
      source,
      desiredHour,
      permission,
      timeZone,
      includeToday,
      scheduled,
    );
    return transitionState(source, next.state, next.requests);
  }

  return {
    getDailyReminderState: () => serialized(repairTransition),
    enableDailyReminder: (hour = DEFAULT_REMINDER_HOUR) =>
      serialized(async () => {
        if (!isHour(hour)) {
          throw new Error("Daily reminder hour must be between 0 and 23.");
        }
        const source = await repairTransition();
        const permission = await resolvePermission();
        if (!permissionAllowsReminder(permission)) {
          return disableState(source, "denied");
        }
        return reconcileEnabledState(source, permission, hour);
      }),
    disableDailyReminder: () =>
      serialized(async () => disableState(await repairTransition())),
    reconcileDailyReminder: () =>
      serialized(async () => {
        const source = await repairTransition();
        if (!source.enabled) return source;
        return reconcileEnabledState(source, await resolvePermission());
      }),
    scheduleReminderTest: (seconds: number) =>
      serialized(async () => {
        if (!dependencies.isDevelopment) {
          throw new Error("Test reminders are available only in development.");
        }
        if (!Number.isFinite(seconds) || seconds <= 0) {
          throw new Error("Test reminder delay must be greater than zero.");
        }
        const permission = await resolvePermission();
        if (!permissionAllowsReminder(permission)) {
          throw new Error("Notifications are not allowed on this device.");
        }
        return dependencies.schedule({
          content: DAILY_NOTIFICATION_CONTENT,
          trigger: {
            repeats: false,
            seconds,
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          },
        });
      }),
  };
}

const defaultService = createReminderService(defaultDependencies);

export const disableDailyReminder = defaultService.disableDailyReminder;
export const enableDailyReminder = defaultService.enableDailyReminder;
export const getDailyReminderState = defaultService.getDailyReminderState;
export const reconcileDailyReminder = defaultService.reconcileDailyReminder;
export const scheduleReminderTest = defaultService.scheduleReminderTest;

export function foregroundReminderBehavior() {
  return {
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  } as const;
}

export function reminderRouteFromResponse(response: unknown): "/" | null {
  if (!response || typeof response !== "object") return null;
  const candidate = response as {
    actionIdentifier?: unknown;
    notification?: {
      request?: { content?: { data?: { route?: unknown } } };
    };
  };
  if (
    candidate.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER ||
    candidate.notification?.request?.content?.data?.route !== "/"
  ) {
    return null;
  }
  return "/";
}
