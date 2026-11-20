import { ModelTile } from "@/components/ui/ModelTile";
import { AIS, creditRows, plans } from "@/content/site";
import { usdCents } from "@/lib/format";

const medium = plans.find((p) => p.id === "medium")!;
/** What a credit costs on Medium ($20 for 100: $0.20), the dollars beside every number. */
export const mediumPerCredit = medium.price / medium.credits;

/**
 * "What credits buy" on /pricing: one message a row (a change, a simple new game, a big one), the three AIs across, in
 * credits with the dollars on Medium under each (content/site.ts `creditRows`, from the app's own estimate). A real
 * table, so a screen reader names the row and the AI for every number; on phones each row's words take the full width
 * over its three numbers (globals.css "Credits table"), which needs the roles spelled out: a table whose rows are laid
 * out as a grid loses them in some browsers.
 */
export function CreditsTable() {
  return (
    <div className="widget credits">
      <table className="credits__table" role="table">
        <caption className="sr-only">What one message costs per AI, in credits, with the dollars at Medium&apos;s price</caption>
        <thead role="rowgroup">
          <tr className="credits__head" role="row">
            <td className="credits__corner" role="cell" />
            {AIS.map((ai) => (
              <th key={ai.id} scope="col" role="columnheader" className="credits__ai">
                <span className="credits__ainame">
                  <ModelTile model={ai.id} />
                  <span>
                    <b>{ai.name}</b>
                    <small>{ai.id === "fast" ? "On Free too" : "Paid plans"}</small>
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {creditRows.map((row) => (
            <tr key={row.id} className="credits__row" role="row">
              <th scope="row" role="rowheader" className="credits__size">
                <b>{row.name}</b>
                <span>{row.quoted ? <q>{row.example}</q> : row.example}</span>
              </th>
              {AIS.map((ai) => {
                const cost = row.cost(ai.id);
                return (
                  <td key={ai.id} role="cell" className="credits__cell">
                    <span className="credits__num">
                      {row.about && <small>about </small>}
                      {cost}
                      <small> credits</small>
                    </span>
                    <span className="figures credits__usd">{usdCents(cost * mediumPerCredit)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
