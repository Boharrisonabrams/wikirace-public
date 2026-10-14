import { describe, expect, it } from "vitest";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createLimiter } from "./rate-limit";

type MockResponse = Response & {
  body?: unknown;
  headerValues: Record<string, string | number | readonly string[]>;
};

async function runMiddleware(handler: RequestHandler, path: string) {
  let nextCalled = false;
  const req = {
    app: {
      get: () => false,
    },
    headers: {},
    ip: "127.0.0.1",
    path,
    socket: {
      remoteAddress: "127.0.0.1",
    },
  } as unknown as Request;

  const res = {
    headersSent: false,
    writableEnded: false,
    statusCode: 200,
    headerValues: {},
    setHeader(this: MockResponse, name: string, value: string | number | readonly string[]) {
      this.headerValues[name.toLowerCase()] = value;
      return this;
    },
    status(this: MockResponse, code: number) {
      this.statusCode = code;
      return this;
    },
    json(this: MockResponse, body: unknown) {
      this.body = body;
      Object.defineProperty(this, "writableEnded", { value: true, writable: true });
      this.headersSent = true;
      this.setHeader("content-type", "application/json; charset=utf-8");
      return this;
    },
  } as unknown as MockResponse;

  const next: NextFunction = (err?: unknown) => {
    if (err) throw err;
    nextCalled = true;
  };

  await Promise.resolve(handler(req, res, next));
  return { nextCalled, res };
}

describe("rate-limit middleware", () => {
  it("allows requests under the limit and returns JSON 429 after the limit", async () => {
    const limiter = createLimiter({
      windowMs: 60_000,
      limit: 2,
    });

    const first = await runMiddleware(limiter, "/limited");
    const second = await runMiddleware(limiter, "/limited");
    const third = await runMiddleware(limiter, "/limited");

    expect(first.nextCalled).toBe(true);
    expect(first.res.statusCode).toBe(200);
    expect(second.nextCalled).toBe(true);
    expect(second.res.statusCode).toBe(200);
    expect(third.nextCalled).toBe(false);
    expect(third.res.statusCode).toBe(429);
    expect(third.res.headerValues["content-type"]).toContain("application/json");
    expect(third.res.body).toEqual({ error: "Too many requests — slow down." });
  });

  it("skips configured paths", async () => {
    const limiter = createLimiter({
      windowMs: 60_000,
      limit: 1,
      skip: (req) => req.path === "/healthz",
    });

    const first = await runMiddleware(limiter, "/healthz");
    const second = await runMiddleware(limiter, "/healthz");
    const third = await runMiddleware(limiter, "/healthz");

    expect(first.nextCalled).toBe(true);
    expect(second.nextCalled).toBe(true);
    expect(third.nextCalled).toBe(true);
    expect(third.res.statusCode).toBe(200);
  });
});
