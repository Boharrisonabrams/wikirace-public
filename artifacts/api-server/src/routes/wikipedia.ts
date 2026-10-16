import { Router } from "express";
import {
  fetchArticle,
  getRandomArticle,
  searchArticles,
  searchWikipediaSuggestions,
} from "../lib/wikipedia";

const router = Router();

router.get("/wikipedia/random", async (req, res) => {
  try {
    const article = await getRandomArticle();
    if (!article) return res.status(500).json({ error: "Failed to get random article" });
    return res.json(article);
  } catch (err) {
    req.log.error({ err }, "Error getting random article");
    return res.status(500).json({ error: "Failed to get random article" });
  }
});

router.get("/wikipedia/search", async (req, res) => {
  const query = req.query.q as string;
  const limit = Math.min(parseInt((req.query.limit as string) || "10", 10) || 10, 25);

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const results = await searchArticles(query, limit);
    return res.json({ results });
  } catch (err) {
    req.log.error({ err }, "Error searching articles");
    return res.status(500).json({ error: "Failed to search articles" });
  }
});

router.get("/wikipedia/suggestions", async (req, res) => {
  const rawQuery = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const query = typeof rawQuery === "string" ? rawQuery.trim() : "";
  const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const parsedLimit = typeof rawLimit === "string" ? Number.parseInt(rawLimit, 10) : 6;
  const limit = Math.min(6, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 6));

  if (!query) {
    return res.status(400).json({ error: "Query parameter is required" });
  }

  try {
    const suggestions = await searchWikipediaSuggestions(query, limit);
    return res.json({ suggestions: suggestions.slice(0, 6) });
  } catch (err) {
    req.log.error({ err }, "Error loading Wikipedia suggestions");
    return res.status(502).json({ error: "Failed to load Wikipedia suggestions" });
  }
});

router.get("/wikipedia/article/:title", async (req, res) => {
  try {
    const title = decodeURIComponent(req.params.title);
    const article = await fetchArticle(title);
    if (!article.exists) {
      return res.status(404).json({ error: "Article not found", exists: false });
    }
    return res.json(article);
  } catch (err) {
    req.log.error({ err }, "Error fetching article");
    return res.status(500).json({ error: "Failed to fetch article" });
  }
});

export default router;
