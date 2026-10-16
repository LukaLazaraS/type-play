---
name: TypePlay
description: A phone home screen on a flat dusk-desert wallpaper, drawn the way the product's own 2D games are drawn.
colors:
  hot: "#ff5a36"
  hot-deep: "#e0431f"
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
    backgroundColor: "{colors.hot-deep}"
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
- **Hot Orange** (`hot`, #ff5a36): the one action colour. It fills the "Make my game" button, the live "Web / now" dock slot, the visitor's chat bubbles, the lead (Maker) plan and the Smart model tile; it colours the accented word of a display headline ("Play it.", "build."), the text caret, the listing strip's scrollbar and `accent-color`.
- **Pressed Orange** (`hot-deep`, #e0431f): the primary button on hover, pointer devices only.

### Secondary
- **Sun Amber** (`sun`, #ffb347): the drawn sun, the second word of the wordmark ("Play"), every focus ring (3px outline at 3px offset), footer link hover, the "ready" label under the assembling icon, and the text selection highlight (ink on amber). Otherwise never a fill behind text.

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

Flat by construction. There is no `box-shadow`, `filter`, `backdrop-filter` or gradient anywhere in the stylesheet; the wallpaper is hard-edged bands. Depth is conveyed by overlap and by two surface tones: paper widgets lie on the sky, the ink dock lies on the dunes, the notice lies over the grid, and the launcher covers everything with opaque ink. Within a surface, a recessed area is one step toward the sky: Field (#f1ecfa) on paper, Ink Recess (#251948) on ink. The only line in the system is the 1px Field divider between settings rows.

### Named Rules
**The Overlap Rule.** Depth is one flat surface over another. No shadow, blur, glass or gradient, including on hover.
**The Two Surfaces Rule.** Everything sits on paper or on ink. Recessed areas are Field on paper and Ink Recess on ink; there is no third surface tone.

## Shapes

Rounded-square app geometry. Five radius tokens: icons 25% of their size (28px at 112px), widgets 40px (32px on phones), the dock and footer 34px, fields 20px, buttons 15px. Pills (Sign in, the launcher's Home button) are fully round (999px). Further literal radii in the build follow the same soft family but are not tokens: the notice 24px with a 12px thumbnail, the launcher frame 24px, listings 28px, dock slots 22px, settings icon tiles 16px, chat bubbles 18px with a 4px tail corner, the focus outline 6px. No borders: shape comes from fill against the wallpaper. Illustration is flat: rect bands, circles for the sun and stars, cubic-bezier dune curves, rounded rects for clouds; the robot in the assembling icon is built from rects.

### Named Rules
**The Five Radii Rule.** A new surface takes one of the five tokens: icon, widget, dock, field or button. A pill is the only exception.

## Components

Each component is a plain class in `globals.css`; there is no component library and no Tailwind utility in the markup. Icons are Phosphor (`@phosphor-icons/react`), inline SVG in `currentColor`, at three weights by role: regular at 36px in dock slots, fill at 28px on the model tiles, bold at 18px for inline marks (plan checks, the launcher's arrow).

### Status bar (`.statusbar`)
The phone's status bar as the nav: 64px tall, wordmark left, links right (500/15px, On Sky Muted, white on hover), ending in the white **Sign in** pill (paper with ink text, 9px 18px, fully round, scales to 0.97 on press). On phones only Pricing (`.statusbar__keep`) and the pill remain. No time, battery or "9:41": platform-neutral.

### Widget (`.widget`, `.widget--ink`)
The content surface: paper with On Paper text, 40px radius, no border or shadow. `--ink` inverts to ink with white text (the ship widget). Page-specific widgets set their own padding (see Layout). The chat widget is a two-column grid (5fr paper thread, 7fr ink result) with `overflow: hidden`; the settings widget is a list of rows; the CTA widget wraps its headline and two buttons.

### Buttons (`.button`, `.button--quiet`, `.pill`)
- **Shape:** 15px radius, 17px 22px padding, Onest 700 17px, line-height 1, no border, `white-space: nowrap`.
- **Primary:** hot orange with ink text; hover (pointer only) Pressed Orange; press scales to 0.97 over 160ms ease-out; disabled is #cfc6e2 with #5a4f78 text and `cursor: not-allowed`.
- **Quiet:** Field with ink text; hover #e6dff5. Always beside a primary (See pricing, See the games, the Free and Studio plan buttons).
- **On hot orange** (the lead plan): the primary inverts to ink with white text.
- **Focus:** the global ring, 3px Sun Amber outline at 3px offset.

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

### Settings row (`.settings`, `.setting`, `.setting__icon`)
The model picker as a settings list: rows of a 56px tile, text and figures (22px 28px padding, 18px gap, a 1px Field divider between rows). The tile is 16px radius with a white 28px fill-weight Phosphor icon on a solid colour (Fast #2f9e44, Smart hot orange, Best `sky-4`); the name is Onest 700 19px, the description 15px muted at 62ch, the figures right-aligned and nowrap. On phones the figures drop under the text.

### Bubbles (`.bubble`, `.bubble--first`)
Chat messages at 92% max width, 10px 14px padding, 15px/1.35. The visitor's edits are hot orange with ink text, right-aligned, 18px radius with a 4px bottom-right tail; the first message (the sentence that made the game) is Field, left-aligned, tail bottom-left. A 10px figures line below each notes the model and minutes.

### Sheet (`.sheet`)
The legal "notes" page: one 760px paper widget with clamp(28px, 5vw, 56px) padding, a headline-size title, a figures "Updated" line (12px muted), an 18px intro, 24px Gabarito sub-headings with 40px above, Read body text, disc lists.

### Plan (`.plans`, `.plan`, `.plan--lead`, `.plan__price`)
Three widgets in a 1fr 1.25fr 1fr grid with 18px gaps; each a paper widget with 32px 32px 28px padding and a 20px vertical gap: a 24px title, the price line, a summary, a feature list with 18px bold Phosphor checks, and a button pinned to the bottom. The lead plan (Maker) is hot orange with all text in ink and an ink button with white text; it goes first when the grid stacks. FAQ cards are paper widgets at 24px 26px in an auto-fit grid (280px minimum).

### Launcher (`.launcher`)
A game opened full-screen: a fixed ink overlay at z-index 50 (`role="dialog"`), fading in over 240ms and out over 180ms. It is the game's page: nothing loads until Play. A top bar of three columns: an Ink Recess "Home" pill (bold 18px arrow), the game's name as a 20px title centred, and two Ink Recess pills, **Full screen** (bold arrows-out) and **New tab**; all pills are at least 44px tall. Under 600px it becomes an app bar: the pills show only their icons (44px circles; labels stay for screen readers) and the name sits beside the back arrow, truncating with an ellipsis. A stage holding the 1128:556 frame (24px radius, `sky-2` backdrop) that the icon zooms into, never taller than the screen under the bar (a landscape phone scrolls to the rest); below it the prompt as a quote (clamp(17px, 1.6vw, 22px)), a figures line ("Built on Smart in 1.6 min, then 8 edits by chat"), a 15px muted line on how to play ("Play with keys or touch. On a phone it opens full screen.") and a primary **Make my own** button that puts the sentence into the prompt box. On upright screens (aspect at most 1:1) the page stacks from the top instead of centring the frame. Full screen sits in the bar, outside the game, because games put their own buttons in the frame's corners (Fruit Match Night's Restart is bottom right). Escape closes (from inside the game too: `play.html` passes it up); focus returns to the icon that opened it; body scroll is locked while open.

### Prompt field (`.prompt`, `.prompt__field`)
The live prompt: a 600/15px label, then a Field box at 20px radius (8px 8px 8px 22px padding) holding a borderless auto-growing textarea (17px/1.35, 46px to 160px tall, hot caret, muted placeholder) with the primary button at the bottom right; focus-within draws the Sun Amber ring at 2px offset. A 13px muted hint below doubles as the error line (`role="alert"`). On phones the field stacks and the button goes full width.

### Footer (`.footer`)
The dock again: an ink bar at 34px radius, 28px 32px padding, 14px muted text, the wordmark at 18px with a tagline, and legal links (white, Sun Amber on hover) that wrap.

### Motion grammar (all components)
One easing, `cubic-bezier(0.23, 1, 0.32, 1)` (`--ease-out`), in CSS and in Motion. State changes (colour, transform) take 160ms. Press feedback is a scale: 0.97 on buttons and pills, 0.95 on app icons, 0.98 on the notice and listings. Three authored moments on the pages: the app-open zoom (320ms, shared `layoutId`), the notice's single entrance, and the assembling icon's 6-second loop; plus one explanation inside a played game, the rotate hint's turning phone. Under `prefers-reduced-motion` the zoom becomes a fade, the notice appears in place, the icon stands assembled and the phone stands still. `--ease-in-out` (cubic-bezier(0.77, 0, 0.175, 1)) is used only for the turning phone, the one movement on screen rather than an entrance.

### Game frame (`.gameframe`)
A playable game inside the site: a 2:1 box on Sky 2 holding the game's poster, then an iframe to the games origin (`play.html?g=<slug>`) once it plays. `mode="click"` shows the pill **Play {name}** (hot orange, ink text, 999px radius) centred on the poster; `mode="auto"` loads at once and passes `auto=1`, which presses Space for the visitor until they take over. "Loading the game…" is an ink pill at the bottom while the engine starts; the poster hides when the frame reports ready. Used by the launcher (click) and the demo (auto).

**Immersive** (`[data-immersive]`, launcher only): on a touch device (`(hover: none) and (pointer: coarse)`) Play opens the game full screen; the bar's Full screen does the same anywhere, before or after Play. The frame itself goes full screen (the browser's Fullscreen API, so our controls sit over the iframe), then locks the screen to the game's `orientation` (Android); where there is no full screen (iPhone) it becomes a fixed ink layer at 100dvh with safe-area insets, scroll locked, and a history entry so Back closes it. The game fills the screen; a landscape game on an upright phone is letterboxed at 16:9 in the middle. Close is a translucent ink tab (ink at 60%) on the left edge halfway down, a 34x48 tab inside a 44x56 touch target, because the games keep score and timers along the top and their own buttons in the bottom corners; when a landscape game is letterboxed on an upright phone it moves to a 44px Ink Recess circle in the empty top band. Close, Escape, Android back and the browser's own exit all return to the launcher with the game still running in the frame; focus goes to the bar's Full screen. On desktop, entering full screen hands the keyboard to the game (`typeplay:focus`). The demo has no full screen: its frame is swapped every few seconds.

**Rotate hint** (`.rotate`): while the phone is held the other way from the game (and the lock did not turn it), an opaque ink layer over the game: a drawn white phone whose screen shows a tiny dusk-desert scene with a hot-orange robot, sideways, and a Sun Amber arrow; the phone turns to the game's way, holds, fades and starts over (3.2s, `--ease-in-out`). Under reduced motion it stands still with the arrow. Below it "Turn your phone sideways" (Gabarito 800, 24px) and an Ink Recess pill **Play upright**, which keeps the phone as it is and shows the game letterboxed. The hint leaves by itself when the orientation matches. The loading pill stays visible over it.

### Demo (`.demo`)
The "say what to change" widget: paper chat on the left (5fr), ink stage on the right (7fr), stacking with the stage first under 900px. The visitor's lines are hot-orange bubbles typed character by character (22ms, a 2px caret), the agent's lines are field-coloured `.bubble--agent` with the measured minutes in figures. Each step swaps a real exported version of the game into the Game frame; the caption under the stage names the version and its tier and minutes. Starts once when 35% in view; **Play it again** (quiet button) reruns it; reduced motion skips the typing and shortens every wait.

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
- **Don't** add a fourth typeface or italics, and don't set Gabarito below 20px except the footer wordmark (18px); smaller titles are Onest 700.
- **Don't** add hover effects beyond a colour change; the three authored moments (and the rotate hint, which explains) are the whole motion budget.
- **Don't** use stock illustration or photography; pictures are flat SVG drawn in code (wallpaper, ground, assembling icon) or real game screenshots.
- **Don't** let the drawn SVGs (wallpaper, ground, building icon) drift from the colour tokens: they use literal hex, so a token change is also an SVG change.
