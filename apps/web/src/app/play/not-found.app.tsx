import { ButtonLink } from "@/components/ui/ButtonLink";
import { PageWidget } from "@/components/ui/PageWidget";

// A share link whose game isn't shared (any more), or never was: the same words for both.
export default function GameNotFound() {
  return (
    <PageWidget
      site
      className="play-gone"
      title="This game isn't here."
      lead="Its maker may have stopped sharing it, or the link is wrong. You can make your own in a few minutes."
    >
      <ButtonLink href="/create">Make your own</ButtonLink>
    </PageWidget>
  );
}
