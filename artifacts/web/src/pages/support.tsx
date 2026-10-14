import { PublicInfoPage } from "@/components/public-info-page";
import { SUPPORT_EMAIL, SUPPORT_SECTIONS } from "@/lib/legal-content";

export default function SupportPage() {
  return (
    <PublicInfoPage
      eyebrow="WikiRace help"
      intro="Get help with an account, a daily race, a private challenge, sharing, reminders, or a leaderboard result."
      sections={SUPPORT_SECTIONS}
      title="Support"
    >
      <section className="mt-8 border-t border-[var(--wiki-hairline)] pt-6">
        <h2 className="font-serif text-2xl font-semibold">Contact</h2>
        <p className="mt-3 text-sm leading-6">
          Email{" "}
          <a
            className="text-[var(--wiki-blue)] underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          . Include the device model and iOS version when the problem is
          specific to the app.
        </p>
      </section>
    </PublicInfoPage>
  );
}
