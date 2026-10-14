export interface GamePathMapModel {
  start: string;
  current: string;
  target: string;
  hasMoved: boolean;
  hiddenArticles: string[];
  hiddenHopCount: number;
}

export function buildGamePathMap(
  path: readonly string[],
  target: string,
): GamePathMapModel {
  const articles = path.filter((article) => article.trim().length > 0);
  const start = articles[0] ?? "Start";
  const current = articles[articles.length - 1] ?? start;

  return {
    start,
    current,
    target,
    hasMoved: articles.length > 1,
    hiddenArticles: articles.slice(1, -1),
    hiddenHopCount: Math.max(0, articles.length - 2),
  };
}
