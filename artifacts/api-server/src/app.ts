import path from "node:path";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getPublicAppUrl } from "./lib/public-app-url";
import { apiLimiter, wikipediaLimiter } from "./middlewares/rate-limit";
import { mountAppleAppSiteAssociation } from "./middlewares/apple-app-site-association";
import {
  mountStaticFrontend,
  type ChallengePreviewMetadata,
} from "./middlewares/static-frontend";
import { createServiceClient } from "./lib/supabase";

type CreateAppOptions = {
  loadChallengePreview?: (
    code: string,
  ) => Promise<ChallengePreviewMetadata | null>;
  serveStaticDir?: string;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadHostedChallengePreview(
  reference: string,
): Promise<ChallengePreviewMetadata | null> {
  const column = UUID_PATTERN.test(reference) ? "id" : "short_code";
  const { data } = await createServiceClient()
    .from("friend_challenges")
    .select("short_code, start_article_title, end_article_title")
    .eq(column, reference)
    .maybeSingle();
  if (!data) return null;
  return {
    code: data.short_code ?? reference,
    startTitle: data.start_article_title,
    endTitle: data.end_article_title,
  };
}

export function createApp(options: CreateAppOptions = {}): Express {
  const app: Express = express();

  // Production sits behind one platform proxy hop; trusting exactly one hop keeps IP rate limits proxy-aware without accepting arbitrary client spoofing.
  app.set("trust proxy", 1);

  app.use(
    pinoHttp({
      logger,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url?.split("?")[0],
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", apiLimiter);
  app.use("/api/wikipedia", wikipediaLimiter);
  app.use("/api", router);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const staticDir = options.serveStaticDir ?? process.env["SERVE_STATIC_DIR"];

  mountAppleAppSiteAssociation(app);

  if (staticDir) {
    mountStaticFrontend(app, path.resolve(staticDir), {
      loadChallengePreview:
        options.loadChallengePreview ?? loadHostedChallengePreview,
      publicAppUrl: getPublicAppUrl(),
    });
  }

  return app;
}

const app = createApp();
export default app;
