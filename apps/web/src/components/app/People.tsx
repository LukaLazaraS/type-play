"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { UserPlus, UsersThree } from "@phosphor-icons/react";
import type { GamePeople, InviteLink, Me, PendingInvite, Project } from "@typeplay/shared";
import { Ask } from "@/components/ui/Ask";
import { Button } from "@/components/ui/Button";
import { ErrorLine } from "@/components/ui/ErrorLine";
import { Face, Faces } from "@/components/ui/Faces";
import { TextField } from "@/components/ui/Field";
import { InkPill } from "@/components/ui/InkPill";
import { Popover, type PopoverHandle } from "@/components/ui/Popover";
import { TextButton } from "@/components/ui/TextButton";
import { people as words } from "@/content/app";
import { closedBeta } from "@/content/beta";
import { api } from "@/lib/api";
import { creditsWord, dayOf } from "@/lib/format";

const noop = () => () => {};
const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");
const useCanShare = () => useSyncExternalStore(noop, () => typeof navigator.share === "function", () => false);

/** A made invitation's link, shown until the panel closes (only its hash is kept: a later look needs a new link). */
type Made = { invite: PendingInvite; url: string; renewed: boolean };
/** What went wrong, and where it shows: under the address ("invite"), in a row (its id), at Leave, or under the title. */
type Problem = { at: string; text: string };

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Pair developing (2026-11-04; docs/design/pair-developing.md): the chat header's people button and its panel. The owner
 * invites by email (the link to send, for that address, 7 days), sees each member's credits this month, removes them, and
 * makes a new link for an invitation waiting or takes it back. A member sees who is in and can leave. `changed` counts the
 * game stream's people events: an open panel reads the list again on each (someone else's change, or another tab's).
 */
export function People({ project, me, onLeft, changed = 0, on = "paper" }: { project: Project; me: Me | null; onLeft: () => void; changed?: number; on?: "paper" | "ink" }) {
  const access = project.access;
  const owner = !access || access.role === "owner";
  const everyone = access ? [access.owner, ...access.members] : [];
  const others = everyone.filter((p) => p.id !== me?.id);
  const ownerName = access?.owner.name ?? "";
  // The page holds two of these (the chat header's, the phone tab bar's): every id inside is this one's own.
  const uid = useId();
  const pop = useRef<PopoverHandle>(null);
  const email = useRef<HTMLInputElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<GamePeople | null>(null);
  // When the list was read: an invitation past its end by then says so (the panel is open for minutes, not days).
  const [readAt, setReadAt] = useState(0);
  const [typed, setTyped] = useState("");
  const [made, setMade] = useState<Made | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null); // "leave", or the id of the member to remove
  const [problem, setProblem] = useState<Problem | null>(null);
  const origin = useOrigin();
  const canShare = useCanShare();

  const read = useCallback((l: GamePeople) => {
    setList(l);
    setReadAt(Date.now());
  }, []);

  // Open: the list as it is now, and again whenever the game's stream says its people changed meanwhile.
  useEffect(() => {
    if (!open) return;
    let live = true;
    api.people
      .of(project.id)
      .then((l) => live && read(l))
      .catch((e: unknown) => live && setProblem({ at: "load", text: messageOf(e) }));
    return () => {
      live = false;
    };
  }, [open, project.id, read, changed]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  // A link made (Invite, New link): the keyboard goes to sending it, which says what the link is for.
  useEffect(() => {
    if (made) sendRef.current?.focus();
  }, [made]);

  const linkOf = (token: string) => `${origin}/invite/${token}`;
  const focusLater = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.focus());
  const emailId = `${uid}-email`;

  const act = async (what: string, at: string, work: () => Promise<void>) => {
    if (busy) return;
    setBusy(what);
    setProblem(null);
    try {
      await work();
    } catch (e) {
      setProblem({ at, text: messageOf(e) });
    } finally {
      setBusy(null);
    }
  };

  // The list as the owner's own change left it, at once (the stream's event reads it again a moment later).
  const putInvite = (r: InviteLink, renewed: boolean) => {
    setMade({ invite: r.invite, url: linkOf(r.token), renewed });
    setList((l) => (l ? { ...l, invites: [r.invite, ...(l.invites ?? []).filter((i) => i.id !== r.invite.id)] } : l));
  };

  const invite = (e: FormEvent) => {
    e.preventDefault();
    const address = typed.trim();
    if (!address) {
      email.current?.focus();
      return;
    }
    void act("invite", "invite", async () => {
      const r = await api.people.invite(project.id, address);
      setTyped("");
      putInvite(r, false);
    });
  };

  const newLink = (inv: PendingInvite) =>
    act(`link-${inv.id}`, inv.id, async () => {
      putInvite(await api.people.newLink(project.id, inv.id), true);
    });

  const takeBack = (inv: PendingInvite) =>
    act(`back-${inv.id}`, inv.id, async () => {
      await api.people.takeBack(project.id, inv.id);
      if (made?.invite.id === inv.id) setMade(null);
      setList((l) => (l ? { ...l, invites: (l.invites ?? []).filter((i) => i.id !== inv.id) } : l));
      focusLater(emailId); // its row is gone: the keyboard goes back to the address
    });

  const remove = (userId: string) =>
    act(`remove-${userId}`, userId, async () => {
      await api.people.remove(project.id, userId);
      setAsking(null);
      setList((l) => (l ? { ...l, members: l.members.filter((m) => m.id !== userId) } : l));
      focusLater(emailId);
    });

  const leave = () =>
    act("leave", "leave", async () => {
      await api.people.leave(project.id);
      pop.current?.close();
      onLeft();
    });

  // The question answered "no": the keyboard goes back to the button that asked it.
  const keep = (id: string) => {
    setAsking(null);
    focusLater(id);
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      document.getElementById(`${uid}-link`)?.focus();
    }
  };

  const members = list?.members ?? [];
  const invites = list?.invites ?? [];
  const taken = members.length + invites.filter((i) => Date.parse(i.expiresAt) > readAt).length;
  const full = !!list && taken >= list.max;
  const titleId = `${uid}-title`;
  const noteId = `${uid}-note`;
  const problemAt = (at: string) => (problem?.at === at ? <ErrorLine>{problem.text}</ErrorLine> : null);

  return (
    <Popover
      id={`people-${on}-${project.id}`}
      ref={pop}
      width={360}
      dim
      className="people"
      onOpen={(panel) => {
        setOpen(true);
        // With a mouse the keyboard goes to the address box; a phone's keyboard waits for a tap.
        if (owner && window.matchMedia("(pointer: fine)").matches) panel.querySelector<HTMLInputElement>("input[type=email]")?.focus({ preventScroll: true });
      }}
      onClose={() => {
        setOpen(false);
        setMade(null);
        setAsking(null);
        setProblem(null);
        setCopied(false);
      }}
      trigger={(t) => {
        const label = owner ? `${words.inviteLabel}${others.length ? `. ${words.peopleLabel(everyone.length)}` : ""}` : words.peopleLabel(everyone.length);
        // On a phone it sits at the end of the page's ink tab bar (the chat's header is hidden there, and three tabs leave
        // room for one small pill): the plus while the owner is alone, else the people and how many are in; on paper (the
        // chat's header) the quiet button with the faces and the word.
        return on === "ink" ? (
          <InkPill
            {...t}
            size="small"
            className="people__button"
            aria-label={label}
            icon={owner && everyone.length <= 1 ? <UserPlus size={16} weight="bold" aria-hidden="true" /> : <UsersThree size={16} weight="bold" aria-hidden="true" />}
          >
            {everyone.length > 1 && (
              <span className="figures people__count" aria-hidden="true">
                {everyone.length}
              </span>
            )}
          </InkPill>
        ) : (
          // The word only while the owner is alone: once faces are in, the header has no room for it (the label keeps it).
          <Button {...t} look="quiet" size="small" className="people__button" aria-label={label}>
            <Faces people={others} max={3} />
            {owner && <UserPlus size={16} weight="bold" aria-hidden="true" />}
            {owner && !others.length && <span className="people__word">{words.invite}</span>}
          </Button>
        );
      }}
    >
      <div className="people__head">
        <b id={titleId}>{owner ? words.title : words.memberTitle}</b>
        <span>{owner ? words.lead : words.memberLead(ownerName)}</span>
      </div>
      {problemAt("load")}

      {owner && (
        <form className="people__form" onSubmit={invite} noValidate aria-labelledby={titleId}>
          <TextField
            ref={email}
            id={emailId}
            label={words.emailLabel}
            labelHidden
            type="email"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={words.emailPlaceholder}
            value={typed}
            onChange={(e) => {
              setTyped(e.target.value);
              if (problem?.at === "invite") setProblem(null);
            }}
            error={problem?.at === "invite" ? problem.text : undefined}
            disabled={full}
            boxClassName="people__email"
          />
          {/* Once a link is shown, sending it (Share… or Copy link) is the one hot thing; inviting another goes quiet. */}
          <Button type="submit" size="small" look={made ? "quiet" : undefined} busy={busy === "invite"} busyLabel={words.sending} disabled={full}>
            {words.send}
          </Button>
        </form>
      )}
      {owner && full && <p className="people__note">{words.full(list?.max ?? 10)}</p>}

      {made && (
        <div className="people__link">
          <TextField
            id={`${uid}-link`}
            label={words.linkLabel}
            labelHidden
            readOnly
            value={made.url.replace(/^https?:\/\//, "")}
            onFocus={(e) => e.currentTarget.select()}
            spellCheck={false}
            boxClassName="people__url"
          />
          <div className="people__actions">
            {canShare && (
              <Button
                ref={sendRef}
                size="small"
                aria-describedby={noteId}
                onClick={() =>
                  void navigator.share({ title: project.name, text: words.shareText(project.name), url: made.url }).catch(() => {
                    /* closed the share sheet */
                  })
                }
              >
                {words.shareSheet}
              </Button>
            )}
            <Button ref={canShare ? undefined : sendRef} size="small" look={canShare ? "quiet" : undefined} aria-describedby={canShare ? undefined : noteId} onClick={() => void copy(made.url)}>
              {copied ? words.copied : words.copy}
            </Button>
          </div>
          <p id={noteId} className="people__note">
            {words.linkNote(made.invite.email, made.renewed)}
          </p>
        </div>
      )}
      {owner && closedBeta && <p className="people__note">{words.betaNote}</p>}

      <ul className="people__list" aria-label={words.memberTitle}>
        {access && (
          <li className="people__row">
            <Face person={access.owner} size="row" />
            <div className="people__who">
              <b>{access.owner.id === me?.id ? `${access.owner.name} (${words.you})` : access.owner.name}</b>
              <span>{words.owner}</span>
            </div>
          </li>
        )}
        {(list ? members : (access?.members ?? []).map((m) => ({ ...m, role: "editor" as const, since: "" }))).map((m) => (
          <li key={m.id} className="people__row">
            <Face person={m} size="row" />
            <div className="people__who">
              <b>{m.id === me?.id ? `${m.name} (${words.you})` : m.name}</b>
              <span>{[("email" in m && m.email) || null, words.editor, "spentMonth" in m && m.spentMonth ? words.spent(creditsWord(m.spentMonth)) : null].filter(Boolean).join(" · ")}</span>
            </div>
            {owner && asking !== m.id && (
              <TextButton id={`${uid}-remove-${m.id}`} look="standalone" className="people__act" aria-label={words.removeLabel(m.name)} onClick={() => setAsking(m.id)}>
                {words.remove}
              </TextButton>
            )}
            {owner && asking === m.id && (
              <Ask
                className="people__ask"
                text={words.removeAsk(m.name)}
                actions={
                  <>
                    <Button look="ink" size="small" busy={busy === `remove-${m.id}`} busyLabel={words.removing} onClick={() => void remove(m.id)}>
                      {words.remove}
                    </Button>
                    {/* The keyboard waits on the safe answer: the other one ends their access at once. */}
                    <Button look="quiet" size="small" autoFocus onClick={() => keep(`${uid}-remove-${m.id}`)}>
                      {words.keep}
                    </Button>
                  </>
                }
              />
            )}
            {problemAt(m.id)}
          </li>
        ))}
        {owner &&
          invites.map((inv) => {
            const ended = Date.parse(inv.expiresAt) <= readAt;
            return (
              <li key={inv.id} className="people__row">
                <Face person={{ name: inv.email, avatarUrl: null }} size="row" waiting />
                <div className="people__who">
                  <b className="people__address">{inv.email}</b>
                  <span>{[words.waiting, ended ? words.ended : words.until(dayOf(inv.expiresAt))].join(" · ")}</span>
                </div>
                {/* aria-disabled while another action runs, not disabled: a pressed one keeps the keyboard's place. */}
                <div className="people__acts">
                  <TextButton look="standalone" aria-disabled={!!busy || undefined} aria-label={words.newLinkLabel(inv.email)} onClick={() => void newLink(inv)}>
                    {words.newLink}
                  </TextButton>
                  <TextButton look="standalone" aria-disabled={!!busy || undefined} aria-label={words.takeBackLabel(inv.email)} onClick={() => void takeBack(inv)}>
                    {words.takeBack}
                  </TextButton>
                </div>
                {problemAt(inv.id)}
              </li>
            );
          })}
      </ul>

      {owner && list && !full && <p className="people__note">{words.max(list.max)}</p>}
      {!owner &&
        (asking === "leave" ? (
          <Ask
            text={words.leaveAsk(ownerName)}
            actions={
              <>
                <Button look="ink" size="small" busy={busy === "leave"} busyLabel={words.leaving} onClick={() => void leave()}>
                  {words.leave}
                </Button>
                <Button look="quiet" size="small" autoFocus onClick={() => keep(`${uid}-leave`)}>
                  {words.stay}
                </Button>
              </>
            }
          />
        ) : (
          <Button id={`${uid}-leave`} look="quiet" size="small" className="people__leave" onClick={() => setAsking("leave")}>
            {words.leave}
          </Button>
        ))}
      {problemAt("leave")}
    </Popover>
  );
}
