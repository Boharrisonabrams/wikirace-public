export {
  LINK_RESULT_CAP,
  buildSearchSections,
  filterArticleLinks,
  linkRowSubtitle,
  resolveLinkSearchMode,
  splitByRange,
  splitSnippet,
} from "@workspace/game-client";
export type {
  LinkMatch,
  LinkSearchMode,
  LinkSectionStatus,
  SearchSections,
  TextSectionStatus,
} from "@workspace/game-client";

export type SearchSheetMode = "closed" | "expanded" | "mini";
