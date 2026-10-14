export const lightColors = {
  chrome: "#f5f2eb",
  surface: "#faf7f0",
  surfaceMuted: "#efece4",
  ink: "#2b2a28",
  inkStrong: "#1a1918",
  inkMuted: "#6b665d",
  border: "#a2a9b1",
  borderSoft: "rgba(43, 42, 40, 0.15)",
  link: "#0645ad",
  accent: "#c15031",
  accentSoft: "#fbe9e1",
  onAccent: "#fffaf3",
  success: "#356c3d",
  successSoft: "#e3f0dd",
  warning: "#8a5a00",
  warningSoft: "#f7e7c4",
  danger: "#9f2f1d",
  dangerSoft: "#f9e4de",
  shadow: "#1a1918",
  overlay: "rgba(26, 25, 24, 0.38)",
  findMatch: "#fff3a3",
  findMatchBorder: "#e8b923",
  findCurrent: "#ffd5c2",
  findCurrentBorder: "#c15031",
} as const;
export type AppColors = {
  [Key in keyof typeof lightColors]: string;
};

export const darkColors: AppColors = {
  chrome: "#1c1a17",
  surface: "#232019",
  surfaceMuted: "#302c25",
  ink: "#e6e1d6",
  inkStrong: "#faf4e8",
  inkMuted: "#afa797",
  border: "#6f6a60",
  borderSoft: "rgba(230, 225, 214, 0.16)",
  link: "#6ea8ff",
  accent: "#e07a5f",
  accentSoft: "#3a251f",
  onAccent: "#1a1918",
  success: "#9cd28f",
  successSoft: "#20351f",
  warning: "#e7be62",
  warningSoft: "#3b2d14",
  danger: "#ff9b8d",
  dangerSoft: "#40231f",
  shadow: "#000000",
  overlay: "rgba(0, 0, 0, 0.5)",
  findMatch: "#5a4717",
  findMatchBorder: "#d0a52a",
  findCurrent: "#5a3027",
  findCurrentBorder: "#e07a5f",
};

export const editorialRadius = {
  small: 6,
  medium: 8,
  large: 12,
  pill: 999,
} as const;

export const editorialType = {
  pageTitle: { fontSize: 32, lineHeight: 39 },
  sectionTitle: { fontSize: 22, lineHeight: 28 },
  cardTitle: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  control: { fontSize: 15, lineHeight: 20 },
  label: { fontSize: 11, lineHeight: 15 },
} as const;
