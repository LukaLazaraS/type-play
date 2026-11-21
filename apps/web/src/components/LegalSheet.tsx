import { withAddresses } from "@/components/ui/Address";
import type { LegalDoc } from "@/content/legal";
import { site } from "@/content/site";

export function LegalSheet({ doc }: { doc: LegalDoc }) {
  return (
    <main>
      <article className="widget sheet">
        <h1 className="title">{doc.title}</h1>
        <div className="updated">Updated {site.updated}</div>
        <p className="intro">{withAddresses(doc.intro)}</p>
        {doc.sections.map((s) => (
          <section key={s.heading}>
            <h2 className="title">{s.heading}</h2>
            {s.paragraphs.map((p) => (
              <p key={p}>{withAddresses(p)}</p>
            ))}
            {s.list && (
              <ul>
                {s.list.map((item) => (
                  <li key={item}>{withAddresses(item)}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </article>
    </main>
  );
}
