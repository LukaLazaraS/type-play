"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { Invitation } from "@typeplay/shared";
import { GameTile } from "@/components/app/GameTile";
import { SignIn } from "@/components/app/SignIn";
import { AppTile } from "@/components/ui/AppIcon";
import { Button } from "@/components/ui/Button";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { Face } from "@/components/ui/Faces";
import { PageWidget } from "@/components/ui/PageWidget";
import { people as words } from "@/content/app";
import { api, ApiFailure } from "@/lib/api";
import { dayOf } from "@/lib/format";
import { refreshMe, signOut, useSession } from "@/lib/session";
import { posterUrl } from "@/lib/urls";

type Load =
  | { status: "loading" }
  | { status: "ok"; invitation: Invitation }
  | { status: "wrong"; message: string }
  | { status: "ended"; message: string }
  | { status: "declined"; owner: string }
  | { status: "error"; message: string };

/**
 * /invite/<token> (pair developing, 2026-11-04): the link an owner sent. Who invites you, to which game, and who pays
 * (the owner), then Accept and open it or No thanks. Signed out: sign in, and back here. Another account than the one
 * invited: which address it is for, and the way to sign in with it. Ended: ask for a new link. Accepted already (you're
 * in the game): the link opens the game.
 */
export function InviteClient() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const session = useSession();
  const signedIn = session.status === "in";
  const myEmail = session.status === "in" ? (session.me?.email ?? null) : null;
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!signedIn || !token) return;
    let live = true;
    api.people
      .byLink(token)
      .then((invitation) => {
        if (!live) return;
        if (invitation.accepted) router.replace(`/games/${invitation.game.id}`);
        else setLoad({ status: "ok", invitation });
      })
      .catch((e: unknown) => {
        if (!live) return;
        const f = e instanceof ApiFailure ? e : null;
        if (f?.code === "wrong_account") setLoad({ status: "wrong", message: f.message });
        else if (f?.code === "not_found") setLoad({ status: "ended", message: f.message });
        else setLoad({ status: "error", message: e instanceof Error ? e.message : String(e) });
      });
    return () => {
      live = false;
    };
  }, [signedIn, token, router]);

  // Declined: the page changes in place, so its new title takes the focus (and is read out).
  useEffect(() => {
    if (load.status === "declined") titleRef.current?.focus();
  }, [load.status]);

  const accept = async (invitation: Invitation) => {
    setBusy("accept");
    setError(null);
    try {
      const { projectId } = await api.people.accept(invitation.id);
      void refreshMe();
      router.replace(`/games/${projectId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  };

  const decline = async (invitation: Invitation) => {
    setBusy("decline");
    setError(null);
    try {
      await api.people.decline(invitation.id);
      setLoad({ status: "declined", owner: invitation.owner.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  if (session.status === "loading") return <PageWidget busy />;
  if (session.status === "out") {
    return (
      <PageWidget title={words.waitingTitle} lead={words.signIn}>
        <SignIn next={`/invite/${token}`} />
      </PageWidget>
    );
  }
  if (load.status === "loading") return <PageWidget lead={words.opening} busy />;
  if (load.status === "wrong") {
    return (
      <PageWidget className="invitepage" title={words.wrongTitle} lead={myEmail ? `${load.message} ${words.signedInAs(myEmail)}` : load.message} leadRole="alert">
        <div className="invitepage__actions">
          <Button onClick={() => void signOut()}>{words.otherAccount}</Button>
          <ButtonLink look="quiet" href="/games">
            {words.yourGames}
          </ButtonLink>
        </div>
      </PageWidget>
    );
  }
  if (load.status === "ended" || load.status === "error") {
    return (
      <PageWidget className="invitepage" title={load.status === "ended" ? words.endedTitle : words.failedTitle} lead={load.message} leadRole="alert">
        <ButtonLink href="/games">{words.yourGames}</ButtonLink>
      </PageWidget>
    );
  }
  if (load.status === "declined") {
    return (
      <PageWidget className="invitepage" title={words.declined} titleRef={titleRef} lead={words.declinedLead(load.owner)}>
        <ButtonLink href="/games">{words.yourGames}</ButtonLink>
      </PageWidget>
    );
  }
  const { invitation } = load;
  const { game, owner } = invitation;
  return (
    <PageWidget className="invitepage" title={words.pageTitle(game.name)} lead={words.pageLead(owner.name)}>
      <div className="invitepage__game">
        <AppTile className="invitepage__tile">
          <GameTile id={game.id} name={game.name} building={false} poster={game.buildId && game.poster ? posterUrl(game.buildId) : null} />
        </AppTile>
        <div>
          <b>{game.name}</b>
          <p className="invitepage__note">
            <Face person={owner} size="small" />
            <span>{words.pageNote(owner.name, dayOf(invitation.expiresAt))}</span>
          </p>
        </div>
      </div>
      <div className="invitepage__actions">
        <Button busy={busy === "accept"} busyLabel={words.accepting} disabled={busy === "decline"} onClick={() => void accept(invitation)}>
          {words.acceptOpen}
        </Button>
        <Button look="quiet" busy={busy === "decline"} disabled={busy === "accept"} onClick={() => void decline(invitation)}>
          {words.decline}
        </Button>
      </div>
      {error && <ErrorLine>{error}</ErrorLine>}
    </PageWidget>
  );
}
