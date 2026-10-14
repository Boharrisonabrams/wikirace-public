import { reminderRouteFromResponse } from "./reminders";

interface Subscription {
  remove(): void;
}

export interface NotificationHomeDestination {
  params: Record<string, never>;
  pathname: "/";
}

export interface NotificationCoordinatorDependencies {
  addAppStateListener(listener: (state: string) => void): Subscription;
  addReceivedListener(listener: () => void): Subscription;
  addResponseListener(listener: (response: unknown) => void): Subscription;
  clearLastResponse(): void;
  getLastResponse(): unknown;
  navigateHome(destination: NotificationHomeDestination): void;
  reconcile(): Promise<unknown>;
}

export function startNotificationCoordinator(
  dependencies: NotificationCoordinatorDependencies,
): () => void {
  const reconcile = () => {
    void dependencies.reconcile().catch(() => undefined);
  };
  const handleResponse = (response: unknown) => {
    if (!reminderRouteFromResponse(response)) return;
    try {
      dependencies.clearLastResponse();
    } catch {
      // The response is still consumed by this coordinator instance.
    }
    dependencies.navigateHome({ params: {}, pathname: "/" });
    reconcile();
  };

  let responseSubscription: Subscription | null = null;
  let receivedSubscription: Subscription | null = null;
  let appStateSubscription: Subscription | null = null;
  try {
    responseSubscription = dependencies.addResponseListener(handleResponse);
    const coldResponse = dependencies.getLastResponse();
    if (coldResponse) handleResponse(coldResponse);
  } catch {
    // Notification response APIs are optional on unsupported runtimes.
  }
  try {
    receivedSubscription = dependencies.addReceivedListener(reconcile);
  } catch {
    // Foreground delivery promotion is optional on unsupported runtimes.
  }
  try {
    appStateSubscription = dependencies.addAppStateListener((state) => {
      if (state === "active") reconcile();
    });
  } catch {
    // AppState subscription failures must not block app startup.
  }
  reconcile();

  return () => {
    responseSubscription?.remove();
    receivedSubscription?.remove();
    appStateSubscription?.remove();
  };
}
