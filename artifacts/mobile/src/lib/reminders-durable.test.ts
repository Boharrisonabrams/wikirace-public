import { describe, expect, it, vi } from "vitest";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    removeItem: vi.fn(),
    setItem: vi.fn(),
  },
}));
vi.mock("expo-crypto", () => ({ randomUUID: vi.fn(() => "native-id") }));
vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  IosAuthorizationStatus: { EPHEMERAL: 4, PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: {
    CALENDAR: "calendar",
    DAILY: "daily",
    DATE: "date",
    TIME_INTERVAL: "timeInterval",
  },
  cancelScheduledNotificationAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import { createReminderService, type ReminderDependencies } from "./reminders";

const STATE_KEY = "wikipath.daily-reminder.v1";
const JOURNAL_KEY = "wikipath.daily-reminder.transition.v1";
const PREFIX = "wikipath.daily.v3.";

interface Delivery {
  id: string;
  localDate: string;
  scheduledAt: number;
}

interface V3State {
  deliveries: Delivery[];
  enabled: boolean;
  hour: number;
  legacyIds: string[];
  permission: "granted" | "undetermined";
  reconciledLocalDate: string;
  timeZone: string;
  version: 3;
}

function addUtcDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function deliveryEpoch(localDate: string, timeZone: string, hour = 9): number {
  const [year, month, day] = localDate.split("-").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(new Date(guess));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
    );
    const adjustment = desired - represented;
    guess += adjustment;
    if (adjustment === 0) break;
  }
  return guess;
}

function horizon(
  reconciledLocalDate = "2026-03-07",
  timeZone = "America/Los_Angeles",
  idLabel = "old",
): V3State {
  return {
    deliveries: Array.from({ length: 28 }, (_, index) => {
      const localDate = addUtcDays(reconciledLocalDate, index + 1);
      return {
        id: `${PREFIX}${idLabel}-${index + 1}`,
        localDate,
        scheduledAt: deliveryEpoch(localDate, timeZone),
      };
    }),
    enabled: true,
    hour: 9,
    legacyIds: [],
    permission: "granted",
    reconciledLocalDate,
    timeZone,
    version: 3,
  };
}

function disabled(timeZone = "America/Los_Angeles"): V3State {
  return {
    deliveries: [],
    enabled: false,
    hour: 9,
    legacyIds: [],
    permission: "undetermined",
    reconciledLocalDate: "2026-03-07",
    timeZone,
    version: 3,
  };
}

function storageHarness(initial?: unknown) {
  const values = new Map<string, string>();
  if (initial !== undefined) values.set(STATE_KEY, JSON.stringify(initial));
  const storage = {
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
  return {
    read(key: string) {
      const value = values.get(key);
      return value ? (JSON.parse(value) as Record<string, unknown>) : null;
    },
    storage,
    write(key: string, value: unknown) {
      values.set(key, JSON.stringify(value));
    },
  };
}

function nativeIdsFromInitial(initial: unknown): string[] {
  if (!initial || typeof initial !== "object") return [];
  const value = initial as {
    deliveries?: Array<{ id?: unknown }>;
    notificationId?: unknown;
  };
  const ids = Array.isArray(value.deliveries)
    ? value.deliveries
        .map((delivery) => delivery.id)
        .filter(
          (id): id is string => typeof id === "string" && id.startsWith(PREFIX),
        )
    : [];
  if (
    (value as { version?: unknown }).version !== 3 &&
    typeof value.notificationId === "string"
  ) {
    ids.push(value.notificationId);
  }
  return ids;
}

function harness(
  options: {
    cancel?: ReminderDependencies["cancel"];
    dropScheduledIds?: string[];
    initial?: unknown;
    nativeIds?: string[];
    now?: Date;
    timeZone?: string;
  } = {},
) {
  const persisted = storageHarness(options.initial);
  const nativeIds = new Set(
    options.nativeIds ?? nativeIdsFromInitial(options.initial),
  );
  let identifier = 0;
  const cancel = vi.fn(async (id: string) => {
    if (options.cancel) await options.cancel(id);
    nativeIds.delete(id);
  });
  const dependencies = {
    cancel,
    createIdentifier: vi.fn(() => `raw-${++identifier}`),
    getPermission: vi.fn(async () => "granted" as const),
    isDevelopment: true,
    listScheduled: vi.fn(async () =>
      [...nativeIds].map((id) => ({ identifier: id })),
    ),
    now: vi.fn(() => options.now ?? new Date("2026-03-07T16:00:00.000Z")),
    platform: "ios" as const,
    requestPermission: vi.fn(async () => "granted" as const),
    schedule: vi.fn(async (request: { identifier?: string }) => {
      if (!request.identifier) throw new Error("identifier required");
      if (!options.dropScheduledIds?.includes(request.identifier)) {
        nativeIds.add(request.identifier);
      }
      return request.identifier;
    }),
    storage: persisted.storage,
    timeZone: vi.fn(() => options.timeZone ?? "America/Los_Angeles"),
  };
  return {
    dependencies,
    nativeIds,
    persisted,
    service: createReminderService(
      dependencies as unknown as ReminderDependencies,
    ),
  };
}

describe("28-day durable reminder horizon", () => {
  it("does no native work when the ownership journal cannot be prepared", async () => {
    const initial = disabled();
    const { dependencies, persisted, service } = harness({ initial });
    persisted.storage.setItem.mockRejectedValueOnce(
      new Error("journal storage unavailable"),
    );

    await expect(service.enableDailyReminder()).rejects.toThrow(
      "journal storage unavailable",
    );

    expect(dependencies.schedule).not.toHaveBeenCalled();
    expect(dependencies.cancel).not.toHaveBeenCalled();
    expect(persisted.read(STATE_KEY)).toEqual(initial);
  });

  it("persists the initial disabled source before installing 28 owned days", async () => {
    const { dependencies, persisted, service } = harness();

    const result = (await service.enableDailyReminder()) as unknown as V3State;

    expect(result.version).toBe(3);
    expect(result.deliveries).toHaveLength(28);
    expect(result.deliveries[0]).toEqual({
      id: `${PREFIX}raw-1`,
      localDate: "2026-03-08",
      scheduledAt: Date.parse("2026-03-08T16:00:00.000Z"),
    });
    expect(result.deliveries[27]).toMatchObject({ localDate: "2026-04-04" });
    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(
      dependencies.schedule.mock.calls.map(([request]) => request.identifier),
    ).toEqual(result.deliveries.map((delivery) => delivery.id));
    expect(persisted.storage.setItem.mock.calls[0]?.[0]).toBe(STATE_KEY);
    expect(persisted.storage.setItem.mock.calls[1]?.[0]).toBe(JOURNAL_KEY);
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });

  it("rolls back when native reports success but omits a future delivery", async () => {
    const initial = disabled();
    const { dependencies, persisted, service } = harness({
      dropScheduledIds: [`${PREFIX}raw-7`],
      initial,
    });

    await expect(service.enableDailyReminder()).rejects.toThrow(
      /native scheduler did not retain.*raw-7/i,
    );

    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
    expect(persisted.read(STATE_KEY)).toEqual(initial);
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });

  it("preflights total iOS pending capacity before journaling or scheduling", async () => {
    const unrelated = Array.from(
      { length: 37 },
      (_, index) => `another-app-${index + 1}`,
    );
    const { dependencies, persisted, service } = harness({
      initial: disabled(),
      nativeIds: unrelated,
    });

    await expect(service.enableDailyReminder()).rejects.toThrow(
      /pending notification capacity/i,
    );

    expect(dependencies.schedule).not.toHaveBeenCalled();
    expect(dependencies.cancel).not.toHaveBeenCalled();
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });

  it("crosses Dec 31 with 28 independent future deliveries", async () => {
    const { service } = harness({
      now: new Date("2026-12-31T18:00:00.000Z"),
    });

    const result = (await service.enableDailyReminder()) as unknown as V3State;

    expect(result.deliveries[0]).toMatchObject({
      localDate: "2027-01-01",
      scheduledAt: Date.parse("2027-01-01T17:00:00.000Z"),
    });
    expect(result.deliveries[27]?.localDate).toBe("2027-01-28");
  });

  it("is a complete no-op on repeated activation during the same local day", async () => {
    const initial = horizon();
    const { dependencies, persisted, service } = harness({ initial });

    await expect(service.reconcileDailyReminder()).resolves.toEqual(initial);

    expect(dependencies.schedule).not.toHaveBeenCalled();
    expect(dependencies.cancel).not.toHaveBeenCalled();
    expect(persisted.storage.setItem).not.toHaveBeenCalled();
  });

  it("repairs a missing same-day future delivery from native inventory", async () => {
    const initial = horizon();
    const missing = initial.deliveries[4]!;
    const nativeIds = initial.deliveries
      .filter((delivery) => delivery.id !== missing.id)
      .map((delivery) => delivery.id);
    const { dependencies, service } = harness({ initial, nativeIds });

    const result =
      (await service.reconcileDailyReminder()) as unknown as V3State;

    expect(dependencies.schedule).toHaveBeenCalledOnce();
    expect(dependencies.cancel).toHaveBeenCalledExactlyOnceWith(missing.id);
    expect(result.deliveries[4]).toMatchObject({
      id: `${PREFIX}raw-1`,
      localDate: missing.localDate,
      scheduledAt: missing.scheduledAt,
    });
    expect(result.deliveries[3]).toEqual(initial.deliveries[3]);
    expect(result.deliveries[5]).toEqual(initial.deliveries[5]);
  });

  it("tolerates a missing same-day delivery whose epoch is already past", async () => {
    const initial = {
      ...horizon(),
      reconciledLocalDate: "2026-03-08",
    };
    const nativeIds = initial.deliveries
      .slice(1)
      .map((delivery) => delivery.id);
    const { dependencies, service } = harness({
      initial,
      nativeIds,
      now: new Date("2026-03-08T17:00:00.000Z"),
    });

    await expect(service.reconcileDailyReminder()).resolves.toEqual(initial);

    expect(dependencies.listScheduled).toHaveBeenCalled();
    expect(dependencies.schedule).not.toHaveBeenCalled();
    expect(dependencies.cancel).not.toHaveBeenCalled();
  });

  it("rolls the horizon by reusing 27 deliveries and installing one tail", async () => {
    const initial = horizon();
    const { dependencies, service } = harness({
      initial,
      now: new Date("2026-03-08T17:00:00.000Z"),
    });

    const result =
      (await service.reconcileDailyReminder()) as unknown as V3State;

    expect(result.reconciledLocalDate).toBe("2026-03-08");
    expect(result.deliveries[0]?.localDate).toBe("2026-03-09");
    expect(result.deliveries[27]?.localDate).toBe("2026-04-05");
    expect(result.deliveries.slice(0, 27)).toEqual(initial.deliveries.slice(1));
    expect(dependencies.schedule).toHaveBeenCalledOnce();
    expect(dependencies.cancel).toHaveBeenCalledExactlyOnceWith(
      initial.deliveries[0]!.id,
    );
  });

  it("preserves today's still-pending 9 AM delivery on a before-9 renewal", async () => {
    const initial = horizon();
    const { dependencies, service } = harness({
      initial,
      now: new Date("2026-03-08T15:00:00.000Z"),
    });

    const result =
      (await service.reconcileDailyReminder()) as unknown as V3State;

    expect(result.reconciledLocalDate).toBe("2026-03-08");
    expect(result.deliveries[0]).toMatchObject({
      id: initial.deliveries[0]!.id,
      localDate: "2026-03-08",
      scheduledAt: Date.parse("2026-03-08T16:00:00.000Z"),
    });
    expect(result.deliveries[27]?.localDate).toBe("2026-04-04");
    expect(result.deliveries).toEqual(initial.deliveries);
    expect(dependencies.schedule).not.toHaveBeenCalled();
    expect(dependencies.cancel).not.toHaveBeenCalled();
  });

  it("rebuilds tomorrow's horizon after a timezone change", async () => {
    const initial = horizon();
    const { dependencies, service } = harness({
      initial,
      timeZone: "America/New_York",
    });

    const result =
      (await service.reconcileDailyReminder()) as unknown as V3State;

    expect(result.timeZone).toBe("America/New_York");
    expect(result.deliveries[0]).toMatchObject({
      localDate: "2026-03-08",
      scheduledAt: Date.parse("2026-03-08T13:00:00.000Z"),
    });
    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
  });

  it("rebuilds all deliveries when an existing enabled hour changes", async () => {
    const initial = horizon();
    const { dependencies, service } = harness({ initial });

    const result = (await service.enableDailyReminder(8)) as unknown as V3State;

    expect(result.hour).toBe(8);
    expect(result.deliveries[0]?.scheduledAt).toBe(
      Date.parse("2026-03-08T15:00:00.000Z"),
    );
    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
  });

  it("finishes committed rollover cleanup after a brand-new service starts", async () => {
    const initial = horizon();
    const failFirstCancel = vi
      .fn<ReminderDependencies["cancel"]>()
      .mockRejectedValueOnce(new Error("cleanup interrupted"))
      .mockResolvedValue(undefined);
    const { dependencies, nativeIds, persisted, service } = harness({
      cancel: failFirstCancel,
      initial,
      now: new Date("2026-03-08T17:00:00.000Z"),
    });

    await expect(service.reconcileDailyReminder()).rejects.toThrow(
      "cleanup interrupted",
    );
    const committed = persisted.read(STATE_KEY) as unknown as V3State;
    expect(committed.deliveries.slice(0, 27)).toEqual(
      initial.deliveries.slice(1),
    );
    expect(persisted.read(JOURNAL_KEY)).not.toBeNull();

    const restarted = createReminderService(dependencies);
    await expect(restarted.reconcileDailyReminder()).resolves.toEqual(
      committed,
    );

    expect(dependencies.schedule).toHaveBeenCalledOnce();
    expect([...nativeIds].sort()).toEqual(
      committed.deliveries.map((delivery) => delivery.id).sort(),
    );
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });

  it("journals every new ID when a multi-install rollback needs recovery", async () => {
    const cancel = vi
      .fn<ReminderDependencies["cancel"]>()
      .mockRejectedValueOnce(new Error("cancel unavailable"))
      .mockResolvedValue(undefined);
    const { dependencies, persisted, service } = harness({ cancel });
    dependencies.schedule.mockRejectedValueOnce(new Error("schedule failed"));

    await expect(service.enableDailyReminder()).rejects.toThrow(
      /schedule failed.*cancel unavailable/i,
    );
    expect(persisted.read(JOURNAL_KEY)).toMatchObject({
      cleanupIds: [],
      installIds: Array.from(
        { length: 28 },
        (_, index) => `${PREFIX}raw-${index + 1}`,
      ),
    });

    vi.mocked(dependencies.timeZone).mockReturnValue("America/New_York");

    const restarted = createReminderService(dependencies);
    await restarted.reconcileDailyReminder();

    // All 28 IDs are attempted during rollback, then all 28 are retried from
    // the retained journal. One failed cancellation cannot hide later IDs.
    expect(dependencies.cancel).toHaveBeenCalledTimes(56);
    expect(persisted.read(STATE_KEY)).toMatchObject({ enabled: false });
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });

  it("rolls back all 28 installs when the stable target write fails", async () => {
    const initial = disabled();
    const { dependencies, persisted, service } = harness({ initial });
    persisted.storage.setItem.mockImplementation(async (key, value) => {
      const parsed = JSON.parse(value) as { enabled?: boolean };
      if (key === STATE_KEY && parsed.enabled === true) {
        throw new Error("state storage unavailable");
      }
      persisted.write(key, parsed);
    });

    await expect(service.enableDailyReminder()).rejects.toThrow(
      "state storage unavailable",
    );

    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
    expect(persisted.read(STATE_KEY)).toEqual(initial);
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });

  it("retains failed disable cleanup and completes it on recovery", async () => {
    const cancel = vi
      .fn<ReminderDependencies["cancel"]>()
      .mockRejectedValueOnce(new Error("cancel unavailable"))
      .mockResolvedValue(undefined);
    const { dependencies, persisted, service } = harness({
      cancel,
      initial: horizon(),
    });

    await expect(service.disableDailyReminder()).rejects.toThrow(
      "cancel unavailable",
    );
    expect(persisted.read(STATE_KEY)).toMatchObject({ enabled: false });
    expect(persisted.read(JOURNAL_KEY)).toMatchObject({
      cleanupIds: expect.arrayContaining([`${PREFIX}old-1`]),
    });

    const restarted = createReminderService(dependencies);
    await restarted.reconcileDailyReminder();

    expect(cancel).toHaveBeenCalledTimes(56);
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });
});

describe("invalid persisted reminder recovery", () => {
  const invalidDates = ["", "2026-3-08", "2026-02-30"];

  for (const localDate of invalidDates) {
    it(`cleans an invalid stored civil date ${JSON.stringify(localDate)}`, async () => {
      const invalid = horizon();
      invalid.deliveries[0] = {
        ...invalid.deliveries[0]!,
        localDate,
      };
      const { dependencies, persisted, service } = harness({
        initial: invalid,
      });

      await expect(service.getDailyReminderState()).resolves.toMatchObject({
        enabled: false,
        version: 3,
      });

      expect(dependencies.cancel).toHaveBeenCalledWith(`${PREFIX}old-1`);
      expect(persisted.read(JOURNAL_KEY)).toBeNull();
    });
  }

  it("cleans an empty legacy seed date without losing its old ID", async () => {
    const { dependencies, service } = harness({
      initial: {
        enabled: true,
        hour: 9,
        notificationId: "legacy-seed-id",
        permission: "granted",
        scheduleKind: "seed",
        seedDate: "",
        timeZone: "America/Los_Angeles",
        version: 2,
      },
    });

    await service.getDailyReminderState();

    expect(dependencies.cancel).toHaveBeenCalledWith("legacy-seed-id");
  });

  it("cleans a canonical date with a mismatched epoch", async () => {
    const invalid = horizon();
    invalid.deliveries[0] = {
      ...invalid.deliveries[0]!,
      scheduledAt: invalid.deliveries[0]!.scheduledAt + 60_000,
    };
    const { dependencies, service } = harness({ initial: invalid });

    await service.getDailyReminderState();

    expect(dependencies.cancel).toHaveBeenCalledWith(`${PREFIX}old-1`);
  });

  it("journals stored and native WikiPath IDs before cleaning invalid state", async () => {
    const invalid = horizon();
    invalid.deliveries[0] = {
      ...invalid.deliveries[0]!,
      localDate: "impossible",
    };
    const { dependencies, persisted, service } = harness({
      initial: invalid,
      nativeIds: [`${PREFIX}native-orphan`, "another-app.notification"],
    });
    vi.mocked(dependencies.cancel).mockImplementation(async () => {
      expect(persisted.read(JOURNAL_KEY)).toMatchObject({
        cleanupIds: expect.arrayContaining([
          `${PREFIX}old-1`,
          `${PREFIX}native-orphan`,
        ]),
      });
      expect(persisted.read(STATE_KEY)).toMatchObject({ enabled: false });
    });

    await service.getDailyReminderState();

    expect(dependencies.cancel).toHaveBeenCalledWith(`${PREFIX}native-orphan`);
    expect(dependencies.cancel).not.toHaveBeenCalledWith(
      "another-app.notification",
    );
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });

  it("never claims an unrelated identifier from malformed v3 deliveries", async () => {
    const invalid = horizon();
    invalid.deliveries[0] = {
      ...invalid.deliveries[0]!,
      id: "another-app.notification",
      localDate: "impossible",
    };
    const { dependencies, service } = harness({
      initial: invalid,
      nativeIds: ["another-app.notification", `${PREFIX}native-orphan`],
    });

    await service.getDailyReminderState();

    expect(dependencies.cancel).not.toHaveBeenCalledWith(
      "another-app.notification",
    );
    expect(dependencies.cancel).toHaveBeenCalledWith(`${PREFIX}native-orphan`);
  });

  it("does not claim a legacy-looking record unless its persisted shape is exact", async () => {
    const { dependencies, service } = harness({
      initial: {
        enabled: true,
        hour: 9,
        notificationId: "another-app.notification",
        permission: "granted",
        scheduleKind: "seed",
        seedDate: "",
        timeZone: "America/Los_Angeles",
        unrelatedFeature: true,
        version: 2,
      },
      nativeIds: ["another-app.notification"],
    });

    await service.getDailyReminderState();

    expect(dependencies.cancel).not.toHaveBeenCalledWith(
      "another-app.notification",
    );
  });

  it("rejects a malformed cleanup journal before it can cancel an unrelated ID", async () => {
    const target = disabled();
    const { dependencies, persisted } = harness({ initial: target });
    persisted.write(JOURNAL_KEY, {
      cleanupIds: ["another-app.notification"],
      installIds: [],
      operation: "cleanup-invalid",
      source: null,
      target,
      version: 2,
    });

    const restarted = createReminderService(dependencies);
    await expect(restarted.getDailyReminderState()).rejects.toThrow(
      "Daily reminder recovery state is invalid.",
    );
    expect(dependencies.cancel).not.toHaveBeenCalled();
  });

  it("rejects transition cleanup IDs that are not the exact source-minus-target set", async () => {
    const source = horizon();
    const target = horizon("2026-03-07", "America/Los_Angeles", "new");
    const { dependencies, persisted } = harness({ initial: target });
    persisted.write(JOURNAL_KEY, {
      cleanupIds: ["another-app.notification"],
      installIds: target.deliveries.map((delivery) => delivery.id),
      operation: "transition",
      source,
      target,
      version: 2,
    });

    const restarted = createReminderService(dependencies);
    await expect(restarted.getDailyReminderState()).rejects.toThrow(
      "Daily reminder recovery state is invalid.",
    );
    expect(dependencies.cancel).not.toHaveBeenCalled();
  });
});

describe("legacy reminder migration and recovery", () => {
  const legacyV1 = {
    enabled: true,
    hour: 9,
    notificationId: "legacy-v1-id",
    permission: "granted",
    timeZone: "America/Los_Angeles",
    version: 1,
  } as const;

  function legacyV2(
    scheduleKind: "repeating" | "seed",
    notificationId = `legacy-${scheduleKind}-id`,
  ) {
    return {
      enabled: true,
      hour: 9,
      notificationId,
      permission: "granted",
      scheduleKind,
      seedDate: scheduleKind === "seed" ? "2026-03-08" : null,
      timeZone: "America/Los_Angeles",
      version: 2,
    } as const;
  }

  it("persists a valid v1 stable state as owned v3 legacy state", async () => {
    const { persisted, service } = harness({ initial: legacyV1 });

    await expect(service.getDailyReminderState()).resolves.toMatchObject({
      enabled: true,
      legacyIds: ["legacy-v1-id"],
      version: 3,
    });
    expect(persisted.read(STATE_KEY)).toMatchObject({
      legacyIds: ["legacy-v1-id"],
      version: 3,
    });
  });

  for (const scheduleKind of ["seed", "repeating"] as const) {
    it(`persists a valid v2 ${scheduleKind} state as owned v3 legacy state`, async () => {
      const initial = legacyV2(scheduleKind);
      const { persisted, service } = harness({ initial });

      await expect(service.getDailyReminderState()).resolves.toMatchObject({
        enabled: true,
        legacyIds: [initial.notificationId],
        version: 3,
      });
      expect(persisted.read(STATE_KEY)).toMatchObject({
        legacyIds: [initial.notificationId],
        version: 3,
      });
    });
  }

  it("rolls back the exact v1 transition journal after a brand-new service starts", async () => {
    const source = legacyV2("repeating", "legacy-source-id");
    const target = legacyV2("seed", "legacy-target-id");
    const { dependencies, persisted } = harness({
      initial: legacyV1,
      nativeIds: ["legacy-v1-id", "legacy-target-id"],
    });
    persisted.write(JOURNAL_KEY, {
      cleanupIds: ["legacy-v1-id"],
      source: { ...source, notificationId: "legacy-v1-id" },
      target,
      version: 1,
    });

    const restarted = createReminderService(dependencies);
    await expect(restarted.getDailyReminderState()).resolves.toMatchObject({
      enabled: true,
      legacyIds: ["legacy-v1-id"],
      version: 3,
    });

    expect(dependencies.cancel).toHaveBeenCalledExactlyOnceWith(
      "legacy-target-id",
    );
    expect(persisted.read(JOURNAL_KEY)).toBeNull();
  });
});
