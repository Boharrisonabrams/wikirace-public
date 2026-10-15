/**
 * Curated pool of well-known, heavily-linked Wikipedia articles used for
 * daily challenges and practice games. Truly random Wikipedia articles are
 * usually obscure stubs (a village, a beetle) that make games frustrating or
 * unwinnable; every title here is a well-connected hub, so a path between any
 * two of them exists and the game stays fun.
 *
 * Titles must be canonical English Wikipedia article names.
 */
export const ARTICLE_TOPICS = [
  "places",
  "science",
  "animals",
  "food",
  "history",
  "technology",
  "culture",
  "sports",
  "general",
] as const;

export type ArticleTopic = (typeof ARTICLE_TOPICS)[number];
export type Recognition = "familiar" | "discovery";
export type Difficulty = "easy" | "medium" | "hard";

export interface ArticleCandidate {
  title: string;
  topic: ArticleTopic;
  recognition: Recognition;
}

export interface DailyPair {
  start: string;
  end: string;
  startTopic: ArticleTopic;
  endTopic: ArticleTopic;
  startRecognition: Recognition;
  endRecognition: Recognition;
  difficulty: Difficulty;
  difficultySource: "provisional";
  generatorVersion: 2;
  seed: string;
}

const DISCOVERY_TITLES = new Set([
  "Amazon rainforest",
  "Great Barrier Reef",
  "Photosynthesis",
  "Periodic table",
  "Honey bee",
  "Chimpanzee",
  "Taco",
  "Curry",
  "Industrial Revolution",
  "Middle Ages",
  "Printing press",
  "International Space Station",
  "Opera",
  "Ballet",
  "Cricket",
  "Formula One",
  "Pyramid",
  "Lighthouse",
]);

function articleGroup(topic: ArticleTopic, titles: string[]): ArticleCandidate[] {
  return titles.map((title) => ({
    title,
    topic,
    recognition: DISCOVERY_TITLES.has(title) ? "discovery" : "familiar",
  }));
}

export const ARTICLE_CANDIDATES: ArticleCandidate[] = [
  // Countries & places
  ...articleGroup("places", [
    "United States",
    "Japan",
    "France",
    "Brazil",
    "India",
    "Australia",
    "Egypt",
    "Italy",
    "Mexico",
    "Canada",
    "Germany",
    "China",
    "Russia",
    "United Kingdom",
    "Spain",
    "Greece",
    "Turkey",
    "Kenya",
    "Argentina",
    "South Korea",
    "Norway",
    "Netherlands",
    "Switzerland",
    "Portugal",
    "New York City",
    "London",
    "Paris",
    "Tokyo",
    "Rome",
    "Los Angeles",
    "Chicago",
    "Amsterdam",
    "Berlin",
    "Istanbul",
    "Sydney",
    "San Francisco",
    "Venice",
    "Barcelona",
    "Dubai",
    "Singapore",
    "Hawaii",
    "Antarctica",
    "Amazon rainforest",
    "Sahara",
    "Mount Everest",
    "Grand Canyon",
    "Great Barrier Reef",
    "Nile",
    "Pacific Ocean",
    "Mediterranean Sea",
  ]),
  // Science & nature
  ...articleGroup("science", [
    "Albert Einstein",
    "Isaac Newton",
    "Charles Darwin",
    "Marie Curie",
    "Physics",
    "Chemistry",
    "Biology",
    "Mathematics",
    "Astronomy",
    "Evolution",
    "DNA",
    "Photosynthesis",
    "Gravity",
    "Electricity",
    "Solar System",
    "Moon",
    "Mars",
    "Sun",
    "Earth",
    "Black hole",
    "Dinosaur",
    "Volcano",
    "Earthquake",
    "Hurricane",
    "Lightning",
    "Human brain",
    "Heart",
    "Blood",
    "Vaccine",
    "Antibiotic",
    "Periodic table",
    "Oxygen",
    "Gold",
    "Diamond",
    "Water",
  ]),
  // Animals
  ...articleGroup("animals", [
    "Lion",
    "Tiger",
    "Elephant",
    "Blue whale",
    "Dolphin",
    "Shark",
    "Eagle",
    "Penguin",
    "Octopus",
    "Honey bee",
    "Butterfly",
    "Wolf",
    "Giant panda",
    "Kangaroo",
    "Polar bear",
    "Horse",
    "Dog",
    "Cat",
    "Snake",
    "Crocodile",
    "Owl",
    "Spider",
    "Ant",
    "Chimpanzee",
  ]),
  // Food & drink
  ...articleGroup("food", [
    "Pizza",
    "Sushi",
    "Chocolate",
    "Coffee",
    "Tea",
    "Bread",
    "Cheese",
    "Ice cream",
    "Pasta",
    "Hamburger",
    "Rice",
    "Apple",
    "Banana",
    "Tomato",
    "Potato",
    "Honey",
    "Wine",
    "Beer",
    "Taco",
    "Curry",
  ]),
  // History & society
  ...articleGroup("history", [
    "World War II",
    "World War I",
    "Roman Empire",
    "Ancient Egypt",
    "Ancient Greece",
    "Renaissance",
    "Industrial Revolution",
    "French Revolution",
    "American Civil War",
    "Cold War",
    "Vikings",
    "Middle Ages",
    "Julius Caesar",
    "Cleopatra",
    "Napoleon",
    "Abraham Lincoln",
    "George Washington",
    "Winston Churchill",
    "Mahatma Gandhi",
    "Martin Luther King Jr.",
    "Nelson Mandela",
    "Christopher Columbus",
    "Leonardo da Vinci",
    "William Shakespeare",
    "Democracy",
    "Money",
    "Olympic Games",
    "United Nations",
  ]),
  // Technology
  ...articleGroup("technology", [
    "Computer",
    "Internet",
    "Artificial intelligence",
    "Smartphone",
    "Electric car",
    "Airplane",
    "Rocket",
    "Robot",
    "Video game",
    "Telescope",
    "Camera",
    "Television",
    "Radio",
    "Printing press",
    "Steam engine",
    "Bicycle",
    "Automobile",
    "Satellite",
    "GPS",
    "Apollo 11",
    "International Space Station",
    "NASA",
  ]),
  // Arts, music & culture
  ...articleGroup("culture", [
    "Music",
    "Painting",
    "Sculpture",
    "Photography",
    "Cinema",
    "The Beatles",
    "Ludwig van Beethoven",
    "Wolfgang Amadeus Mozart",
    "Elvis Presley",
    "Michael Jackson",
    "Guitar",
    "Piano",
    "Violin",
    "Jazz",
    "Rock music",
    "Hip hop music",
    "Opera",
    "Ballet",
    "Mona Lisa",
    "Vincent van Gogh",
    "Pablo Picasso",
    "Harry Potter",
    "Star Wars",
    "The Lord of the Rings",
    "Mickey Mouse",
  ]),
  // Sports & games
  ...articleGroup("sports", [
    "Association football",
    "Basketball",
    "Baseball",
    "Tennis",
    "Golf",
    "Cricket",
    "Swimming",
    "Marathon",
    "Chess",
    "Poker",
    "FIFA World Cup",
    "Super Bowl",
    "Formula One",
    "Skateboarding",
  ]),
  // Misc strong hubs
  ...articleGroup("general", [
    "Language",
    "English language",
    "Book",
    "Library",
    "School",
    "University",
    "Hospital",
    "Bridge",
    "Castle",
    "Pyramid",
    "Clock",
    "Calendar",
    "Map",
    "Flag",
    "Rainbow",
    "Snow",
    "Desert",
    "Forest",
    "River",
    "Island",
    "Ship",
    "Train",
    "Lighthouse",
  ]),
];

export const ARTICLE_POOL: string[] = ARTICLE_CANDIDATES.map(({ title }) => title);

/** FNV-1a hash — deterministic across processes (no Math.random). */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const GENERATOR_VERSION = 2 as const;
const GENERATOR_EPOCH_DAY = Math.floor(Date.UTC(1970, 0, 1) / 86_400_000);
const generatedPairs = new Map<string, DailyPair>();
const recentGeneratedTitles: string[][] = [];
let generatedThroughDay = GENERATOR_EPOCH_DAY - 1;

const CLOSELY_RELATED_TOPICS = new Set([
  "animals:science",
  "culture:food",
  "culture:history",
  "culture:sports",
  "history:places",
  "science:technology",
]);

function dayNumberForDate(isoDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) throw new Error("Invalid ISO date");
  const timestamp = Date.parse(`${isoDate}T00:00:00.000Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== isoDate) {
    throw new Error("Invalid ISO date");
  }
  return Math.floor(timestamp / 86_400_000);
}

function dateForDayNumber(dayNumber: number): string {
  return new Date(dayNumber * 86_400_000).toISOString().slice(0, 10);
}

function chooseCandidate(
  candidates: ArticleCandidate[],
  salt: string,
  excludedTitles: Set<string>
): ArticleCandidate {
  const startIndex = fnv1a(salt) % candidates.length;
  for (let offset = 0; offset < candidates.length; offset++) {
    const candidate = candidates[(startIndex + offset) % candidates.length];
    if (!excludedTitles.has(candidate.title)) return candidate;
  }
  throw new Error("Article catalogue exhausted");
}

function difficultyFor(start: ArticleCandidate, end: ArticleCandidate): Difficulty {
  if (end.recognition === "discovery") return "hard";
  const topicKey = [start.topic, end.topic].sort().join(":");
  return CLOSELY_RELATED_TOPICS.has(topicKey) ? "easy" : "medium";
}

function generatePair(isoDate: string, recentlyUsed: Set<string>): DailyPair {
  const seed = `wikipath-v${GENERATOR_VERSION}:${isoDate}`;
  const familiarCandidates = ARTICLE_CANDIDATES.filter(
    ({ recognition }) => recognition === "familiar"
  );
  const start = chooseCandidate(familiarCandidates, `${seed}:start`, recentlyUsed);

  const endRecognition: Recognition =
    fnv1a(`${seed}:recognition`) % 3 === 0 ? "discovery" : "familiar";
  const endCandidates = ARTICLE_CANDIDATES.filter(
    (candidate) => candidate.topic !== start.topic && candidate.recognition === endRecognition
  );
  const end = chooseCandidate(
    endCandidates,
    `${seed}:end`,
    new Set([...recentlyUsed, start.title])
  );

  return {
    start: start.title,
    end: end.title,
    startTopic: start.topic,
    endTopic: end.topic,
    startRecognition: start.recognition,
    endRecognition: end.recognition,
    difficulty: difficultyFor(start, end),
    difficultySource: "provisional",
    generatorVersion: GENERATOR_VERSION,
    seed,
  };
}

/**
 * Deterministic start/end pair for a given UTC date (YYYY-MM-DD). Selection
 * advances from a fixed epoch so every process rotates around the same titles
 * used during the preceding seven generated dates.
 */
export function dailyPairForDate(isoDate: string): DailyPair {
  const targetDay = dayNumberForDate(isoDate);
  if (targetDay < GENERATOR_EPOCH_DAY) return generatePair(isoDate, new Set());

  while (generatedThroughDay < targetDay) {
    generatedThroughDay += 1;
    const date = dateForDayNumber(generatedThroughDay);
    const recentlyUsed = new Set(recentGeneratedTitles.flat());
    const pair = generatePair(date, recentlyUsed);
    generatedPairs.set(date, pair);
    recentGeneratedTitles.push([pair.start, pair.end]);
    if (recentGeneratedTitles.length > 7) recentGeneratedTitles.shift();
  }

  const pair = generatedPairs.get(isoDate);
  if (!pair) throw new Error("Unable to generate daily pair");
  return pair;
}

/** Random pair from the pool for practice games. */
export function randomPair(): { start: string; end: string } {
  const n = ARTICLE_POOL.length;
  const startIdx = Math.floor(Math.random() * n);
  let endIdx = Math.floor(Math.random() * n);
  if (endIdx === startIdx) endIdx = (endIdx + 1) % n;
  return { start: ARTICLE_POOL[startIdx], end: ARTICLE_POOL[endIdx] };
}
