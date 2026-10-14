import rateLimit, { type Options } from "express-rate-limit";

const TOO_MANY_REQUESTS_ERROR = "Too many requests — slow down.";

type LimiterConfig = Pick<Options, "windowMs" | "limit"> &
  Pick<Partial<Options>, "skip">;

export function createLimiter(config: LimiterConfig) {
  return rateLimit({
    ...config,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({ error: TOO_MANY_REQUESTS_ERROR });
    },
  });
}

export const apiLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  skip: (req) => req.path === "/healthz",
});

export const wikipediaLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 120,
});

export const challengePreviewLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 120,
});
