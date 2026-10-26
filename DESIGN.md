---
name: TypePlay
description: A phone home screen on a flat dusk-desert wallpaper, drawn the way the product's own 2D games are drawn.
colors:
  hot: "#ff5a36"
  hot-deep: "#e0431f"
  hot-hover: "#e84a26"
  sun: "#ffb347"
  sky-1: "#1c1240"
  sky-2: "#2a1858"
  sky-3: "#3d206b"
  sky-4: "#572877"
  sky-5: "#6a2c7a"
  dune-1: "#a63e68"
  dune-2: "#d9645a"
  sand: "#f3a35c"
  ink: "#170d33"
  ink-2: "#251948"
  paper: "#ffffff"
  field: "#f1ecfa"
  on-paper: "#170d33"
  on-paper-muted: "#53476f"
  on-sky: "#ffffff"
  on-sky-muted: "rgba(255, 255, 255, 0.78)"
typography:
  display:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "clamp(56px, 6.2vw, 88px)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "clamp(36px, 4.6vw, 64px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.025em"
  price:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.04em"
  wordmark:
    fontFamily: "Gabarito, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.02em"
  lead:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "clamp(17px, 1.4vw, 20px)"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  read:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.2
  button:
    fontFamily: "Onest, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
  figures:
    fontFamily: "Martian Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
rounded:
  icon: "25%"
  widget: "40px"
  dock: "34px"
  field: "20px"
  button: "15px"
spacing:
  gutter: "clamp(16px, 4vw, 80px)"
  section: "clamp(56px, 8vw, 120px)"
  gap: "18px"
  stack: "10px"
components:
  button-primary:
    backgroundColor: "{colors.hot}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "17px 22px"
  button-primary-hover:
    backgroundColor: "{colors.hot-hover}"
  button-primary-disabled:
    backgroundColor: "#cfc6e2"
    textColor: "#5a4f78"
  button-quiet:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "17px 22px"
  button-quiet-hover:
    backgroundColor: "#e6dff5"
  button-on-hot:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.button}"
    rounded: "{rounded.button}"
    padding: "17px 22px"
  pill:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "999px"
    padding: "9px 18px"
  widget:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.on-paper}"
    rounded: "{rounded.widget}"
  widget-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-sky}"
    rounded: "{rounded.widget}"
  statusbar:
    textColor: "{colors.on-sky}"
    height: "64px"
    padding: "0 clamp(16px, 4vw, 56px)"
  app-icon:
    backgroundColor: "{colors.ink-2}"
    rounded: "{rounded.icon}"
    size: "112px"
  notice:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "24px"
    padding: "12px 16px 12px 12px"
    width: "min(452px, calc(100% - 32px))"
  dock:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-sky}"
    rounded: "{rounded.dock}"
    padding: "14px 18px 14px 28px"
    width: "min(880px, calc(100% - 32px))"
  slot:
    backgroundColor: "{colors.ink-2}"
    textColor: "{colors.on-sky}"
    typography: "{typography.label}"
    rounded: "22px"
    padding: "10px 12px"
  slot-live:
    backgroundColor: "{colors.hot}"
    textColor: "{colors.ink}"
  prompt-field:
    backgroundColor: "{colors.field}"
    textColor: "{colors.on-paper}"
    rounded: "{rounded.field}"
    padding: "8px 8px 8px 22px"
  bubble:
    backgroundColor: "{colors.hot}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "18px 18px 4px 18px"
    padding: "10px 14px"
  bubble-first:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "18px 18px 18px 4px"
    padding: "10px 14px"
  listing:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "28px"
    width: "min(420px, 82vw)"
  setting-row:
    textColor: "{colors.on-paper}"
    padding: "22px 28px"
  setting-icon:
    textColor: "{colors.paper}"
    rounded: "16px"
    size: "56px"
  plan:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.on-paper}"
    rounded: "{rounded.widget}"
    padding: "32px 32px 28px"
  plan-lead:
    backgroundColor: "{colors.hot}"
    textColor: "{colors.ink}"
    rounded: "{rounded.widget}"
    padding: "32px 32px 28px"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.on-paper}"
    typography: "{typography.read}"
    rounded: "{rounded.widget}"
    padding: "clamp(28px, 5vw, 56px)"
    width: "min(760px, 100% - 2 * clamp(16px, 4vw, 80px))"
  launcher:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-sky}"
  launcher-frame:
    backgroundColor: "{colors.sky-2}"
    rounded: "24px"
    width: "min(1128px, 100%)"
  footer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-sky-muted}"
    rounded: "{rounded.dock}"
    padding: "28px 32px"
---

# Design System: TypePlay

Recorded from the built code in `apps/web/src/` (tokens and every component style in `app/globals.css`; fonts in `app/layout.tsx`; the drawn field in `components/Wallpaper.tsx` and `components/Ground.tsx`) on 2026-10-13, after the first implementation of the public pages (home, pricing, terms, privacy, refunds, create, 404). The frontmatter is normative; the prose says where and why.

## Overview

**Creative North Star: "The Home Screen"**

The public site is a phone home screen. Every page sits on one continuous dusk-desert wallpaper drawn flat, in bands of colour, exactly as the product's agent draws its 2D games, and the visitor's sentence becomes an app icon on that screen. Content lives in opaque white widgets and an ink dock laid over the sky, the way widgets sit on a wallpaper; the ground (sun and dunes) rises at the bottom of the home hero and again at the end of every page, under the footer. Hot orange is the one thing to press.

It refuses the category's dark centred hero with a glowing prompt box and a row of equal cards. The density is that of a tablet home screen: an 8-column icon grid at desktop width, four columns on tablets, names-only icons on phones. Nothing floats: there are no shadows, blurs, gradients or glass; depth is one flat surface over another. Copy is plain player language, and the only proof is real games, their real prompts and measured minutes.

**Key Characteristics:**
- One fixed wallpaper (five sky bands) under every page; the ground belongs to a section, never to the wallpaper, so reading text never crosses the sand.
- Two surfaces only: opaque paper widgets and ink bars (dock, footer, launcher).
- Hot orange (#ff5a36) is the single action colour, and text on it is always ink (#170d33).
- One corner-radius system: icons 25%, widgets 40px, dock 34px, fields 20px, buttons 15px.
- Gabarito 900 display, Onest for everything read or tapped, Martian Mono for measured figures; Phosphor icons.
- One motion grammar: the app-open zoom from icon to full game frame, the notification's single entrance, the "Your game" icon assembling on a 6-second clock; press feedback by scale; a reduced-motion fallback for each.

## Colors

A dusk desert drawn flat: five sky bands, two dunes and sand under everything; paper and ink surfaces on top; hot orange for the one action and sun amber for focus and the wordmark.

### Primary
- **Hot Orange** (`hot`, #ff5a36): the one action colour. It fills the "Make my game" button, the live "Web / now" dock slot, the visitor's chat bubbles, the lead (Medium) plan and the Smart model tile; it colours the accented word of a display headline ("Play it.", "build."), the text caret, the listing strip's scrollbar and `accent-color`.
- **Pressed Orange** (`hot-hover`, #e84a26): the primary button on hover, pointer devices only, and the hot ink pill's hover (the Android pill while a build runs). Ink words on it keep 4.76:1 (2026-10-26; it was `hot-deep` at 4.37:1, under the 4.5:1 text needs).
- **Deep Orange** (`hot-deep`, #e0431f): the device menu's check mark only (an icon: 4.21:1 on paper, 3.63:1 on Field). Never behind words.

### Secondary
- **Sun Amber** (`sun`, #ffb347): the drawn sun, the second word of the wordmark ("Play"), every focus ring (3px outline at 3px offset with an ink ring inside it; see Buttons, Focus), footer link hover, the "ready" label under the assembling icon, and the text selection highlight (ink on amber). Otherwise never a fill behind text.

### Tertiary
The wallpaper and the ground, used only inside the `Wallpaper`, `Ground` and `BuildingIcon` drawings, plus two surface uses: `sky-2` backs the launcher frame and the assembling icon, `sky-4` fills the Best model tile.
- **Night Sky** (`sky-1`, #1c1240): the top band and the `html` background behind everything.
- **Dusk Sky 2** (`sky-2`, #2a1858): the second band; the launcher frame and the assembling icon's backdrop.
- **Dusk Sky 3, 4, 5** (`sky-3` #3d206b, `sky-4` #572877, `sky-5` #6a2c7a): the lower bands. The wallpaper SVG paints them with literal hex equal to the tokens; keep the two in step.
- **Far Dune** (`dune-1`, #a63e68), **Near Dune** (`dune-2`, #d9645a), **Sand** (`sand`, #f3a35c): the three ground layers, back to front.

### Neutral
- **Ink** (`ink`, #170d33): the dock, footer, launcher and the ship widget; text on paper and on hot orange.
- **Ink Recess** (`ink-2`, #251948): a recessed area on ink: dock slots, the launcher's Home pill, the backing behind an app icon's picture.
- **Paper** (`paper`, #ffffff): widgets, the notice, listings, plans, legal sheets, the Sign in pill.
- **Field** (`field`, #f1ecfa): a recessed area on paper: the prompt field, the first chat bubble, the quiet button, the saved-sentence box, and the 1px divider between settings rows.
- **On Paper** (`on-paper`, #170d33) and **On Paper Muted** (`on-paper-muted`, #53476f): text on paper; muted for hints, quoted prompts, descriptions and figures.
- **On Sky** (`on-sky`, #ffffff) and **On Sky Muted** (`on-sky-muted`, rgba(255, 255, 255, 0.78)): text on the wallpaper and on ink; muted for nav links at rest, section leads, figures and footer text.

Literal colours in the build that are not tokens: the disabled button (#cfc6e2 with #5a4f78 text), the quiet button's hover (#e6dff5), legal body text (#2b2147), the Fast model tile (#2f9e44), the sun's halo (#ff8a4a at 35%), the robot in the assembling icon (#8fd3ff), and the wallpaper's clouds and stars (white at 12% and 70%).

### Named Rules
**The Ink-on-Hot Rule.** Text on hot orange is always ink: white on #ff5a36 is 3.1:1, ink is 5.9:1. The lead plan's button therefore inverts to ink with white text rather than putting orange on orange.
**The One Action Rule.** Hot orange marks what to press, plus the one accented word of a display headline. It is never a band, a border or a background for reading text.
**The Sun Rule.** Sun amber is for focus rings, the wordmark and the drawn sun; it never fills a button.

## Typography

**Display Font:** Gabarito (with system-ui, sans-serif), loaded through `next/font` as `--font-gabarito`, Latin subset, mapped to `--font-display`.
**Body Font:** Onest (with system-ui, sans-serif), `--font-onest` mapped to `--font-ui`.
**Label/Mono Font:** Martian Mono (with ui-monospace, monospace), `--font-martian` mapped to `--font-figures`, for figures only.

**Character:** A heavy, tightly set geometric display at 900 that reads like an app's name, over a plain, friendly UI face at 400 to 700. Measured facts (model tier, minutes, versions, dates) are set in a small mono so they look measured.

### Hierarchy
- **Display** (Gabarito 900, clamp(56px, 6.2vw, 88px) in the home widget, clamp(48px, 7vw, 96px) on the pricing page, line-height 0.9, -0.035em, `text-wrap: balance`): one per page. The last word or phrase sits in an `<em>` that turns hot orange, never italic.
- **Headline** (Gabarito 800, clamp(36px, 4.6vw, 64px), line-height 1, -0.025em): section headings on the sky; legal sheet and create titles at clamp(36px, 5vw, 56px).
- **Title** (Gabarito 800, 24px): legal sub-headings and plan names; 20px in the launcher bar. Below that, titles inside paper widgets switch to Onest 700: 19px model names, 17px listing names and FAQ questions.
- **Price** (Gabarito 900, 56px, -0.04em) with its period in Onest 600 15px, 6px to the right.
- **Lead** (Onest 400, clamp(17px, 1.4vw, 20px), line-height 1.5, On Sky Muted, max 60ch): the sentence under a section headline.
- **Body** (Onest 400, 15px, line-height 1.4 to 1.5, On Paper Muted inside widgets): descriptions, quoted prompts, bubbles (1.35), FAQ answers; 17px/1.5 in the ship and CTA widgets and in the textarea.
- **Read** (Onest 400, 16px, line-height 1.6, #2b2147, max 68ch): legal sheet paragraphs and lists, under an 18px/1.55 intro at 62ch.
- **Label** (Onest 600, 15px): widget labels, the notice title, the dock caption, slot names, the Sign in pill; app names at 14px (12px under 640px); nav links at 500/15px; buttons at 700/17px with line-height 1.
- **Figures** (Martian Mono 400, 11px, -0.02em, tabular numerals): "Smart · 1.6 min" under icons and on listings, slot availability, the notice's tier, the settings numbers; 12px for the sheet's "Updated" line and the launcher's info; 10px under a bubble.
- **Wordmark** (Gabarito 900, 24px, -0.02em; 18px in the footer): "Type" in white, "Play" in Sun Amber.

### Named Rules
**The Three Voices Rule.** Gabarito only for headlines, titles, prices and the wordmark; Onest for everything read or tapped; Martian Mono only for measured figures. No fourth face, no italics.
**The No Eyebrow Rule.** Nothing sits above a headline: no kicker, no small-caps label, no section number.

## Layout

The page is a stack of sections over one fixed wallpaper (`position: fixed; inset: 0; z-index: -1`: an SVG of five sky bands at 1440x900, sliced to cover). The ground (sun and dunes) is a second SVG that belongs to a section: it fills the bottom 46% of the home hero (230px on phones), and a "ground band" wraps the footer at the end of every page (margin-top clamp(56px, 8vw, 120px), padding-top 150px, 110px on phones; the footer's ground has no sun).

**Container.** Grids, sections and the footer are `min(1280px, 100% - 2 * clamp(16px, 4vw, 80px))`, centred. Narrower sheets: legal 760px, create and 404 680px, the dock 880px, the notice 452px, the launcher frame and info 1128px. The status bar is 64px tall with clamp(16px, 4vw, 56px) side padding.

**Home screen grid.** Above 1100px: 8 equal columns, rows minmax(168px, auto), 18px below the notice; app icons 112px (`--icon`); the white widget spans columns 3 to 6 and rows 1 to 2 with 4px 14px 16px margins and 28px 36px 26px padding; the "Your game" slot opens row 3 in column 1; the dock is pushed to the bottom (`margin: auto auto 34px`), and the hero is at least `100dvh - 64px` tall.
- 1100px and below: 4 columns, rows 160px, icons 96px, the widget spans all four columns at 28px padding.
- 900px and below: the dock stacks (caption over a 2x2 slot grid), the chat widget stacks with the result on top, the plans stack with the lead plan first, the ship widget stacks.
- 700px and below: the launcher's info row stacks.
- 640px and below: icons clamp(60px, 18vw, 76px), rows 136px, the widget spans three rows at 24px 20px 20px padding and a 32px radius; icon names drop to 12px and the figures under them are hidden (a phone home screen shows names only; the figures live in the launcher and the listings); the nav keeps only Pricing and Sign in; the prompt field stacks with a full-width button and a 92px textarea; settings rows go to two columns with the figures under the text.
- Short desktop viewports (at least 1101px wide and at most 960px tall, such as 1440x900): icons 104px, rows 156px, tighter widget padding (24px 32px 22px) and gap, the headline capped at 80px, notice and dock margins reduced, so the dock stays inside the first screen.

**Sections.** Each later section is `padding-top: clamp(56px, 8vw, 120px)`, a headline, a lead (36px below), then one widget. Widget padding by kind: 32px (chat thread, plans), 36px 40px (ship, CTA), 22px 28px (settings rows), 24px 26px (FAQ), 16px 20px 18px (listing body). Recurring gaps: 18px between sibling widgets, listings and settings columns; 10px inside stacks (form, bubbles, slot lists, plan features). There is no spacing token scale in the code; the four `spacing` entries in the frontmatter name the recurring literals.

**Hover.** Hover styles exist only under `(hover: hover) and (pointer: fine)`; touch gets press feedback instead.

**Stacking.** Wallpaper -1, ground 0, footer 1, home grid 2, dock 3, notice 6, launcher 50, a game played full screen 60 (inside the launcher).

### Named Rules
**The One Field Rule.** The sky is fixed and shared by every page; the ground is owned by a section. Never put the dunes in the wallpaper, and never let reading text scroll over the sand.

## Elevation & Depth

Flat by construction. There is no shadow, `filter`, `backdrop-filter` or gradient anywhere in the stylesheet (the one `box-shadow` is the focus ring's ink ring: a hard spread, no blur, a line rather than depth); the wallpaper is hard-edged bands. Depth is conveyed by overlap and by two surface tones: paper widgets lie on the sky, the ink dock lies on the dunes, the notice lies over the grid, and the launcher covers everything with opaque ink. Within a surface, a recessed area is one step toward the sky: Field (#f1ecfa) on paper, Ink Recess (#251948) on ink. The only line in the system is the 1px Field divider between settings rows.

### Named Rules
**The Overlap Rule.** Depth is one flat surface over another. No shadow, blur, glass or gradient, including on hover.
**The Two Surfaces Rule.** Everything sits on paper or on ink. Recessed areas are Field on paper and Ink Recess on ink; there is no third surface tone.

## Shapes

Rounded-square app geometry. Five radius tokens: icons 25% of their size (28px at 112px), widgets 40px (32px on phones), the dock and footer 34px, fields 20px, buttons 15px. Pills (Sign in, the launcher's Home button) are fully round (999px). Further literal radii in the build follow the same soft family but are not tokens: the notice 24px with a 12px thumbnail, the launcher frame 24px, listings 28px, dock slots 22px, settings icon tiles 16px, chat bubbles 18px with a 4px tail corner, the focus outline 6px. No borders: shape comes from fill against the wallpaper. Illustration is flat: rect bands, circles for the sun and stars, cubic-bezier dune curves, rounded rects for clouds; the robot in the assembling icon is built from rects.

### Named Rules
**The Five Radii Rule.** A new surface takes one of the five tokens: icon, widget, dock, field or button. A pill is the only exception.

## Components

Every piece exists once, as a React component in `apps/web/src/components/ui/` (Luka, 2026-10-24: a fix made in one copy of a piece never reached the others): `Button` and `ButtonLink`, `InkPill`, `TextButton`, `IconButton`, `Chip`, `Pressable`, `TextField`, `TextArea` and `Select`, `Checkbox`, `Toggle`, `Segmented`, `ChoiceRows`, `Popover` and `Menu`, `Dialog`, `Tabs` and `PillChoice`, `SearchField`, `PlayCount`, `Card`, `Panel`, `Ask`, `Strip`, `Callout`, `ErrorLine`, `PageWidget`, `AppIcon`, `GameCard`, `Avatar`, `ModelTile`, `Wordmark`. Each carries all its states (hover for a pointer only, the amber focus ring, the press scale, disabled, and busy: `aria-busy`, ignoring presses but keeping the keyboard focus; a busy button keeps its colour and its words say what it is doing, "Saving…") and its keyboard and screen-reader behaviour; its look is one block of plain classes under its name in `globals.css` (the public pieces) or `components/app/app.css` (the app's), with no Tailwind utility in the markup. Pages and feature components compose the pieces and add only layout classes of their own: the lint rule `typeplay/ui-only` (`apps/web/eslint/ui-only.mjs`, part of `npm run check`) fails a raw `<button>`, `<input>`, `<textarea>`, `<select>`, `<dialog>`, `<label>` or `<fieldset>`, a `popover` attribute, or a piece's class anywhere else. A piece that is missing, or a new look of one, is added to `components/ui` first. Icons are Phosphor (`@phosphor-icons/react`), inline SVG in `currentColor`, at three weights by role: regular at 36px in dock slots, fill at 28px on the model tiles, bold at 18px for inline marks (plan checks, the launcher's arrow).

### Status bar (`.statusbar`)
The phone's status bar as the nav: 64px tall, wordmark left, links right (500/15px, On Sky Muted, white on hover): **How it works**, **Games** (the gallery, `/explore`; the home page's games in the public build) and **Pricing**, the same on every page, public and app (Luka, 2026-10-27), ending in the white **Sign in** pill (paper with ink text, 9px 18px, fully round, scales to 0.97 on press). On phones only Games and Pricing (`.statusbar__keep`) and the pill remain; Pricing goes under 380px, and under 300px the gaps and the pill's sides narrow so Sign in stays on one line. Signed in, the bar never outgrows the screen (2026-10-27): on phones Pricing gives way first (it is in the account menu and the footer), then the word "credits" under 420px (and on 641-680px tablets; screen readers keep it), then the number too under 340px (the account menu shows it); Games always stays. `scripts/shot-header.mjs` checks it at 280-430px with 20, 1,299.1 and 12,345.6 credits. No time, battery or "9:41": platform-neutral.

### Widget (`.widget`, `.widget--ink`)
The content surface: paper with On Paper text, 40px radius, no border or shadow. `--ink` inverts to ink with white text (the ship widget). Page-specific widgets set their own padding (see Layout). The chat widget is a two-column grid (5fr paper thread, 7fr ink result) with `overflow: hidden`; the settings widget is a list of rows; the CTA widget wraps its headline and two buttons.

### Buttons (`.button`, `.button--quiet`, `.pill`)
- **Shape:** 15px radius, 17px 22px padding, Onest 700 17px, line-height 1, no border, `white-space: nowrap`.
- **Primary:** hot orange with ink text; hover (pointer only) Pressed Orange; press scales to 0.97 over 160ms ease-out; disabled is #cfc6e2 with #5a4f78 text and `cursor: not-allowed`.
- **Quiet:** Field with ink text; hover #e6dff5. Always beside a primary (See pricing, See the games, the Free and Studio plan buttons).
- **On hot orange** (the lead plan): the primary inverts to ink with white text.
- **Focus:** the global ring, two-tone (2026-10-26): a 3px Sun Amber outline at 3px offset (`--focus-ring`) with a 3px ink ring filling the gap inside it (`--focus-inner`, a box-shadow spread). Amber alone is 1.78:1 on paper and 1.74:1 on the hot lead plan, under the 3:1 WCAG 2.1 asks of a focus ring; the ink is 18.4:1 on paper and 5.93:1 on hot, and the amber keeps 9.75:1 on the darkest sky (5.23:1 on the lightest band) and 10.3:1 on ink. One darker amber can't pass on both (#c27300: 3.65:1 on paper, 2.55:1 on the sky). Every ring uses the two tokens at a 3px offset: the global `:focus-visible`, the Field box (focus-within; the input inside it takes neither), the model rows and the segmented control (raised over their neighbours while focused), and the game cards. The Android Build heading (the keyboard lands there after setup) stands its ring 3px off its words: padding taken back by its margin.

### App icon (`.app`, `.app__icon`, `.app__name`, `.app__stat`)
A game as an app: a `--icon`-sized rounded square (25% radius, Ink Recess backing, picture at cover) over a 600/14px name and a figures line ("Smart · 1.6 min", or a custom stat such as "+8 edits by chat"). The whole thing is a button labelled "Open {name}"; the picture scales to 0.95 on press. Tapping opens the launcher: the icon's Motion `layoutId` (`game-{slug}`) zooms into the launcher frame over 320ms ease-out.

### Building icon (`.build`)
The empty "Your game" slot: an app icon whose picture assembles from four flat SVG layers (sky, dunes, sun, robot) on a 6-second clock (each layer pastes in from 12% below over the `paste` keyframes, staggered 0.9s), while the label swaps from "building…" to "ready" (Sun Amber) between 62% and 80% of the same clock. Under reduced motion the layers stand assembled and the label stays "building…". It links to `#prompt`.

### Notice (`.notice`)
The notification: a 452px paper strip at 24px radius, 12px 16px 12px 12px padding, a 44px thumbnail at 12px radius, title 600/15px, a 13px muted sub-line, the tier in figures top-right. It drops in once on load (opacity 0 and y -28 to rest, 400ms ease-out after a 500ms delay; skipped under reduced motion), sits at z-index 6, and is a button that opens the game; press scales to 0.98.

### Dock and slots (`.dock`, `.dock__cap`, `.slot`, `.slot--live`)
The platform dock: an 880px ink bar at 34px radius, 14px 18px 14px 28px padding, a 150px caption ("One game. / Every screen.", 600/15px) and four equal slots. A slot is Ink Recess at 22px radius, 10px 12px padding, a 36px regular Phosphor icon, the name 600/15px and the availability in figures ("now", "at launch", "after launch"). The one live slot (Web) is hot orange with ink text. Below 900px the dock stacks and the slots form a 2x2 grid; the same `PlatformSlots` sit inside the ship widget as a 2x2 grid.

### Listing (`.strip`, `.listing`)
A game as a store listing in a horizontal snap strip (18px gaps, a thin hot-orange scrollbar): a paper card 420px wide (82vw on phones) at 28px radius, a 1128:556 screenshot, then the name 700/17px with figures right-aligned, and the prompt as a quoted `<q>` in 15px muted. It is a button; press scales to 0.98.

### Settings row (`.settings`, `.setting`; the tile is `ModelTile`, `.aitile`)
The model picker as a settings list: rows of a 56px tile, text and figures (22px 28px padding, 18px gap, a 1px Field divider between rows). The tile is 16px radius with a white 28px fill-weight Phosphor icon on a solid colour (Fast #2f9e44, Smart hot orange, Best `sky-4`); the name is Onest 700 19px, the description 15px muted at 62ch, the figures right-aligned and nowrap. On phones the figures drop under the text.

### Bubbles (`.bubble`, `.bubble--first`)
Chat messages at 92% max width, 10px 14px padding, 15px/1.35. The visitor's edits are hot orange with ink text, right-aligned, 18px radius with a 4px bottom-right tail; the first message (the sentence that made the game) is Field, left-aligned, tail bottom-left. A 10px figures line below each notes the model and minutes.

### Sheet (`.sheet`)
The legal "notes" page: one 760px paper widget with clamp(28px, 5vw, 56px) padding, a headline-size title, a figures "Updated" line (12px muted), an 18px intro, 24px Gabarito sub-headings with 40px above, Read body text, disc lists.

### Plan (`.plans`, `.plans--big`, `.plan`, `.plan--lead`, `.plan__price`)
Free, Medium and High as three widgets in a 1fr 1.25fr 1fr grid with 18px gaps; Ultra and Ultra+ in a second row of two (`.plans--big`, 18px below). Each is a paper widget with 32px 32px 28px padding and a 20px vertical gap: a 24px title, the price line, a summary, a feature list with 18px bold Phosphor checks, and a button pinned to the bottom. The lead plan (Medium) is hot orange with all text in ink and an ink button with white text; it goes first when the grid stacks (one column under 900px). FAQ cards are paper widgets at 24px 26px in an auto-fit grid (320px minimum, so six answers make two rows of three).

### Launcher (`.launcher`)
A game opened full-screen: a fixed ink overlay at z-index 50 (`role="dialog"`), fading in over 240ms and out over 180ms. It is the game's page: nothing loads until Play. A top bar of three columns: an Ink Recess "Home" pill (bold 18px arrow), the game's name as a 20px title centred, and two Ink Recess pills, **Full screen** (bold arrows-out) and **New tab**; all pills are at least 44px tall. Under 600px it becomes an app bar: the pills show only their icons (44px circles; labels stay for screen readers) and the name sits beside the back arrow, truncating with an ellipsis. A stage holding the 1128:556 frame (24px radius, `sky-2` backdrop) that the icon zooms into, never taller than the screen under the bar (a landscape phone scrolls to the rest); below it the prompt as a quote (clamp(17px, 1.6vw, 22px)), a figures line ("Built on Smart in 1.6 min, then 8 edits by chat"), a 15px muted line on how to play ("Play with keys or touch. On a phone it opens full screen.") and a primary **Make my own** button that puts the sentence into the prompt box. On upright screens (aspect at most 1:1) the page stacks from the top instead of centring the frame. Full screen sits in the bar, outside the game, because games put their own buttons in the frame's corners (Fruit Match Night's Restart is bottom right). Escape closes (from inside the game too: `play.html` passes it up); focus returns to the icon that opened it; body scroll is locked while open.

### Prompt field (`.prompt`, `.prompt__field`)
The live prompt: a 600/15px label, then a Field box at 20px radius (8px 8px 8px 22px padding) holding a borderless auto-growing textarea (17px/1.35, 46px to 160px tall, hot caret, muted placeholder) with the primary button at the bottom right; focus-within draws the focus ring (ink inside amber, 3px offset). A 13px muted hint below doubles as the error line (`role="alert"`). On phones the field stacks and the button goes full width.

### Footer (`.footer`)
The dock again: an ink bar at 34px radius, 28px 32px padding, 14px muted text, the wordmark at 18px with a tagline, and legal links (white, Sun Amber on hover) that wrap.

### Motion grammar (all components)
One easing, `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-out`), in CSS and in Motion. State changes (colour, transform) take 160ms. Press feedback is a scale: 0.97 on buttons and pills, 0.95 on app icons, 0.98 on the notice and listings. Three authored moments on the pages: the app-open zoom (320ms, shared `layoutId`), the notice's single entrance, and the assembling icon's 6-second loop; plus one explanation inside a played game, the rotate hint's turning phone. Under `prefers-reduced-motion` the zoom becomes a fade, the notice appears in place, the icon stands assembled and the phone stands still. `--ease-in-out` (cubic-bezier(0.77, 0, 0.175, 1)) is used only for the turning phone, the one movement on screen rather than an entrance.

### Game frame (`.gameframe`)
A playable game inside the site: a 2:1 box on Sky 2 holding the game's poster, then an iframe to the games origin (`play.html?g=<slug>`) once it plays. `mode="click"` shows the pill **Play {name}** (hot orange, ink text, 999px radius) centred on the poster; `mode="auto"` loads at once and passes `auto=1`, which presses Space for the visitor until they take over. "Loading the game…" is an ink pill at the bottom while the engine starts; the poster hides when the frame reports ready. Used by the launcher (click) and the demo (auto).

**Immersive** (`[data-immersive]`, launcher only): on a touch device (`(hover: none) and (pointer: coarse)`) Play opens the game full screen; the bar's Full screen does the same anywhere, before or after Play. The frame itself goes full screen (the browser's Fullscreen API, so our controls sit over the iframe), then locks the screen to the game's `orientation` (Android); where there is no full screen (iPhone) it becomes a fixed ink layer at 100dvh with safe-area insets, scroll locked, and a history entry so Back closes it. The game fills the screen; a landscape game on an upright phone is letterboxed at 16:9 in the middle. Close is a translucent ink tab (ink at 60%) on the left edge halfway down, a 34x48 tab inside a 44x56 touch target, because the games keep score and timers along the top and their own buttons in the bottom corners; when a landscape game is letterboxed on an upright phone it moves to a 44px Ink Recess circle in the empty top band. Close, Escape, Android back and the browser's own exit all return to the launcher with the game still running in the frame; focus goes to the bar's Full screen. On desktop, entering full screen hands the keyboard to the game (`typeplay:focus`). The demo has no full screen: its frame is swapped every few seconds.

**Rotate hint** (`.rotate`): while the phone is held the other way from the game (and the lock did not turn it), an opaque ink layer over the game: a drawn white phone whose screen shows a tiny dusk-desert scene with a hot-orange robot, sideways, and a Sun Amber arrow; the phone turns to the game's way, holds, fades and starts over (3.2s, `--ease-in-out`). Under reduced motion it stands still with the arrow. Below it "Turn your phone sideways" (Gabarito 800, 24px) and an Ink Recess pill **Play upright**, which keeps the phone as it is and shows the game letterboxed. The hint leaves by itself when the orientation matches. The loading pill stays visible over it.

**Free badge** (`apps/games/play.html`, on the games origin; only builds whose `game.json` says `"badge": true`, i.e. made on the Free plan; reviewed by the skills 2026-10-20). While the engine loads: an Ink Recess pill (44px tall, 999px, 18px sides) 28px under the progress bar, "Made with" in the loader's system-ui 600 13px at On Sky Muted before the wordmark at 17px; the one link to typeplay.app (new tab), Ink Recess pill hover #33245f, press 0.97, the amber focus ring; it fades in (200ms) only after 700ms of loading. Over the game: a tab on the right edge halfway down, the mirror of the full-screen close tab on the left (the one place games leave free: HUD along the top, buttons along the bottom or in the bottom corners, title panels short of the sides). Vertical text read top to bottom, the flat side on the edge and pill ends inside (999px), ink at 80% with "Made with" at white 90% and the wordmark at 1.2em (11-12.5px type, 8-11px under 360px tall); 400ms after the game's first frame it slides out of the edge (translateX 100% to 0, 280ms `--ease-out`, opacity 200ms), and after 4s or the player's first tap or key "Made with" folds into the name (240ms, the words fading in 140ms) and the ink settles at 72%. It is quieter by length, not by transparency, so it reads on white and pastel games too. It never takes input (`pointer-events: none`, `aria-hidden`), so it sits over a game's own pixels without blocking them. Reduced motion: opacity only, the fold instant. The wordmark there is a logo: Gabarito Black cut to the letters of "TypePlay", inline (nothing is loaded from the site). A fourth authored moment, inside played games only.

### Demo (`.demo`)
The "say what to change" widget: paper chat on the left (5fr), ink stage on the right (7fr), stacking with the stage first under 900px. The visitor's lines are hot-orange bubbles typed character by character (22ms, a 2px caret), the agent's lines are field-coloured `.bubble--agent` with the measured minutes in figures. Each step swaps a real exported version of the game into the Game frame; the caption under the stage names the version and its tier and minutes. Starts once when 35% in view; **Play it again** (quiet button) reruns it; reduced motion skips the typing and shortens every wait.

### App screens (package 4; `components/app/app.css`, app builds only)
Operate mode in the same world: paper widgets and ink bars on the wallpaper, one hot action per view. **Status bar** (signed in): "My games", credits as a Martian Mono 14px number, and a 40px paper avatar circle (Google picture, or the first letter) that opens the **account menu**, a 300px paper popover pinned under the bar at the right (24px radius, enters by opacity and scale 0.97 over 160ms from the top right). **/create** (`.make`, a 760px widget): the idea in a Field box, **genre starters** as app icons inside the widget (Runner, Puzzle; Racer and Tower defence greyed "coming"), the **model rows** (`ChoiceRows`, `.choice`: 44px tile at the icon radius, name, one honest line, "about 1.7" in figures, a 22px radio dot that turns into an ink ring; locked rows on Free say "On paid plans"), then credits left and **Build my game** with its estimate beside it. **Game page** (`.ws`): the chat widget (420px) beside the ink stage, full height under the bar, no footer; under 960px two tabs (Chat / Play) in an ink pill bar with a hot dot for a new version. Chat bubbles as in the demo plus a figures line per answer ("Fast · 0.4 credits · version 2", "Didn't work, not charged"); the live answer has a pulsing 8px hot dot and its line fades in on each step. The **composer** is a Field box, the Fast / Smart / Best segmented control (Field track, paper thumb), Send (small hot button) or Stop (quiet), the model's line and the estimate under it. The **stage**: bar (name, version, Ink Recess pills), the building line, the frame at 16:9 or 9:16 (24px radius), the assembling icon at 132px while the first build runs (104px above the games to play meanwhile, hidden on a stage under 640px tall), and the **versions strip** (232px Ink Recess cards, "Playing now" in Sun Amber, Restore asks inline). **Ask first** and errors are inline: a Field panel with the plan's buttons; an error is ink 600 text after an 8px hot dot (no red). New literals: `.button--small` (12px 16px, 15px), the model row hover #f8f5fd, the Ink Recess pill hover #33245f, locked segment text #8a80a3.
Added 2026-10-18: **Effort** is a smaller segmented control (13px, 12px track, 10px thumb) under Fast / Smart / Best with a muted "Effort" label; the tip line explains whichever control was touched last. **Share** and **More** in the stage bar open paper popovers (`.pop`, the account menu's 24px radius and entrance, placed under their button and kept 12px inside the screen); Share holds an on/off switch (#8a80a3 track off, hot on, white thumb sliding 160ms), the link in a Field and Copy / Open (Share… where the phone has a share sheet). Destructive last steps (Delete game, Delete everything) use **`.button--ink`** (ink, white text: the lead plan's button) after an inline ask, never hot. **Manage** on /games is a paper list of settings-style rows (56px icon, name, figures, Rename / Download / Delete quiet buttons that move under the text on phones). **/account** is a two-column grid on the sky (cards left, the credit history right; one column under 900px): the balance in the price face (Gabarito 900, 56px), history rows of date over time in figures, what and game, and the amount right-aligned (+ bold). The **share page** `/play/<id>` is public, so it keeps the public nav, ground and footer: an ink stage widget with the name (Gabarito 800, 24-34px), "Made with TypePlay" in figures and the frame, beside (portrait) or above (landscape) a paper "Make your own game." widget; its link preview draws the start screen in an ink bezel on the flat dusk desert.
UX review 2026-10-18: **fingers get 44px** without changing the desktop's density: under `(pointer: coarse)` the small buttons and ink pills grow to 44px tall, the avatar to 44px, the segmented controls take 2px more padding and a transparent pseudo-element that reaches 44px, the share switch the same; the phone tab bar's tabs and back arrow are 44px with an Ink Recess press state. Popovers **leave faster than they arrive** (120 vs 160ms). The figures line under an answer is 11px (the figures size), since it carries the cost. The Play pill says just **"Play"** in a frame under 440px wide (every upright game, a landscape one on a phone; the name stays for screen readers and in the bar). On /create a balance below the picked AI's lowest cost **turns Build off and adds a hot Get credits**; with no games, /games keeps one hot button (the empty widget's). Waits are said as waits ("More in about 6 hours"), never as a clock time in UTC. The checkout's tick box is `color-scheme: light` on paper.
Added 2026-10-18 (Android export; `components/app/android/`, styles under "Android export" in `app.css`): the **Android pill** sits in the stage bar next to Share (an Ink Recess pill with the Phosphor robot; hot with ink text, `[data-on]`, while a build of the game runs, as the dock's live slot). **`/games/<id>/android`** (`.droid`) is laid out like the account page: the headline "Android.", a lead, a muted "Back to <game>" line under it (nothing above a headline), then paper cards in the same grid (`minmax(320px, 420px)` beside `1fr`): **Build**, **This app** and **Your signing key** in the narrow column, **Your builds** beside them, **Putting it on Google Play** across both; one column under 900px in the order build, builds, app, key, checklist. One hot action: "APK for your phone" (the AAB and every Download are quiet). After setup one line on the sky with the hot dot ("Android is set up…") and the keyboard on the Build heading. A **build row** is a grid of a format tag (figures in a Field pill for APK, ink for AAB), the state in 700 with the pulse while it runs (the state word alone is the live region), a figures line of version, build number, size, "Download it within N days" and the icon's source, and quiet small buttons ("Open the chat" instead of Build again after a game-code failure); what a row opens (the checks, the phone link, the log) is a **Field panel** across the row, the same recessed surface as the ask panel, whose quiet buttons are paper as the ask panel's. The **checks** are a bold Phosphor tick per line, or the hot dot with the sentence in 600 (no green, no red). The **phone link** panel opens by itself after a Download: the QR code (drawn in the page, ink on a 176px paper tile at the field radius) beside the link in a paper field, Copy link, the countdown in figures and the four install steps; under 640px the steps come first and the code and its caption are gone (a phone has nothing to scan with), and a link too long for a code (a storage link) shows as text alone. The **live state** is a Field panel with the pulse, the state in 600, the clock and the usual time in figures, and Stop. The **identity form** (setup and Change) uses Field inputs, the suggested package name read-only and muted in the figures face at 16px, link-style buttons for the alternatives, a 64px Ink Recess tile at the icon radius showing the PNG uploaded in this session, and the ask panel with an ink button (focused) for the package change after the first Play package; focus returns to Change when the form closes. The **key card** says in one breath that nothing has to be done with the key, then Download signing key; the recovery path and the **fingerprint** (figures at 12px in colon pairs, breaking only between groups of four) sit behind "If you lose it". The **Play checklist** is an ordered list with figures markers, 17px/700 `h3` step titles and muted 15px text, the real testers link in figures, the small segmented control for "when was your account made", and Show / Hide the steps (open on the first visit, remembered on the device). Between 960 and 1200px the stage bar's five pills keep their icons only, as under 600px. No new colours: the QR's rect and path take paper and ink from the tokens.
Added 2026-10-18 (the public gallery; `app/explore/`, styles under "The public gallery" in `app.css`): **/explore** is public like the share page (public nav, ground and footer): "Explore." with one lead line. The **top game** (the week's most played) sits on the share page's ink stage, which hugs its parts: an upright game's 9:16 frame, as tall as the first screen allows (sized in `svh`, so a phone's address bar doesn't resize it), beside its name (24-34px, a link to its page), the figures, Full screen and Share pills, the how-to line and the text button **Report this game**; beside the stage, the paper "Make your own game." widget, as on an upright share page, taking the rest of the row; the page ends on that widget too when there are listings (below 900px only there). A wide game's frame takes the stage's wide column with its words beside it above 1100px (under it below). The Play pill there says just "Play" (the name is beside it). **Listings** are paper cards at the listing's 28px radius (24px on phones) in an auto-fill grid (180px minimum, so six across at the page's full width; two columns on phones): the start screen at 3:4 on Ink Recess (an upright one covers it, a wide one is letterboxed whole, a missing or broken one is the drawn tile covering the box), a paper Play mark at the bottom left, the name in Onest 700 17px (15px on phones) cut at two lines, the figures in Martian Mono 11px muted across the card's width (the plays over the genre, each on its own line; the plays as the library below says), and in the picture's top corner a 36px translucent ink circle (the full-screen close tab's ink at 60%) with a white flag that reports it (44px under a coarse pointer). A figures line with dots (the top game's) breaks only between its parts. The link stretches over the card, so the whole card presses to 0.98 and takes the focus ring; the flag and the order's pills press to 0.97. **Show more games** is a quiet button, with "24 of 306" in figures beside it. The **report dialog** is a modal `<dialog>` in paper at the popovers' 24px radius, arriving and leaving as they do (opacity and scale 0.97, 160ms in, 120ms out; reduced motion keeps only the fade; the backdrop is ink at 60%): the model picker's radio rows without the tile (an unpicked dot is a 2px #8a80a3 ring on paper), a Field textarea, a hot Send that waits for a reason, then "Thanks for telling us." fading in. The **Share menu** gets a second switch under a Field line, **Show it in the gallery**, only while the game is shared; it reads off and is disabled when an admin took the game out. **Plays** read short past 999 (1.2K, 10M) and are figures wherever they show: beside the version in the stage bar, on their own line in the Share menu, under the icon on /games, in Manage, after "Made with TypePlay" on the share page. No new colours.
Added 2026-10-19 (beta 1, the closed beta and Send feedback; `components/app/ClosedBeta.tsx`, `Feedback.tsx`, styles under "Beta 1" in `app.css`; reviewed by the skills the same day): the **closed-beta page** is the signed-out widget's sibling (the 760px `.make` widget on the sky): "TypePlay is in a closed beta." (Gabarito 800), one muted lead in short sentences (only invited testers make games for now, they help fix problems, it opens to everyone soon), then (2026-10-25, beta codes) **Have a beta code?**: a Field label over a 176px Field box that is the whole 54px Field (Onest 700 tabular digits at 0.18em; a 400 muted "6 digits" placeholder; the number keyboard) and the page's one hot action, **Join the beta**, beside it ("Checking…" while the API answers, still hot), the API's sentence under both as the hot-dot error line (ink 600; on phones between the box and the button, where the open keyboard leaves it seen); after a wrong code the box keeps its focus and the code, selected; after a right one the page gives way to the app with one focused 15px on-sky line above it, the Android notice's look: "You're in the beta. We added 50 credits." Then "No code yet?" (a Field label) over a quiet **Play the games** (the home page's games), then a Field panel with "You're signed in as" over the address (700, on a line of its own, breaking anywhere), "Invited with another address? Use that Google account." and two quiet buttons on paper, **Use another account** (the Phosphor Google mark; Google's account chooser) and Sign out; the idea saved in this browser follows as a 17px quote cut at three lines. Under 640px every button there takes the full width, one above the other, and a label too long for its line wraps inside it. It fades in over 160ms where the page was (opacity only, under reduced motion too); nothing moves. The status bar's account place then shows only the avatar's letter, and its menu "Signed in", the address, one muted line and Sign out. On phones (any account) the page behind the account menu dims to ink at 60%, as behind the report dialog (160ms in, 120ms out), because the paper menu otherwise merges with the paper widget under it. **Send feedback** is a link-style row at the end of the account menu's links and an item with the Phosphor chat bubble in the game page's More menu (before Delete). Its dialog wears the report dialog's box at 480px: two Field text boxes, three and two lines tall from the first open and growing to 240 and 160px (160 and 160 on phones), placeholders that start "For example:", a figures counter from 3,600 letters ("214 letters left", "1 letter left") that becomes a 13px muted sentence at the limit, on a game's page the checkout's tick box ("Attach this game, so we can play the version you see.", the game's name under it in 13px 600 muted, cut at two lines), a 13px muted line on what is kept, a hot Send that waits for words (off again after the day's 10) and a quiet Cancel; on phones the two buttons stick to the dialog's foot on paper while the form scrolls. The thanks fades in where the form was and says what we have. When it closes, the keyboard goes back to the avatar or the More button. No new colours.

Added 2026-10-25 (Luka's UX batches 1-4; `components/app/ChatLog.tsx`, `WhileYouWait.tsx`, `components/ui/Toggle.tsx`; reviewed by the skills the same day): **ideas for the next change** sit under the newest answer on the player's side, a muted "Ideas for your next change" label over Field pills (the idea pill, 44px under touch), arriving 40ms apart; three show, and a fourth pill of the same look with a plus, **More ideas**, adds the other six under them (the first three stay put) and goes. **Play one while you wait** (a first build): three cards in one row, since 2026-10-27 the gallery's own card (Luka: the same as Explore's, up to its 240px on a computer, 175px before), each the game's start screen at 3:4 on Ink Recess, a wide one shown whole (it was cropped to its middle, "ROOFTOP N"), a paper Play chip on it and the name under it in 17px/700, two lines at most; under 150px wide (phones, where the stage's sides narrow to 8px: ~103px at 390, ~80px at 320) the card itself takes 13px names that break between words and a smaller chip (a container query); no kind line; touch gets the press scale, hover nothing; the empty cards fade while the gallery answers. **The switch** is one component (`ui/Toggle.tsx`), named by the text beside it: saving dims it and keeps the keyboard (`aria-busy`); locked (taken out of the gallery) it keeps full contrast with a not-allowed cursor, the sentence beside it saying why.

Added 2026-10-25 (the platform choice; `components/app/PlatformSwitch.tsx`, `Stage.tsx`, styles `.made`, `.stage__live` and `.fithint` in `app.css`; reviewed by the skills the same day): **Made for** on /create sits between the genre starters and Choose the AI: the Fast / Smart / Best segmented control's look (Field track, paper thumb, 14px 600) with a bold 16px Phosphor icon per segment, **Best fit / Phone / Computer / Any screen** (MagicWand, DeviceMobile, Laptop, Devices; not "Every screen", which the home page says of every game), Best fit first and picked (Luka, 10-26: the agent picks the shape, the one setup measured to work on every device for the fewest credits; before, the device the game was made on), arrow keys as radios, and one muted 13px line under it for the picked one (each radio also carries its own line for screen readers); Any screen's line says what it was measured to cost and where it is weak. At 540px and below (where the four no longer fit in a row) they make two rows of two across the widget, each icon beside its name, each a finger tall. The line under it keeps the longest line's room, so a new pick never moves what is below it. A Best fit game says what the agent picked once its first build is done (`Project.platform`), so the preview, the hint and the rest follow it as for a picked shape. On the game page the device menu opens on the game's device (iPhone, Laptop, or Fill the window for a game that fills every screen); on a screen the game isn't made for (a computer-sized preview of a phone game; an upright phone, previewed or real, for a computer game; never a tablet, a phone held sideways for a wide game, or a narrow computer window) the stage's line above the game says **Made for phones.** (white 600 14px; the line is the live region) beside an Ink Recess small pill with the Phosphor chat bubble, **Ask to make it fit computers** (or phones), outside the live region, which adds "Make it fit computer screens too." to the chat's box without sending it (the ideas' join; on a phone it opens the Chat tab). While a build runs the line keeps the hint's room (36px, 44px under touch, 70px under 600px), so the frame doesn't jump; the hint rises in like the building line (220ms) and only fades under reduced motion. A game that fills every screen gets no turn-your-phone hint and no letterbox when it plays full screen (`data-orientation="any"`). The stage bar's pills drop their words whenever the bar is under 880px (a 1280-1366px laptop with the device pill and Turn), as between 960 and 1200px. No new colours.

Added 2026-10-26 (the build queue; `components/ui/Pulse.tsx` `still`, `components/ui/AppIcon.tsx` `waiting` and `landed`, `ChatLog.tsx`, `Stage.tsx`, `Composer.tsx`, `BuildPill.tsx`, `GameClient.tsx`'s announcer, styles `.pulse--still`, `.build--waiting`, `.build--landed` and `.stage__place`; words in `content/app.ts` `inLine`; reviewed by the skills the same day): when TypePlay is building as many games as it can, a build **waits for its turn** and the page says where it is. Nothing runs yet, so nothing breathes: the **waiting dot** is the pulse's 8px dot in the text's own colour at 45%, standing still (the hot breathing dot comes when the build starts), and a first build's tile shows **the sky and the ground** alone (the assembling icon's first two layers; the sky alone vanished into the wallpaper's bands of the same colours), standing still until its turn; then it starts with them landed, so nothing on the screen blinks, and only the sun and the robot paste in. The chat's answer reads "Waiting for its turn" in the agent bubble over the figures line "Fast · 2 builds ahead · about 6 min" ("1st in the queue" with none ahead). The first build's stage has the state in 700 19px, the place on its own figures line under it, the muted note ("Yours starts by itself, and nothing is charged while it waits. You can leave this page."; on Free also "Builds on paid plans go first.", since paid builds sent within 10 minutes go ahead of it) and the games to play meanwhile; a change's stage line over the game says "Version 2 is waiting for its turn: 2 builds ahead, about 30 min" with the waiting dot. When the rough wait runs past the moment the build would leave the line (`QueuePlace.leavesAt`), the note (or the composer's tip, for a change) says so: "The queue is long right now: if yours hasn't started by 14:32, it leaves the queue and nothing is charged." A wait of a minute or less says "any minute now"; past an hour it rounds to 5 minutes. The composer has Stop (quiet) and the tip says what it does; the build pill says "Your game is in the queue" with the place beside it (the words alone under 520px), the /games icon "in the queue" over the still sky and ground. A build that left the line without starting says "Didn't start, not charged" (not "Didn't work": it never ran), and a first build that never started says so on the stage. **One announcer** (an `sr-only` status line in the game page) reads out the place when the number ahead changes, the start ("It's your turn: building now.") and why a build left the line; the bubble and the stage lines are not live while it waits, so a screen reader hears each change once, not from both panels, and never the minutes. A place's parts never break inside ("37 builds ahead", "about 1 h 35 min": non-breaking spaces) and the dot keeps to the part before it, so a narrow line breaks after a dot, never before one. No new colours, no new motion.
Added 2026-10-27 (the gallery as a library, Luka: "a real library"; `app/explore/ExploreClient.tsx` `Library`, `components/ui/PillBar.tsx` `PillChoice`, `components/ui/SearchField.tsx`, `components/ui/PlayCount.tsx`, styles under "The public gallery" in `app.css`): under the top game, **"Every game."** (Gabarito 800, 24-34px) with the count in muted 13px figures beside it ("6 games"; "1 of 6 games" while a genre or a search narrows it) and, at the row's end, the **search box on the sky** (`SearchField`: the pill bar's ink, fully round, 52px, a bold 18px magnifying glass and the placeholder "Search games" in On Sky Muted, white 17px words, the hot caret, the amber ring while the keyboard is in it, the ghost IconButton's X once there are words; up to 360px, its own full-width row under 640px). Under them, the two choices kept apart on one row: at its start the **genres** that have games, "Any genre" first ("All genres" read as part of the order's "All"), as pill bar pills **apart** (`pillbar--apart`: each pill ink on the sky, 8px apart, wrapping; under 640px one row that scrolls sideways to the screen's edges, the last pill cut at the edge); at its end the **order** as the ink pill bar, now a choice of one in place (`PillChoice`: radios, the arrow keys move the choice): **Popular / New / All** (All: every game A to Z), the whole width under the genres on phones. The cards are the listings above, every game in the gallery, the top one too. A card's **plays** are `PlayCount`, on the first of the figures' two lines whether or not a genre follows (so they sit at one height across a row): a bold 12px outline Phosphor play mark and the number in figures ("12", "12.3K"), on one line, unlike the Play chip (no pill, no filled mark); the full words ("12 plays this week" on Popular, "12 plays" otherwise) are the tooltip and what a screen reader hears; none says nothing. A choice changes the cards in place: the ones there dim to 55% over 160ms until the next arrive (no other motion). No match is a paper widget (24px 28px): "No game names match “…”." in 600 17px and a quiet **Show every game**. No new colours.

## Do's and Don'ts

### Do:
- **Do** put every page on the fixed wallpaper and end it with the ground band and the ink footer; the home hero is the only other place the ground appears and the only place with a sun.
- **Do** put content in opaque paper widgets (40px) or ink bars (34px), and recess inside them with Field or Ink Recess.
- **Do** use hot orange for the one thing to press and set its text in ink (#170d33).
- **Do** use the five radii: icon 25%, widget 40px, dock 34px, field 20px, button 15px.
- **Do** set figures (tier, minutes, versions, dates) in Martian Mono 11px with tabular numerals, muted.
- **Do** gate hover behind `(hover: hover) and (pointer: fine)` and give touch a press scale instead.
- **Do** give every authored motion a reduced-motion fallback: a fade for the zoom, no entrance for the notice, a static assembled icon.
- **Do** write plain player language (game, build, edit, version, credits, Fast / Smart / Best, export) and prove with real games, real prompts and measured minutes.

### Don't:
- **Don't** add shadows, blur, glass, gradients or borders; depth is overlap only.
- **Don't** put white text on hot orange (3.1:1); the lead plan's button inverts to ink for this reason.
- **Don't** let text scroll over the sand: the ground belongs to a section, never to the wallpaper.
- **Don't** put an eyebrow, kicker or label above a headline, and don't use em-dashes anywhere in copy.
- **Don't** copy a phone's status bar literally: no time, battery or "9:41".
- **Don't** add a fourth typeface or italics, and don't set Gabarito below 20px except the footer wordmark (18px) and the Free badge's wordmark (a logo: 17px on the loader, 8-15px on the game); smaller titles are Onest 700.
- **Don't** add hover effects beyond a colour change; the three authored moments (and the rotate hint, which explains) are the whole motion budget.
- **Don't** use stock illustration or photography; pictures are flat SVG drawn in code (wallpaper, ground, assembling icon) or real game screenshots.
- **Don't** let the drawn SVGs (wallpaper, ground, building icon) drift from the colour tokens: they use literal hex, so a token change is also an SVG change.
