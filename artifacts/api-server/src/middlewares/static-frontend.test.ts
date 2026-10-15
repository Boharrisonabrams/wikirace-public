import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { Duplex } from "node:stream";
import type { Socket } from "node:net";
import type { Express } from "express";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

type MockResponse = {
  status: number;
  headers: Headers;
  body: string;
};

function jpegDimensions(buffer: Buffer): { width: number; height: number } {
  for (let offset = 2; offset + 9 < buffer.length; ) {
    const marker = buffer.readUInt16BE(offset);
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += segmentLength + 2;
  }
  throw new Error("JPEG dimensions not found");
}

class MockSocket extends Duplex {
  chunks: Buffer[] = [];

  _read() {}

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ) {
    this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    callback();
  }
}

async function request(app: Express, url: string): Promise<MockResponse> {
  const socket = new MockSocket();
  const socketForHttp = socket as unknown as Socket;
  const req = new IncomingMessage(socketForHttp);
  req.method = "GET";
  req.url = url;
  req.headers = {
    host: "127.0.0.1",
  };
  req.socket = socketForHttp;

  const res = new ServerResponse(req);
  res.assignSocket(socketForHttp);

  await new Promise<void>((resolve, reject) => {
    res.once("finish", resolve);
    res.once("error", reject);
    app(req, res);
  });

  const rawResponse = Buffer.concat(socket.chunks).toString("utf8");
  const [rawHead, body = ""] = rawResponse.split("\r\n\r\n");
  const [statusLine = "", ...rawHeaders] = rawHead?.split("\r\n") ?? [];
  const status = Number(statusLine.split(" ")[1]);
  const headers = new Headers();

  for (const header of rawHeaders) {
    const separatorIndex = header.indexOf(":");

    if (separatorIndex === -1) {
      continue;
    }

    headers.append(header.slice(0, separatorIndex), header.slice(separatorIndex + 1).trim());
  }

  return { status, headers, body };
}

describe("static frontend middleware", () => {
  let app: Express;

  beforeAll(async () => {
    const staticDir = await mkdtemp(path.join(tmpdir(), "wikipath-static-"));
    const assetsDir = path.join(staticDir, "assets");

    await mkdir(assetsDir);
    await writeFile(
      path.join(staticDir, "index.html"),
      '<!doctype html><title>WikiRace</title><main id="root"></main>'
    );
    await writeFile(path.join(assetsDir, "app.abc123.js"), "console.log('asset');\n");

    app = createApp({ serveStaticDir: staticDir });
  });

  it("ships the social card at the metadata path and dimensions", async () => {
    const socialCard = await readFile(
      path.resolve(import.meta.dirname, "../../../web/public/wikirace-share-card.jpg")
    );

    expect(jpegDimensions(socialCard)).toEqual({ width: 1200, height: 630 });
    expect(createHash("sha256").update(socialCard).digest("hex")).toBe(
      "336de9e30c8c0331330ffe480fd300185676df3258be7becf0bc59ba7318a081"
    );
  });

  it("serves the app shell with no-cache headers at root", async () => {
    const response = await request(app, "/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.body).toContain("<title>WikiRace</title>");
  });

  it("serves hashed assets with immutable caching", async () => {
    const response = await request(app, "/assets/app.abc123.js");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/javascript");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(response.body).toContain("console.log");
  });

  it("falls back to index.html for deep SPA routes", async () => {
    const response = await request(app, "/profile");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.body).toContain("<title>WikiRace</title>");
  });

  it.each(["/.well-known/apple-app-site-association", "/apple-app-site-association"])(
    "serves apple app site association JSON at %s",
    async (url) => {
      // Placeholder Team ID; the real value comes from APPLE_TEAM_ID at runtime.
      vi.stubEnv("APPLE_TEAM_ID", "ABCDE12345");
      try {
        const response = await request(app, url);
        const payload = JSON.parse(response.body);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("application/json");
        expect(response.headers.get("cache-control")).toBe("public, max-age=300");
        expect(response.body).toContain("ABCDE12345.com.boabrams.wikirace");
        expect(payload).toEqual({
          applinks: {
            apps: [],
            details: [
              {
                appIDs: ["ABCDE12345.com.boabrams.wikirace"],
                appID: "ABCDE12345.com.boabrams.wikirace",
                components: [{ "/": "/challenge/*" }],
                paths: ["/challenge/*"],
              },
            ],
          },
          webcredentials: {
            apps: ["ABCDE12345.com.boabrams.wikirace"],
          },
        });
      } finally {
        vi.unstubAllEnvs();
      }
    }
  );

  it("serves an app-less apple app site association when APPLE_TEAM_ID is unset", async () => {
    vi.stubEnv("APPLE_TEAM_ID", "");
    try {
      const response = await request(app, "/.well-known/apple-app-site-association");

      expect(response.status).toBe(200);
      expect(JSON.parse(response.body)).toEqual({
        applinks: { apps: [], details: [] },
        webcredentials: { apps: [] },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("renders challenge-specific link preview metadata without starting a game", async () => {
    const staticDir = await mkdtemp(path.join(tmpdir(), "wikipath-preview-"));
    await writeFile(
      path.join(staticDir, "index.html"),
      '<!doctype html><html><head><title>WikiRace</title><meta property="og:title" content="WikiRace" /><meta property="og:description" content="Play WikiRace" /></head><body><main id="root"></main></body></html>'
    );
    const loadChallengePreview = vi.fn(async () => ({
      code: "abc123def4",
      startTitle: "Pizza & Pasta",
      endTitle: 'Italy "Today"',
    }));
    const previewApp = createApp({
      serveStaticDir: staticDir,
      loadChallengePreview,
    });

    const response = await request(previewApp, "/challenge/abc123def4");
    const cachedResponse = await request(previewApp, "/challenge/abc123def4");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=300, stale-while-revalidate=86400"
    );
    expect(cachedResponse.status).toBe(200);
    expect(response.body).toContain(
      "<title>Pizza &amp; Pasta → Italy &quot;Today&quot; | WikiRace</title>"
    );
    expect(response.body).toContain(
      'property="og:title" content="Pizza &amp; Pasta → Italy &quot;Today&quot; | WikiRace"'
    );
    expect(response.body).toContain(
      'property="og:description" content="Can you find the path from Pizza &amp; Pasta to Italy &quot;Today&quot;?"'
    );
    expect(response.body).toContain(
      'property="og:url" content="https://wikirace.example.com/challenge/abc123def4"'
    );
    expect(response.body).toContain(
      'property="og:image" content="https://wikirace.example.com/wikirace-share-card.jpg"'
    );
    expect(response.body).toContain(
      'name="twitter:title" content="Pizza &amp; Pasta → Italy &quot;Today&quot; | WikiRace"'
    );
    expect(response.body).toContain(
      'name="twitter:description" content="Can you find the path from Pizza &amp; Pasta to Italy &quot;Today&quot;?"'
    );
    expect(response.body).toContain(
      'name="twitter:image" content="https://wikirace.example.com/wikirace-share-card.jpg"'
    );
    expect(loadChallengePreview).toHaveBeenCalledWith("abc123def4");
    expect(loadChallengePreview).toHaveBeenCalledTimes(1);
  });

  it("does not query the database for malformed challenge references", async () => {
    const staticDir = await mkdtemp(path.join(tmpdir(), "wikipath-invalid-"));
    await writeFile(
      path.join(staticDir, "index.html"),
      '<!doctype html><html><head><title>WikiRace</title></head><body><main id="root"></main></body></html>'
    );
    const loadChallengePreview = vi.fn();
    const previewApp = createApp({
      serveStaticDir: staticDir,
      loadChallengePreview,
    });

    const response = await request(previewApp, "/challenge/not-valid!");

    expect(response.status).toBe(200);
    expect(response.body).toContain("<title>WikiRace</title>");
    expect(loadChallengePreview).not.toHaveBeenCalled();
  });

  it("falls back when the static root path includes a dot-directory segment", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "wikipath-static-"));
    const staticDir = path.join(tempRoot, ".dot", "public");

    await mkdir(staticDir, { recursive: true });
    await writeFile(
      path.join(staticDir, "index.html"),
      '<!doctype html><title>Dot Root</title><main id="root"></main>'
    );

    const dotPathApp = createApp({ serveStaticDir: staticDir });
    const response = await request(dotPathApp, "/profile/settings");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("cache-control")).toBe("no-cache");
    expect(response.body).toContain("<title>Dot Root</title>");
  });

  it("keeps API routes ahead of the static fallback", async () => {
    const response = await request(app, "/api/healthz");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(JSON.parse(response.body)).toEqual({ status: "ok" });
  });

  it("returns JSON 404s for unknown API routes", async () => {
    const response = await request(app, "/api/nope");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(JSON.parse(response.body)).toEqual({ error: "Not found" });
  });
});
