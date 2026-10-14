// Placeholder support address. Replace it with your own before deploying.
// Contact for this project: see GitHub profile.
export const SUPPORT_EMAIL = "support@example.com";
export const PRIVACY_EFFECTIVE_DATE = "July 14, 2026";

export const PRIVACY_SECTIONS = [
  {
    title: "Information WikiRace handles",
    paragraphs: [
      "WikiRace stores the player identity needed to run an account, including an assigned user ID and username. If you save a guest profile, it also stores the email address and display name you provide.",
      "WikiRace stores gameplay records such as races started, article paths, clicks, active solve time, results, streaks, rankings, private challenges, and friend relationships. Search terms are sent to the service to return Wikipedia article suggestions and may appear in short-lived operational logs.",
    ],
  },
  {
    title: "How the information is used",
    paragraphs: [
      "The information is used only to authenticate players, run races, preserve progress, calculate rankings and streaks, connect accepted friends, operate shared challenges, prevent abuse, and diagnose service failures.",
      "WikiRace does not sell personal information, show third-party advertising, or use player activity for cross-app tracking.",
    ],
  },
  {
    title: "Services involved",
    paragraphs: [
      "Supabase provides authentication and database services. Railway hosts the WikiRace API and browser app. Expo provides app build, update, and distribution infrastructure. Wikipedia and Wikimedia services provide article content, images, links, and search suggestions. These providers may process technical information needed to deliver and secure their services.",
      "Daily reminders are local notifications scheduled on the device. WikiRace does not use them for remote advertising or marketing messages.",
    ],
  },
  {
    title: "Deletion and retention",
    paragraphs: [
      "Open You → Account → Delete account in the WikiRace app to permanently delete the current account and its associated profile, race history, rankings, private challenges, and friendships. This applies to saved accounts and automatically created guest profiles.",
      "Operational backups and security logs may persist for a limited period before automatic rotation. Information may be retained when required to protect the service or comply with law.",
    ],
  },
] as const;

export const SUPPORT_SECTIONS = [
  {
    title: "Before contacting support",
    paragraphs: [
      "Force-quit and reopen WikiRace, confirm the device has an internet connection, and try the action one more time. If a race is in progress, WikiRace will normally restore it after relaunch.",
      "For a shared race, include the challenge link. For a gameplay problem, include the start article, target article, current article, and what you expected to happen. Do not send a password or authentication code.",
    ],
  },
  {
    title: "Account and privacy controls",
    paragraphs: [
      "The You tab contains the friend code, friend requests, sign-out control, privacy policy, and permanent account deletion. Account deletion is completed in the app and does not require an email request.",
    ],
  },
] as const;
