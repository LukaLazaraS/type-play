import type { ReactNode } from "react";

/**
 * One sentence that needs a decision, with its one button (DESIGN.md, Plan and billing: the strips): 600 15px after the
 * hot dot. A paper strip above the cards; inside the chat's composer a Field strip (`field`), 14px.
 */
export function Strip({ field, kind, label, role, action, children }: { field?: boolean; kind: string; label?: string; role?: "status"; action?: ReactNode; children: ReactNode }) {
  if (field) {
    return (
      <div className="notestrip notestrip--field panel" role={role} data-strip={kind}>
        <p>{children}</p>
        {action}
      </div>
    );
  }
  return (
    <section className="widget notestrip" data-strip={kind} aria-label={label} role={role}>
      <p>{children}</p>
      {action}
    </section>
  );
}
