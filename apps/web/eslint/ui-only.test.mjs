// Tests of eslint/ui-only.mjs (npm run check runs this file; RuleTester throws on the first case that fails).
import { RuleTester } from "eslint";
import rule from "./ui-only.mjs";

const tester = new RuleTester({ languageOptions: { ecmaVersion: "latest", sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } } });
const err = (messageId) => ({ messageId });

tester.run("ui-only", rule, {
  valid: [
    // The pieces themselves, and plain markup around them.
    `<Button look="quiet" size="small" onClick={go}>Save</Button>`,
    `<ButtonLink href="/create">Make a game</ButtonLink>`,
    `<InkPill icon={icon} label="Share" />`,
    `<TextField id="name" label="Name" value={v} onChange={set} />`,
    `<Popover id="share" trigger={(t) => <InkPill {...t} />}>…</Popover>`,
    // A page's own layout classes, text styles and surfaces.
    `<div className="manage__buttons manage__actions">…</div>`,
    `<p className="field-hint">Optional words</p>`,
    `<span className="figures stage__version">version 3</span>`,
    `<section className="widget widget--ink play__stage">…</section>`,
    `<main className={\`mine\${busy ? " mine--busy" : ""}\`}>…</main>`,
    // Plain links stay plain links.
    `<Link href="/games" className="ws__all">Your games</Link>`,
    `<a href="mailto:hello@typeplay.app">hello@typeplay.app</a>`,
    // A class that only starts like a piece's.
    `<div className="buttons-row app-grid fieldset-note">…</div>`,
  ],
  invalid: [
    { code: `<button type="button" onClick={go}>Save</button>`, errors: [err("element")] },
    { code: `<input value={v} onChange={set} />`, errors: [err("element")] },
    { code: `<textarea value={v} />`, errors: [err("element")] },
    { code: `<select value={v}><option>1</option></select>`, errors: [err("element")] },
    { code: `<dialog open>…</dialog>`, errors: [err("element")] },
    { code: `<label htmlFor="x">Name</label>`, errors: [err("element")] },
    { code: `<fieldset><legend>Pick</legend></fieldset>`, errors: [err("element")] },
    { code: `<motion.button onClick={go}>Open</motion.button>`, errors: [err("element")] },
    { code: `<div popover="auto" id="menu">…</div>`, errors: [err("popover")] },
    { code: `<Pressable popoverTarget="menu">More</Pressable>`, errors: [err("popover")] },
    // A copy of a piece's look on a plain element or a Link.
    { code: `<Link href="/create" className="button">Make a game</Link>`, errors: [err("owned")] },
    { code: `<a className="button button--quiet button--small" href="/x">Open</a>`, errors: [err("owned"), err("owned"), err("owned")] },
    { code: `<span className={\`inkpill\${small ? " inkpill--small" : ""}\`}>Close</span>`, errors: [err("owned"), err("owned")] },
    { code: `<p className={error ? "error-line" : "field-hint"}>{text}</p>`, errors: [err("owned")] },
    { code: `<div className={cx("panel", wide && "closed__who")}>…</div>`, errors: [err("owned")] },
    { code: `<div className="widget card acct__me">…</div>`, errors: [err("owned")] },
    { code: `<main className="widget make" data-app>…</main>`, errors: [err("owned")] },
    { code: `<li className="app mine__ghost"><span className="app__icon" /></li>`, errors: [err("owned"), err("owned")] },
    { code: `<div className="pop menu">…</div>`, errors: [err("owned"), err("owned")] },
    { code: `<Link className="link" href="/terms">Terms</Link>`, errors: [err("owned")] },
  ],
});
console.log("eslint/ui-only: all cases pass");
