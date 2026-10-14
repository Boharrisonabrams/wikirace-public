import { describe, expect, it, vi } from "vitest";

vi.mock("./reminders", () => ({
  reminderRouteFromResponse: (value: unknown) => {
    const response = value as {
      actionIdentifier?: unknown;
      notification?: { request?: { content?: { data?: { route?: unknown } } } };
    };
    return response?.actionIdentifier ===
      "expo.modules.notifications.actions.DEFAULT" &&
      response.notification?.request?.content?.data?.route === "/"
      ? "/"
      : null;
  },
}));

import { startNotificationCoordinator } from "./notification-coordinator";

function response(actionIdentifier: string, route: unknown) {
  return {
    actionIdentifier,
    notification: { request: { content: { data: { route } } } },
  };
}

describe("notification coordinator", () => {
  it("handles cold and warm Home taps, every active resume, and cleanup", async () => {
    let appStateListener: (state: string) => void = () => undefined;
    let receivedListener: () => void = () => undefined;
    let responseListener: (value: unknown) => void = () => undefined;
    const removeAppState = vi.fn();
    const removeReceived = vi.fn();
    const removeResponse = vi.fn();
    const clearLastResponse = vi.fn();
    const navigateHome = vi.fn();
    const reconcile = vi.fn(async () => undefined);
    const cold = response("expo.modules.notifications.actions.DEFAULT", "/");

    const cleanup = startNotificationCoordinator({
      addAppStateListener: (listener) => {
        appStateListener = listener;
        return { remove: removeAppState };
      },
      addReceivedListener: (listener) => {
        receivedListener = listener;
        return { remove: removeReceived };
      },
      addResponseListener: (listener) => {
        responseListener = listener;
        return { remove: removeResponse };
      },
      clearLastResponse,
      getLastResponse: () => cold,
      navigateHome,
      reconcile,
    });

    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(2));
    expect(clearLastResponse).toHaveBeenCalledOnce();
    expect(navigateHome).toHaveBeenCalledOnce();
    expect(navigateHome).toHaveBeenLastCalledWith({
      params: {},
      pathname: "/",
    });

    responseListener(response("custom-action", "/"));
    responseListener(
      response("expo.modules.notifications.actions.DEFAULT", "/result"),
    );
    expect(clearLastResponse).toHaveBeenCalledOnce();
    expect(navigateHome).toHaveBeenCalledOnce();

    responseListener(
      response("expo.modules.notifications.actions.DEFAULT", "/"),
    );
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(3));
    expect(clearLastResponse).toHaveBeenCalledTimes(2);
    expect(navigateHome).toHaveBeenCalledTimes(2);
    expect(navigateHome).toHaveBeenLastCalledWith({
      params: {},
      pathname: "/",
    });

    appStateListener("background");
    expect(reconcile).toHaveBeenCalledTimes(3);
    appStateListener("active");
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(4));
    receivedListener();
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledTimes(5));

    cleanup();
    expect(removeAppState).toHaveBeenCalledOnce();
    expect(removeReceived).toHaveBeenCalledOnce();
    expect(removeResponse).toHaveBeenCalledOnce();
  });
});
