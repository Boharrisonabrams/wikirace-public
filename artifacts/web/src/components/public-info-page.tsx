import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface InfoSection {
  title: string;
  paragraphs: readonly string[];
}

export function PublicInfoPage({
  children,
  eyebrow,
  intro,
  sections,
  title,
}: {
  children?: React.ReactNode;
  eyebrow: string;
  intro: string;
  sections: readonly InfoSection[];
  title: string;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[var(--wiki-chrome)] px-4 py-8 text-foreground">
      <main className="mx-auto max-w-2xl">
        <button
          aria-label="Back to WikiRace"
          className="mb-6 flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--wiki-blue)]"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-4 w-4" />
          WikiRace
        </button>

        <article className="border border-[var(--wiki-rule)] bg-white px-5 py-7 sm:px-8 sm:py-9">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--wiki-red)]">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold leading-tight">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
            {intro}
          </p>

          <div className="mt-8 space-y-8">
            {sections.map((section) => (
              <section key={section.title}>
                <h2 className="border-b border-[var(--wiki-hairline)] pb-2 font-serif text-2xl font-semibold">
                  {section.title}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-6">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {children}
        </article>
      </main>
    </div>
  );
}
