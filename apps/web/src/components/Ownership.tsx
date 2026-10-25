import { Check } from "@phosphor-icons/react/dist/ssr";
import { TextLink } from "@/components/ui/TextLink";
import { ownership } from "@/content/site";

/** "Your game is yours": what the terms promise about ownership, on the home and pricing pages. */
export function Ownership() {
  return (
    <section className="section" id="yours" aria-labelledby="yours-title">
      <h2 id="yours-title" className="title">
        {ownership.title}
      </h2>
      <div className="widget yours">
        <ul>
          {ownership.points.map((p) => (
            <li key={p}>
              <Check size={18} weight="bold" aria-hidden="true" />
              {p}
            </li>
          ))}
        </ul>
        <p>
          {ownership.note}{" "}
          <TextLink href="/terms">Read the terms</TextLink>
        </p>
      </div>
    </section>
  );
}
