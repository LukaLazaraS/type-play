import { ButtonLink } from "@/components/ui/ButtonLink";
import { TextLink } from "@/components/ui/TextLink";
import { cx } from "@/components/ui/cx";

/**
 * "Make your own game." (the share page and the gallery): a paper widget beside an upright game or under a wide one, with
 * Make your own (hot) and How it works. `wide`: the gallery's, at the end of the page; `narrowOnly`: only where nothing
 * can sit beside the stage; `more`: the link to the gallery under it (the share page's).
 */
export function MakeYourOwn({ id, wide, narrowOnly, more }: { id: string; wide?: boolean; narrowOnly?: boolean; more?: boolean }) {
  return (
    <section className={cx("widget play__made", wide && "explore__made")} data-narrow-only={narrowOnly || undefined} aria-labelledby={id}>
      <h2 id={id} className="title play__made-title">
        Make your own game.
      </h2>
      <p className="play__made-text">Type an idea in a sentence. TypePlay builds a real game you can play in a few minutes, and you change it by chatting.</p>
      <div className="play__cta">
        <ButtonLink href="/create">Make your own</ButtonLink>
        <ButtonLink href="/#how" look="quiet">
          How it works
        </ButtonLink>
      </div>
      {more && (
        <TextLink href="/explore" className="play__more">
          More games made with TypePlay
        </TextLink>
      )}
    </section>
  );
}
