import Link from "next/link";

// A share link whose game isn't shared (any more), or never was: the same words for both.
export default function GameNotFound() {
  return (
    <main className="widget create play-gone">
      <h1 className="title">This game isn&apos;t here.</h1>
      <p className="create__text">Its maker may have stopped sharing it, or the link is wrong. You can make your own in a few minutes.</p>
      <Link href="/create" className="button">
        Make your own
      </Link>
    </main>
  );
}
