import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchArticleDescription,
  fetchArticleRedirectAliases,
  searchWikipediaSuggestions,
} from "./wikipedia";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Wikipedia REST suggestions", () => {
  it("maps canonical titles and nullable descriptions without HTML", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          pages: [
            {
              title: "Castle",
              description: "<b>fortified</b> structure &amp; residence",
              excerpt: '<span class="searchmatch">Castle</span>',
            },
            { title: "Castle Rock", description: null },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchWikipediaSuggestions("cast", 6)).resolves.toEqual([
      { title: "Castle", description: "fortified structure & residence" },
      { title: "Castle Rock", description: null },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://en.wikipedia.org/w/rest.php/v1/search/page?q=cast&limit=6",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("throws on an upstream error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );

    await expect(searchWikipediaSuggestions("cast", 6)).rejects.toThrow(
      "Wikipedia REST API responded 503",
    );
  });

  it("loads redirect aliases for a canonical title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            query: {
              pages: {
                "1": {
                  title: "Tiger",
                  redirects: [{ title: "Tigers" }, { title: "Tiger cat" }],
                },
              },
            },
          }),
          { status: 200 },
        ),
      ),
    );

    await expect(fetchArticleRedirectAliases("Tiger")).resolves.toEqual([
      "Tigers",
      "Tiger cat",
    ]);
  });

  it("omits aliases and descriptions when wikipedia lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })),
    );

    await expect(fetchArticleRedirectAliases("Lion")).resolves.toEqual([]);
    await expect(fetchArticleDescription("Lion")).resolves.toBeNull();
  });
});
