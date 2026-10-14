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

import {
  DAILY_REMINDER_IDENTIFIER_PREFIX,
  DAILY_REMINDER_STORAGE_KEY,
  DAILY_REMINDER_TRANSITION_KEY,
  createReminderService,
  foregroundReminderBehavior,
  reminderRouteFromResponse,
  type ReminderDependencies,
  type ReminderPermission,
  type ReminderState,
} from "./reminders";
import * as reminderModule from "./reminders";

const STORAGE_KEY = "wikipath.daily-reminder.v1";
const PREFIX = "wikipath.daily.v3.";

function addDays(value: string, days: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function enabledState(overrides: Partial<ReminderState> = {}): ReminderState {
  return {
    deliveries: Array.from({ length: 28 }, (_, index) => {
      const localDate = addDays("2026-03-07", index + 1);
      return {
        id: `${PREFIX}old-${index + 1}`,
        localDate,
        scheduledAt: Date.parse(`${localDate}T16:00:00.000Z`),
      };
    }),
    enabled: true,
    hour: 9,
    legacyIds: [],
    permission: "granted",
    reconciledLocalDate: "2026-03-07",
    timeZone: "America/Los_Angeles",
    version: 3,
    ...overrides,
  };
}

function createStorage(initial: ReminderState | null = null) {
  const values = new Map<string, string>();
  if (initial) values.set(STORAGE_KEY, JSON.stringify(initial));
  return {
    get value() {
      return values.get(STORAGE_KEY) ?? null;
    },
    getItem: vi.fn(async (key: string) => values.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => {
      values.delete(key);
    }),
    setItem: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
  };
}

function harness(
  options: Partial<ReminderDependencies> & {
    initial?: ReminderState | null;
  } = {},
) {
  const storage = createStorage(options.initial ?? null);
  const nativeIds = new Set(
    (options.initial ?? null)?.deliveries.map((delivery) => delivery.id) ?? [],
  );
  let identifier = 0;
  const cancelImplementation = options.cancel;
  const scheduleImplementation = options.schedule;
  const dependencies: ReminderDependencies = {
    createIdentifier: vi.fn(() => `raw-${++identifier}`),
    getPermission: vi.fn(async (): Promise<ReminderPermission> => "granted"),
    isDevelopment: true,
    now: vi.fn(() => new Date("2026-03-07T16:00:00.000Z")),
    platform: "ios",
    requestPermission: vi.fn(async (): Promise<"granted"> => "granted"),
    storage,
    timeZone: vi.fn(() => "America/Los_Angeles"),
    ...options,
    cancel: vi.fn(async (id) => {
      if (cancelImplementation) await cancelImplementation(id);
      nativeIds.delete(id);
    }),
    listScheduled:
      options.listScheduled ??
      vi.fn(async () => [...nativeIds].map((id) => ({ identifier: id }))),
    schedule: vi.fn(async (request) => {
      const scheduledIdentifier = scheduleImplementation
        ? await scheduleImplementation(request)
        : request.identifier
          ? request.identifier
          : "test-notification-id";
      if (request.identifier && scheduledIdentifier === request.identifier) {
        nativeIds.add(scheduledIdentifier);
      }
      return scheduledIdentifier;
    }),
  };
  return {
    dependencies,
    service: createReminderService(dependencies),
    storage,
  };
}

describe("Daily reminder service", () => {
  it("rebrands notification content without orphaning persisted reminders", () => {
    expect(reminderModule.DAILY_NOTIFICATION_CONTENT.title).toBe(
      "Today's WikiRace is ready",
    );
    expect(DAILY_REMINDER_STORAGE_KEY).toBe("wikipath.daily-reminder.v1");
    expect(DAILY_REMINDER_TRANSITION_KEY).toBe(
      "wikipath.daily-reminder.transition.v1",
    );
    expect(DAILY_REMINDER_IDENTIFIER_PREFIX).toBe("wikipath.daily.v3.");
  });

  it("schedules and persists a 28-day tomorrow-at-9 horizon", async () => {
    const { dependencies, service, storage } = harness();

    const state = await service.enableDailyReminder();

    expect(state).toMatchObject({ enabled: true, version: 3 });
    expect(state.deliveries).toHaveLength(28);
    expect(state.deliveries[0]).toMatchObject({
      localDate: "2026-03-08",
      scheduledAt: Date.parse("2026-03-08T16:00:00.000Z"),
    });
    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(JSON.parse(storage.value ?? "null")).toEqual(state);
  });

  it("accepts provisional iOS permission without prompting again", async () => {
    const { dependencies, service } = harness({
      getPermission: vi.fn(async (): Promise<"provisional"> => "provisional"),
    });

    await expect(service.enableDailyReminder()).resolves.toMatchObject({
      enabled: true,
      permission: "provisional",
    });
    expect(dependencies.requestPermission).not.toHaveBeenCalled();
  });

  it("uses one-shot DATE deliveries on Android too", async () => {
    const { dependencies, service } = harness({ platform: "android" });

    await service.enableDailyReminder(8);

    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(dependencies.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ type: "date" }),
      }),
    );
  });

  it("returns a neutral denied state and does not schedule", async () => {
    const { dependencies, service } = harness({
      getPermission: vi.fn(async (): Promise<"undetermined"> => "undetermined"),
      requestPermission: vi.fn(async (): Promise<"denied"> => "denied"),
    });

    await expect(service.enableDailyReminder()).resolves.toMatchObject({
      deliveries: [],
      enabled: false,
      legacyIds: [],
      permission: "denied",
      version: 3,
    });
    expect(dependencies.schedule).not.toHaveBeenCalled();
  });

  it("treats an iOS ephemeral authorization as allowed", () => {
    const permissionFromNative = (
      reminderModule as typeof reminderModule & {
        reminderPermissionFromNative: (permission: unknown) => string;
      }
    ).reminderPermissionFromNative;

    expect(
      permissionFromNative({
        granted: false,
        ios: { status: 4 },
        status: "denied",
      }),
    ).toBe("granted");
  });

  it("disables only the 28 identifiers owned by WikiPath", async () => {
    const { dependencies, service } = harness({ initial: enabledState() });

    await expect(service.disableDailyReminder()).resolves.toMatchObject({
      deliveries: [],
      enabled: false,
    });
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
  });

  it("rebuilds the owned horizon after a device timezone change", async () => {
    const { dependencies, service } = harness({
      initial: enabledState(),
      timeZone: vi.fn(() => "America/New_York"),
    });

    await expect(service.reconcileDailyReminder()).resolves.toMatchObject({
      enabled: true,
      timeZone: "America/New_York",
    });
    expect(dependencies.schedule).toHaveBeenCalledTimes(28);
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
  });

  it("rolls back every new ID when replacement scheduling fails", async () => {
    const { dependencies, service, storage } = harness({
      initial: enabledState(),
      schedule: vi.fn(async () => {
        throw new Error("native scheduler failed");
      }),
      timeZone: vi.fn(() => "America/New_York"),
    });

    await expect(service.reconcileDailyReminder()).rejects.toThrow(
      "native scheduler failed",
    );
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
    expect(JSON.parse(storage.value ?? "null")).toEqual(enabledState());
  });

  it("leaves an already-current horizon alone", async () => {
    const initial = enabledState();
    const { dependencies, service } = harness({ initial });

    await expect(service.reconcileDailyReminder()).resolves.toEqual(initial);
    expect(dependencies.cancel).not.toHaveBeenCalled();
    expect(dependencies.schedule).not.toHaveBeenCalled();
  });

  it("serializes a disable behind an in-flight horizon install", async () => {
    let finishFirstSchedule: (id: string) => void = () => undefined;
    let call = 0;
    const schedule = vi.fn((request: { identifier?: string }) => {
      call += 1;
      if (call === 1) {
        return new Promise<string>((resolve) => {
          finishFirstSchedule = resolve;
        });
      }
      return Promise.resolve(request.identifier!);
    });
    const { dependencies, service } = harness({
      schedule: schedule as ReminderDependencies["schedule"],
    });

    const enabling = service.enableDailyReminder();
    const disabling = service.disableDailyReminder();
    await vi.waitFor(() => expect(schedule).toHaveBeenCalledOnce());
    finishFirstSchedule(`${PREFIX}raw-1`);

    await expect(enabling).resolves.toMatchObject({ enabled: true });
    await expect(disabling).resolves.toMatchObject({ enabled: false });
    expect(dependencies.cancel).toHaveBeenCalledTimes(28);
  });

  it("schedules a development-only one-shot without replacing Daily state", async () => {
    const initial = enabledState();
    const { dependencies, service, storage } = harness({
      initial,
      schedule: vi.fn(async () => "test-notification-id"),
    });

    await expect(service.scheduleReminderTest(60)).resolves.toBe(
      "test-notification-id",
    );
    expect(dependencies.schedule).toHaveBeenCalledWith({
      content: {
        body: "A new Daily Path is waiting.",
        data: { route: "/" },
        title: "Today's WikiRace is ready",
      },
      trigger: {
        repeats: false,
        seconds: 60,
        type: "timeInterval",
      },
    });
    expect(JSON.parse(storage.value ?? "null")).toEqual(initial);
    expect(dependencies.cancel).not.toHaveBeenCalled();
  });

  it("fails closed for a test trigger in production", async () => {
    const { dependencies, service } = harness({ isDevelopment: false });

    await expect(service.scheduleReminderTest(60)).rejects.toThrow(
      "Test reminders are available only in development.",
    );
    expect(dependencies.schedule).not.toHaveBeenCalled();
  });
});

describe("notification presentation and routing", () => {
  const response = (actionIdentifier: string, route: unknown) => ({
    actionIdentifier,
    notification: { request: { content: { data: { route } } } },
  });

  it("shows foreground banners and list entries without sound or badge", () => {
    expect(foregroundReminderBehavior()).toEqual({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    });
  });

  it("routes only default taps carrying the explicit Home route", () => {
    expect(
      reminderRouteFromResponse(
        response("expo.modules.notifications.actions.DEFAULT", "/"),
      ),
    ).toBe("/");
    expect(
      reminderRouteFromResponse(response("custom-action", "/")),
    ).toBeNull();
    expect(
      reminderRouteFromResponse(
        response("expo.modules.notifications.actions.DEFAULT", "/result"),
      ),
    ).toBeNull();
    expect(reminderRouteFromResponse(null)).toBeNull();
  });
});
