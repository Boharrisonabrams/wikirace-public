export type ShareIntent = "challenge" | "result";

type ShareBase = {
  challengeUrl: string;
  endTitle: string;
  startTitle: string;
};

export type ShareCopyInput =
  | (ShareBase & {
      intent: "challenge";
    })
  | (ShareBase & {
      clicks: number;
      elapsedSeconds?: number | null;
      intent: "result";
      outcome: "won";
      replay?: boolean;
    })
  | (ShareBase & {
      intent: "result";
      outcome: "stopped";
      stoppedAt: string;
    });

export type ShareContent = {
  text: string;
  url: string;
};

const SHORT_CHALLENGE_PATH = /^\/challenge\/[A-Za-z0-9_-]{6,16}$/;

export function isSafeChallengeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      SHORT_CHALLENGE_PATH.test(url.pathname) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export function formatElapsedTime(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds)
    ? Math.max(0, Math.floor(totalSeconds))
    : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function inline(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function formatShareIntent(input: ShareCopyInput): ShareContent {
  if (!isSafeChallengeUrl(input.challengeUrl)) {
    throw new Error("Challenge link is not a safe short HTTPS URL.");
  }

  const startTitle = inline(input.startTitle);
  const endTitle = inline(input.endTitle);
  let text: string;

  if (input.intent === "challenge") {
    text = `${startTitle} → ${endTitle}\n\nCan you find the path?`;
  } else if (input.outcome === "won") {
    const clickLabel = `${input.clicks} ${input.clicks === 1 ? "click" : "clicks"}`;
    const details =
      typeof input.elapsedSeconds === "number" && input.elapsedSeconds > 0
        ? `${clickLabel} · ${formatElapsedTime(input.elapsedSeconds)}`
        : clickLabel;
    text =
      `I finished ${startTitle} → ${endTitle}.\n` +
      `\n${details}\n\n` +
      `Can you beat me?`;
  } else {
    text =
      `I stopped at ${inline(input.stoppedAt)} while trying to reach ${endTitle}.\n` +
      `\nCan you finish it?`;
  }

  return { text, url: input.challengeUrl };
}

export function shareContentAsMessage(content: ShareContent): string {
  return `${content.text}\n\n${content.url}`;
}
