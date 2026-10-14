const UPDATE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

interface FormatMobileVersionStampOptions {
  version: string;
  isEmbeddedLaunch: boolean;
  createdAt: Date | null;
}

export function formatMobileVersionStamp({
  version,
  isEmbeddedLaunch,
  createdAt,
}: FormatMobileVersionStampOptions): string {
  const normalizedVersion = version.trim() || "unknown";

  if (isEmbeddedLaunch || createdAt === null) {
    return `v${normalizedVersion}`;
  }

  return `v${normalizedVersion} · update ${UPDATE_DATE_FORMATTER.format(createdAt)}`;
}
