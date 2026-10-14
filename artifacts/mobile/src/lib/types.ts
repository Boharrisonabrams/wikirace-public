export type ChallengeType = "daily" | "practice" | "friend";
export type DailyBoard = "shortest" | "fastest";
export type TimingAction = "resume" | "pause" | "heartbeat";
export type SearchTier = "find" | "palette";

export interface DailyChallenge {
  id: string;
  date: string;
  startArticle: string;
  endArticle: string;
  startTitle: string;
  endTitle: string;
  startDescription?: string | null;
  endDescription?: string | null;
  difficulty?: string;
  difficultySource?: string;
  generatorVersion: number;
  generatorSeed: string | null;
  startTopic: string | null;
  endTopic: string | null;
  startRecognition: string | null;
  endRecognition: string | null;
}

export interface DailyChallengeResponse {
  challenge: DailyChallenge;
  session: GameSession | null;
  localDate: string;
  replayAvailable: boolean;
}

export interface GameSession {
  id: string;
  challengeType: ChallengeType;
  challengeId: string | null;
  friendChallengeId: string | null;
  startArticle: string;
  endArticle: string;
  startDescription?: string | null;
  endDescription?: string | null;
  path: string[];
  clicks: number;
  completed: boolean;
  won: boolean;
  gaveUp: boolean;
  timeSeconds: number | null;
  startedAt: string;
  completedAt: string | null;
  attemptNumber: number;
  isOfficial: boolean;
  searchTier?: SearchTier;
  localDate: string | null;
  timeZone: string | null;
  activeTimeMs: number;
  timingActive: boolean;
}

export interface TimingState {
  activeTimeMs: number;
  timingActive: boolean;
}

export interface StreakInfo {
  current: number;
  longest: number;
  extended: boolean;
}

export interface GameResult {
  won: boolean;
  clicks: number;
  timeSeconds: number;
  path: string[];
  endArticle: string;
  streak: StreakInfo | null;
  gaveUp?: boolean;
  activeTimeMs?: number;
  attemptNumber?: number;
  isOfficial?: boolean;
  difficulty?: string;
  difficultySource?: string;
  eligibleCount?: number | null;
  shortestRank?: number | null;
  fastestRank?: number | null;
  wouldBeShortestRank?: number | null;
  claimed?: boolean;
  isGuest?: boolean;
  challengeId?: string | null;
  challengeUrl?: string | null;
  dailyDate?: string | null;
}

export interface ArticleData {
  title: string;
  html: string;
}

export interface LeaderboardEntry {
  rank: number;
  shortest_rank?: number;
  fastest_rank?: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  clicks: number;
  time_seconds: number;
  active_time_ms?: number;
  completed_at: string;
  path?: string[];
}

export interface ProfileStats {
  gamesPlayed: number;
  gamesWon: number;
  totalClicks: number;
  totalTimeSeconds: number;
  currentStreak: number;
  longestStreak: number;
  lastDailyCompleted: string | null;
  averageClicks: number | null;
  averageActiveTimeMs: number | null;
  bestClicks: number | null;
  fastestTimeMs: number | null;
}

export interface ProfileSummary {
  userId: string;
  username: string;
  displayName: string | null;
  friendCode: string;
  avatarUrl: string | null;
  claimed: boolean;
  isGuest: boolean;
}

export interface ProfileResponse {
  profile: ProfileSummary;
  stats: ProfileStats;
}

export interface FriendProfile {
  userId: string;
  username: string;
  displayName: string | null;
  friendCode: string;
  friendshipId?: string;
}

export interface FriendsResponse {
  friends: FriendProfile[];
  pendingIncoming: FriendProfile[];
  pendingOutgoing: FriendProfile[];
}
