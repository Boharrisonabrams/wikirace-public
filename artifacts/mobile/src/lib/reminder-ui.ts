export type ReminderAction = "disable" | "enable";
export type ReminderUiStatus =
  | "denied"
  | "enabled"
  | "error"
  | "idle"
  | "loading";

export interface ReminderUiModel {
  retryAction: ReminderAction | null;
  status: ReminderUiStatus;
}

interface ReminderSnapshot {
  enabled: boolean;
  permission: string;
}

export interface ReminderControlCopy {
  actionLabel: string;
  disabled: boolean;
  icon: "bell" | "bell-off";
  note: string | null;
  showOpenSettings: boolean;
}

export interface ReminderActionDependencies {
  disable(): Promise<ReminderSnapshot>;
  enable(): Promise<ReminderSnapshot>;
  read(): Promise<ReminderSnapshot>;
}

export type DebugReminderStatus = "error" | "idle" | "loading" | "scheduled";

function statusFromSnapshot(snapshot: ReminderSnapshot): ReminderUiStatus {
  if (snapshot.enabled) return "enabled";
  return snapshot.permission === "denied" ? "denied" : "idle";
}

export function reminderStatusFromSnapshot(
  snapshot: ReminderSnapshot,
): ReminderUiStatus {
  return statusFromSnapshot(snapshot);
}

export function getReminderControlCopy(
  status: ReminderUiStatus,
): ReminderControlCopy {
  switch (status) {
    case "enabled":
      return {
        actionLabel: "Daily reminder on · Turn off",
        disabled: false,
        icon: "bell-off",
        note: "WikiRace will remind you at 9:00 AM in your current timezone.",
        showOpenSettings: false,
      };
    case "denied":
      return {
        actionLabel: "Reminders are off",
        disabled: true,
        icon: "bell",
        note: "Notifications are off in Settings. You can still play every day.",
        showOpenSettings: true,
      };
    case "error":
      return {
        actionLabel: "Try reminder again",
        disabled: false,
        icon: "bell",
        note: null,
        showOpenSettings: false,
      };
    case "loading":
      return {
        actionLabel: "Remind me tomorrow",
        disabled: true,
        icon: "bell",
        note: null,
        showOpenSettings: false,
      };
    case "idle":
    default:
      return {
        actionLabel: "Remind me tomorrow",
        disabled: false,
        icon: "bell",
        note: null,
        showOpenSettings: false,
      };
  }
}

export async function runReminderAction(
  model: ReminderUiModel,
  dependencies: ReminderActionDependencies,
): Promise<ReminderUiModel> {
  if (model.status === "loading" || model.status === "denied") return model;
  let action = model.retryAction;
  try {
    if (!action) {
      if (model.status === "error") {
        const durable = await dependencies.read();
        action = durable.enabled ? "disable" : "enable";
      } else {
        action = model.status === "enabled" ? "disable" : "enable";
      }
    }
    const next =
      action === "disable"
        ? await dependencies.disable()
        : await dependencies.enable();
    return { retryAction: null, status: statusFromSnapshot(next) };
  } catch {
    return { retryAction: action, status: "error" };
  }
}

export function getDebugReminderControl(
  isDevelopment: boolean,
  debugReminder: string | string[] | undefined,
  status: DebugReminderStatus,
) {
  const query = Array.isArray(debugReminder) ? debugReminder[0] : debugReminder;
  if (!isDevelopment || query !== "1") return null;

  const buttonLabel =
    status === "loading"
      ? "Scheduling test notification…"
      : status === "scheduled"
        ? "Schedule another 60-second notification"
        : status === "error"
          ? "Try 60-second notification again"
          : "Schedule 60-second notification";
  const statusText =
    status === "scheduled"
      ? "Test notification scheduled. Leave WikiRace open or background it and wait 60 seconds."
      : status === "error"
        ? "Could not schedule the test notification. Try again."
        : status === "loading"
          ? "Scheduling the test notification…"
          : "No test notification is scheduled yet.";

  return {
    accessibilityLabel: "Schedule a WikiRace test notification in 60 seconds",
    buttonLabel,
    buttonTestID: "home-debug-reminder-btn",
    disabled: status === "loading",
    statusText,
    statusTestID: "home-debug-reminder-status",
  } as const;
}
