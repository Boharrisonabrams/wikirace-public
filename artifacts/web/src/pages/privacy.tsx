import { PublicInfoPage } from "@/components/public-info-page";
import {
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_SECTIONS,
  SUPPORT_EMAIL,
} from "@/lib/legal-content";

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      eyebrow={`Effective ${PRIVACY_EFFECTIVE_DATE}`}
      intro="This policy explains what information WikiRace handles when you race through Wikipedia, save a profile, join leaderboards, add friends, or share a challenge."
      sections={PRIVACY_SECTIONS}
      title="Privacy policy"
    >
      <section className="mt-8 border-t border-[var(--wiki-hairline)] pt-6">
        <h2 className="font-serif text-2xl font-semibold">Questions</h2>
        <p className="mt-3 text-sm leading-6">
          Contact{" "}
          <a
            className="text-[var(--wiki-blue)] underline"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </PublicInfoPage>
  );
}
