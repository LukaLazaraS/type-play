import { credits, plans, site } from "./site";

export type Section = { heading: string; paragraphs: string[]; list?: string[] };
export type LegalDoc = { title: string; intro: string; sections: Section[] };

const operator = [site.seller.name, site.seller.form].filter(Boolean).join(", ");
// How to reach us: the email, plus the support phone once it is set in site.ts.
const contact = site.phone ? `${site.email} or ${site.phone}` : site.email;

export const terms: LegalDoc = {
  title: "Terms of service",
  intro: `These terms are the agreement between you and TypePlay ("we", "us") for the use of ${site.domain}, ${site.gamesDomain} and the TypePlay service. By creating an account you accept them.`,
  sections: [
    {
      heading: "What TypePlay is",
      paragraphs: [
        "TypePlay turns a written description into a playable game. An AI agent builds the game in the Godot engine, you play it in your browser, you change it by chatting, and you can export it to other platforms as those exports become available.",
        "TypePlay is in beta. Features, limits and prices can change, and some builds fail or come out differently from what you asked. We say what each model costs and how reliable it is, and we let you re-roll a build or undo an edit.",
      ],
    },
    {
      heading: "Who can use it",
      paragraphs: [
        `You must be at least ${site.minAge} years old to have an account. To buy a paid plan or credits you must be ${site.paidAge} or older, or have a parent or legal guardian make the purchase and agree to these terms for you.`,
        "You sign in with a Google account. You are responsible for what happens under your account; tell us if you think someone else is using it.",
      ],
    },
    {
      heading: "Your games are yours",
      paragraphs: [
        "You own the games you make: the descriptions you write, the code and art the agent produces for you, and the exported builds. We take no share of what your games earn. You can publish them under your own name on any platform, and you are responsible for them there, including app-store rules and the laws of the countries you publish in.",
        "Some parts of every game come from TypePlay: our templates, engine rules and bundled free assets (for example CC0 model packs). You may use those parts in your games without limit. You may not resell them on their own as asset packs.",
        "Games built on the free plan carry a small TypePlay badge. Paid plans remove it.",
      ],
    },
    {
      heading: "What you may not do",
      paragraphs: ["You may not use TypePlay to make or share:"],
      list: [
        "games that are illegal where you or your players are, including content that sexualises minors, incites violence or hate, or harasses real people;",
        "games that copy someone else's characters, art, music or brand without the right to use them;",
        "software that harms players' devices, steals data or hides what it does;",
        "automated traffic, scraped prompts, or anything that attacks the service or other users.",
      ],
    },
    {
      heading: "The AI and its limits",
      paragraphs: [
        "Your descriptions and your game files are sent to an AI model provider (Anthropic) to build and edit games. The model can refuse a request its safety rules do not allow; we show you that as a message and do not charge credits for a refused build.",
        "AI output can contain mistakes. Test your game before you publish it.",
      ],
    },
    {
      heading: "Plans, credits and payment",
      paragraphs: [
        `Paid plans give you credits every month, and on a paid plan you can buy credit packs on top. The free plan gives ${credits.freePerMonth} credits a month, at most ${credits.freePerDay} a day, for Fast builds. Credits are a prepaid allowance for using TypePlay's AI build service: they are not money or stored value, have no cash value, cannot be transferred, sold or exchanged, and work only on TypePlay.`,
        `Each message spends credits for the work it does, and we show an estimate before it runs; if a message would cost much more than usual, we ask first. Unused monthly credits carry over to the next month once, up to one month's amount, while your plan is active. Credits from a pack last ${credits.pack.months} months. Free credits do not carry over. When your plan ends, its monthly credits end with it.`,
        "Prices are in US dollars, and tax is added at checkout where it applies. If you move to a bigger plan, you pay the difference for the rest of the month and get the extra credits straight away; a move to a smaller plan starts at your next renewal.",
        "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.",
        `Subscriptions renew monthly until you cancel. You can cancel at any time from your account; the plan stays active until the end of the paid period. Refunds follow our refund policy.`,
      ],
    },
    {
      heading: "Availability and changes",
      paragraphs: [
        "We work to keep TypePlay up, but we do not promise uninterrupted service, and we may change or stop features. We will give reasonable notice of changes that affect what you pay for.",
        "We can suspend or close accounts that break these terms. You can close your account at any time; your games can be exported first.",
      ],
    },
    {
      heading: "Liability",
      paragraphs: [
        "TypePlay is provided as it is. To the extent the law allows, we are not liable for indirect losses, lost profits or lost data, and our total liability for any claim is limited to what you paid us in the three months before the claim. Nothing in these terms limits rights that consumer law gives you and that cannot be waived.",
      ],
    },
    {
      heading: "Who we are, law and contact",
      paragraphs: [
        `TypePlay is run by ${operator}.`,
        `These terms are governed by the laws of ${site.seller.country}. If you are a consumer in the EU or the UK, you also keep the protections of your own country's law.`,
        `Questions: ${contact}.`,
      ],
    },
  ],
};

export const privacy: LegalDoc = {
  title: "Privacy policy",
  intro: `This policy explains what TypePlay ("we", "us") collects when you use it, why, and what you can do about it.`,
  sections: [
    {
      heading: "What we collect",
      paragraphs: ["We keep the service small and so is the data:"],
      list: [
        "Account: your name, email address and profile picture from Google when you sign in, and the time you joined.",
        "Your work: the descriptions you type, the games the agent builds, their version history, and screenshots and test results of each build.",
        "Usage: which features you use, credits spent per message, errors, and basic device and browser information from server logs.",
        "Payments: your plan, invoices and credit purchases. Card and bank details are entered on Paddle's checkout and never reach us.",
        "Android builds: when you make one, the signing key we create for that game, kept encrypted so your builds keep working. You can download it at any time, and it is deleted with the game or your account.",
        "Feedback: what you write when you send us feedback from the app, the page you sent it from, your browser and device type, and the game and its last message if you attach them.",
      ],
    },
    {
      heading: "Why we use it",
      paragraphs: [
        "To run the service: build and store your games, show your projects, count credits, and answer support requests.",
        "To improve it: we look at which prompts fail and why, so the agent gets better. We do not sell your data and we do not show ads.",
        "To keep it safe: to detect abuse, enforce the terms and meet legal obligations.",
      ],
    },
    {
      heading: "Who else sees it",
      paragraphs: ["Providers that process data for us, under their own privacy terms:"],
      list: [
        "Anthropic: receives your descriptions and game files to build and edit games with its AI models.",
        "Supabase: hosts our database and sign-in.",
        "Google: provides sign-in with your Google account.",
        "Cloudflare: provides DNS, email forwarding and hosting of game previews and exports.",
        "Paddle: handles checkout, invoices, taxes and refunds as merchant of record.",
      ],
    },
    {
      heading: "Public games",
      paragraphs: [
        `When you share a game, its play page at ${site.domain}/play/<id> is public to anyone with the link (the game itself is served from ${site.gamesDomain}). Your projects and descriptions are private until you share them.`,
        `A shared game appears in the public gallery at ${site.domain}/explore only if you also switch that on, and we count its plays as a number per day, with nothing about who played.`,
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "Your account and games stay while your account exists. When you close your account we delete your projects within 30 days, except invoices and records we must keep by law. Server logs are kept for up to 90 days. We also keep a scrambled copy of a closed account's email address for 90 days, so the free credits can't be claimed twice; it can't be turned back into the address.",
      ],
    },
    {
      heading: "Children",
      paragraphs: [
        `TypePlay is for people aged ${site.minAge} and over. We do not knowingly collect data from younger children; if you think a child under ${site.minAge} has an account, write to ${site.email} and we will remove it.`,
      ],
    },
    {
      heading: "Your rights",
      paragraphs: [
        `You can see, export or delete your data from your account, or by writing to ${site.email}. If you are in the EU, the UK or another place with data-protection law, you also have the right to correct your data, to object to some processing, and to complain to your local authority.`,
      ],
    },
    {
      heading: "Cookies",
      paragraphs: [
        "We use only the cookies needed to keep you signed in and to protect forms. There are no advertising or cross-site tracking cookies.",
      ],
    },
    {
      heading: "Who is responsible",
      paragraphs: [
        `TypePlay is run by ${operator}, who is responsible for your data under this policy (the data controller). Contact: ${contact}.`,
      ],
    },
  ],
};

const example = plans.find((p) => p.id === "medium")!;
const exampleUsed = 30;
const exampleRefund = (example.price * (example.credits - exampleUsed)) / example.credits;

export const refunds: LegalDoc = {
  title: "Refund policy",
  intro: `Paddle.com is the merchant of record for TypePlay purchases and processes all refunds. This is the policy Paddle applies on our behalf.`,
  // Decided 2026-10-16 (docs/pricing.md): refund the unused share of a payment within 14 days. It is
  // the EU rule for a digital service (CJEU C-234/25, July 2026) applied to everyone, and someone who
  // used every credit gets nothing back.
  sections: [
    {
      heading: `Within ${site.refundDays} days: the credits you haven't used`,
      paragraphs: [
        `Within ${site.refundDays} days of any payment (a new plan, a monthly renewal or a credit pack) you can ask for a refund, for any reason. We refund the part of that payment you have not used: the full amount if none of its credits were spent, otherwise the price multiplied by the share of its credits still unused. Credits already spent are not refunded, because the AI work has been done.`,
        `For example: the ${example.name} plan is $${example.price} for ${example.credits} credits. With ${exampleUsed} credits used, the refund is $${exampleRefund} for the other ${example.credits - exampleUsed}.`,
        // Luka, 2026-10-25/26: a refund means they don't want the plan any more (the API cancels the subscription at
        // Paddle: apps/server/README.md "Billing").
        "A refund of a plan payment also cancels the subscription, so nothing renews.",
      ],
    },
    {
      heading: `After ${site.refundDays} days`,
      paragraphs: [
        `Payments are not refundable after ${site.refundDays} days, except for billing mistakes, such as a double charge, or where the law requires a refund.`,
      ],
    },
    {
      heading: "Cancelling",
      paragraphs: [
        "Cancel any time from your account. Cancelling stops the next payment; your plan and its credits stay active until the end of the period you paid for.",
      ],
    },
    {
      heading: "Failed builds",
      paragraphs: [
        "A build the model refuses costs nothing. A build that fails our automatic check is retried at no extra cost, and if it still fails, its credits come back to you automatically.",
      ],
    },
    {
      heading: "EU and UK customers",
      paragraphs: [
        "You also have a legal 14-day right of withdrawal from the day you buy. TypePlay is a digital service that starts right away: at checkout you ask us to start immediately, and you agree that if you withdraw you pay for the credits you have used, and that the right ends once all credits from that purchase are used. This gives the same result as the 14-day rule above. You can withdraw by writing to us or through Paddle's customer portal.",
      ],
    },
    {
      heading: "How to ask",
      paragraphs: [
        `Write to ${site.email} with the email address of your account and the invoice number from Paddle${site.phone ? `, call or message ${site.phone},` : ","} or ask Paddle directly through the link on your receipt. The money goes back to the original payment method within 14 days of approval.`,
      ],
    },
  ],
};
