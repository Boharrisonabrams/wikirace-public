import type { ConfigContext, ExpoConfig } from "expo/config";

// app.json holds the static config. This file layers the deploy-specific
// values on top of it from the environment, so the public repo can be the
// build source without committing real values. The defaults are the public
// placeholders. docs/DEPLOY.md lists each variable.
//
// Expo transpiles only this file when it loads the config, so keep it free of
// imports from other TypeScript files.

export const DEFAULT_APP_URL = "https://wikirace.example.com";
export const DEFAULT_EAS_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

type DeployEnv = Record<string, string | undefined>;

function readVar(env: DeployEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function parseUrl(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

function appHost(env: DeployEnv): string {
  const raw = readVar(env, "EXPO_PUBLIC_APP_URL") ?? DEFAULT_APP_URL;
  const url = parseUrl(raw);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:")) {
    throw new Error(
      `EXPO_PUBLIC_APP_URL must be an absolute http(s) URL such as ${DEFAULT_APP_URL}; got "${raw}".`,
    );
  }
  return url.host;
}

export function withDeployValues(
  config: Partial<ExpoConfig>,
  env: DeployEnv,
): ExpoConfig {
  const { name, slug } = config;
  if (!name || !slug) {
    throw new Error("app.json must define expo.name and expo.slug.");
  }

  const host = appHost(env);
  const projectId = readVar(env, "EAS_PROJECT_ID") ?? DEFAULT_EAS_PROJECT_ID;

  return {
    ...config,
    name,
    slug,
    ios: {
      ...config.ios,
      associatedDomains: [`applinks:${host}`, `webcredentials:${host}`],
    },
    extra: {
      ...config.extra,
      eas: { ...config.extra?.eas, projectId },
    },
    updates: {
      ...config.updates,
      url: `https://u.expo.dev/${projectId}`,
    },
  };
}

export default function appConfig({ config }: ConfigContext): ExpoConfig {
  return withDeployValues(config, process.env);
}
