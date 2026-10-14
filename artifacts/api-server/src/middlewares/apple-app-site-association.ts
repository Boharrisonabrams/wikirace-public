import { type Express } from "express";

const IOS_BUNDLE_ID = "com.boabrams.wikirace";
const APPLE_APP_SITE_ASSOCIATION_CACHE = "public, max-age=300";

// The Apple Team ID of the signing team is account-specific, so it comes from
// the environment instead of source. Set APPLE_TEAM_ID in production. With the
// safe default of an empty string, the file is still served but lists no app,
// so iOS will not verify universal links until the variable is set.
function getAppleTeamId(): string {
  return (process.env.APPLE_TEAM_ID ?? "").trim();
}

function buildAppleAppSiteAssociationPayload(teamId: string) {
  const appIds = teamId ? [`${teamId}.${IOS_BUNDLE_ID}`] : [];

  return {
    applinks: {
      apps: [],
      details: appIds.map((appId) => ({
        appIDs: [appId],
        appID: appId,
        components: [
          {
            "/": "/challenge/*",
          },
        ],
        paths: ["/challenge/*"],
      })),
    },
    webcredentials: {
      apps: appIds,
    },
  };
}

export function mountAppleAppSiteAssociation(app: Express) {
  app.get(
    ["/.well-known/apple-app-site-association", "/apple-app-site-association"],
    (_req, res) => {
      res
        .setHeader("Cache-Control", APPLE_APP_SITE_ASSOCIATION_CACHE)
        .type("application/json")
        .send(buildAppleAppSiteAssociationPayload(getAppleTeamId()));
    },
  );
}
