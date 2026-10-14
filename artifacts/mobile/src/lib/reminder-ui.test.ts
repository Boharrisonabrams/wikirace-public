import { describe, expect, it, vi } from "vitest";

import {
  getReminderControlCopy,
  getDebugReminderControl,
  reminderStatusFromSnapshot,
  runReminderAction,
  type ReminderActionDependencies,
  type ReminderUiModel,
} from "./reminder-ui";

function reminderState(enabled: boolean) {
  return {
    enabled,
    permission: "granted" as const,
  };
}

function actionDependencies(
  overrides: Partial<ReminderActionDependencies> = {},
) {
  return {
    disable: vi.fn(async () => reminderState(false)),
    enable: vi.fn(async () => reminderState(true)),
    read: vi.fn(async () => reminderState(false)),
    ...overrides,
  };
}

describe("Result reminder action model", () => {
  it("retries a failed enable as enable", async () => {
    const dependencies = actionDependencies({
      enable: vi
        .fn<ReminderActionDependencies["enable"]>()
        .mockRejectedValueOnce(new Error("enable failed"))
        .mockResolvedValue(reminderState(true)),
    });
    const initial: ReminderUiModel = {
      retryAction: null,
      status: "idle",
    };

    const failed = await runReminderAction(initial, dependencies);
    expect(failed).toEqual({ retryAction: "enable", status: "error" });

    await expect(runReminderAction(failed, dependencies)).resolves.toEqual({
      retryAction: null,
      status: "enabled",
    });
    expect(dependencies.enable).toHaveBeenCalledTimes(2);
    expect(dependencies.disable).not.toHaveBeenCalled();
  });

  it("retries a failed disable as disable and remains disabled", async () => {
    const dependencies = actionDependencies({
      disable: vi
        .fn<ReminderActionDependencies["disable"]>()
        .mockRejectedValueOnce(new Error("disable failed"))
        .mockResolvedValue(reminderState(false)),
    });
    const initial: ReminderUiModel = {
      retryAction: null,
      status: "enabled",
    };

    const failed = await runReminderAction(initial, dependencies);
    expect(failed).toEqual({ retryAction: "disable", status: "error" });

    await expect(runReminderAction(failed, dependencies)).resolves.toEqual({
      retryAction: null,
      status: "idle",
    });
    expect(dependencies.disable).toHaveBeenCalledTimes(2);
    expect(dependencies.enable).not.toHaveBeenCalled();
  });

  it("rereads durable state when an initial load error has no retry intent", async () => {
    const dependencies = actionDependencies({
      read: vi.fn(async () => reminderState(true)),
    });

    await expect(
      runReminderAction({ retryAction: null, status: "error" }, dependencies),
    ).resolves.toEqual({ retryAction: null, status: "idle" });
    expect(dependencies.read).toHaveBeenCalledOnce();
    expect(dependencies.disable).toHaveBeenCalledOnce();
    expect(dependencies.enable).not.toHaveBeenCalled();
  });
});

describe("Reminder control copy", () => {
  it("maps durable reminder snapshots into UI statuses", () => {
    expect(
      reminderStatusFromSnapshot({ enabled: true, permission: "granted" }),
    ).toBe("enabled");
    expect(
      reminderStatusFromSnapshot({ enabled: false, permission: "denied" }),
    ).toBe("denied");
    expect(
      reminderStatusFromSnapshot({ enabled: false, permission: "granted" }),
    ).toBe("idle");
  });

  it("keeps the denied-state settings recovery copy centralized", () => {
    expect(getReminderControlCopy("denied")).toEqual({
      actionLabel: "Reminders are off",
      disabled: true,
      icon: "bell",
      note: "Notifications are off in Settings. You can still play every day.",
      showOpenSettings: true,
    });
  });
});

describe("Home debug reminder control model", () => {
  it("is absent without the exact debug query or outside development", () => {
    expect(getDebugReminderControl(true, undefined, "idle")).toBeNull();
    expect(getDebugReminderControl(true, "true", "idle")).toBeNull();
    expect(getDebugReminderControl(false, "1", "idle")).toBeNull();
  });

  it("exposes accessible labels and stable test IDs for the deep-link proof", () => {
    expect(getDebugReminderControl(true, ["1"], "idle")).toEqual({
      accessibilityLabel: "Schedule a WikiRace test notification in 60 seconds",
      buttonLabel: "Schedule 60-second notification",
      buttonTestID: "home-debug-reminder-btn",
      disabled: false,
      statusText: "No test notification is scheduled yet.",
      statusTestID: "home-debug-reminder-status",
    });
    expect(getDebugReminderControl(true, "1", "scheduled")).toMatchObject({
      buttonLabel: "Schedule another 60-second notification",
      statusText:
        "Test notification scheduled. Leave WikiRace open or background it and wait 60 seconds.",
    });
  });
});
