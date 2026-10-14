import { site } from "./site";

export type Section = { heading: string; paragraphs: string[]; list?: string[] };
export type LegalDoc = { title: string; intro: string; sections: Section[] };

const operator = [site.seller.name, site.seller.form, site.seller.city, site.seller.country]
  .filter(Boolean)
  .join(", ");

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
        "You own the games you make: the descriptions you write, the code and art the agent produces for you, and the exported builds. You can publish them under your own name on any platform, and you are responsible for them there, including app-store rules and the laws of the countries you publish in.",
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
        "Paid plans give you monthly credits; extra credits can be bought on top. Credits are spent per message, and we show the cost before a build starts. Credits have no cash value, cannot be transferred, and unused monthly credits do not roll over unless the plan says so.",
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
        `Questions: ${site.email}.`,
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
        `When you share a game, its play page on ${site.gamesDomain} is public to anyone with the link. Your projects and descriptions are private until you share them.`,
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "Your account and games stay while your account exists. When you close your account we delete your projects within 30 days, except invoices and records we must keep by law. Server logs are kept for up to 90 days.",
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
        `TypePlay is run by ${operator}, who is responsible for your data under this policy (the data controller). Contact: ${site.email}.`,
      ],
    },
  ],
};

export const refunds: LegalDoc = {
  title: "Refund policy",
  intro: `Paddle.com is the merchant of record for TypePlay purchases and processes all refunds. This is the policy Paddle applies on our behalf.`,
  sections: [
    {
      heading: "Subscriptions",
      paragraphs: [
        `If you are not happy with a paid plan, ask for a refund within ${site.refundDays} days of the first payment and we refund it in full, as long as you have used less than a quarter of that month's credits. Renewals are refundable within ${site.refundDays} days on the same condition.`,
        "Cancelling stops future payments; it does not refund the current month. The plan stays active until the period ends.",
      ],
    },
    {
      heading: "Credit packs",
      paragraphs: [
        `Credit packs are refundable within ${site.refundDays} days of purchase if none of the credits have been used. Once credits are spent on builds they are not refundable, because the AI work has been done.`,
      ],
    },
    {
      heading: "Failed builds",
      paragraphs: [
        "A build the model refuses is not charged. A build that fails our automatic check is retried on a stronger model at no extra cost. If a build fails completely, write to us and we return the credits.",
      ],
    },
    {
      heading: "EU and UK consumers",
      paragraphs: [
        "You have a 14-day right of withdrawal. Because credits are digital content delivered immediately, you agree at checkout that delivery starts right away and that the right of withdrawal ends for credits you have used. Unused credits and subscriptions remain refundable as above.",
      ],
    },
    {
      heading: "How to ask",
      paragraphs: [
        `Write to ${site.email} with the email address of your account and the invoice number from Paddle. Refunds go back to the original payment method, usually within 5 to 10 business days.`,
      ],
    },
  ],
};
