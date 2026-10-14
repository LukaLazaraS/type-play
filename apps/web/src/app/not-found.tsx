import Link from "next/link";

export default function NotFound() {
  return (
    <main className="widget create">
      <h1 className="title">No such screen.</h1>
      <p className="create__text">That page does not exist, or it moved.</p>
      <Link href="/" className="button">
        Back home
      </Link>
    </main>
  );
}
