// The Android screens' words (docs/android-export-design.md §11-12): the pill, the plan panel,
// setup, the hub, the signing key, the phone link and the Google Play checklist. Plain player
// language; the two file kinds are explained once, in `formats`, and named APK and AAB after that.
import { site } from "./site";

export const APP_NAME_MAX = 30;
export const PACKAGE_MAX = 80;
/** The build's file is kept this long; "Build again" afterwards. */
export const FILE_DAYS = 30;
/** The phone link's life. */
export const LINK_MINUTES = 10;

/** The same rules as the API's (apps/server/runner/android-prepare.mjs), so a bad name is said before the request. */
const PACKAGE_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
const RESERVED = ["com.example.", "com.android.", "android.", "com.google."];
export function packageNameProblem(name: string): string | null {
  if (!name) return "Type a package name.";
  if (name.length < 3 || name.length > PACKAGE_MAX) return `A package name is 3 to ${PACKAGE_MAX} characters.`;
  if (!PACKAGE_RE.test(name)) return "A package name looks like com.yourname.game: lowercase letters, digits and underscores, dots between parts, each part starting with a letter.";
  if (RESERVED.some((p) => name.startsWith(p))) return `Google Play doesn't allow names starting with ${RESERVED.map((p) => p.slice(0, -1)).join(", ")}.`;
  return null;
}
/** The suggested package name: app.typeplay.<slug>_<game id>, as the API makes it when none is given. */
export function defaultPackageName(gameName: string, projectId: string): string {
  let slug = gameName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20)
    .replace(/_+$/, "");
  if (!slug || /^[0-9]/.test(slug)) slug = `g${slug}`;
  return `app.typeplay.${slug}_${projectId}`;
}

export const android = {
  pill: "Android",
  title: "Android.",
  /** Under the title: what this page is for, in one line. */
  lead: "Your game as an app: on your own phone today, on Google Play when you're ready.",

  /** The two file kinds, explained once. */
  formats: {
    apk: { name: "APK", what: "a file you install on your own phone" },
    aab: { name: "AAB", what: "the file Google Play takes" },
    line: "An APK is a file you install on your own phone. An AAB is the file Google Play takes. Both are signed with a key made for this game.",
  },

  /** Free: no exports (the API answers 403 plan_no_export). */
  plan: {
    title: "Android builds come with a plan.",
    text: "Free is for making and playing in the browser. Every paid plan builds Android apps, as often as you like, for no credits.",
    action: "See the plans",
    href: "/billing?change=1",
  },
  /** This server has no Android toolchain (Me.features.android is false). */
  off: "Android builds aren't available on this server yet.",
  /** The game has no build yet. */
  noGame: { text: "Build your game first. The Android app is made from a version of your game.", action: "Back to the game" },

  setup: {
    title: "Set up Android.",
    lead: "Android needs a name for the app and a package name, its id on Google Play. The icon is optional. Then you build.",
    go: "Set up Android",
    busy: "Setting up…",
    /** After setup the hub appears, with this line above it. */
    done: "Android is set up. Build the APK to put the game on your phone.",
  },
  identity: {
    title: "This app",
    edit: "Change",
    save: "Save",
    busy: "Saving…",
    cancel: "Cancel",
    appName: { label: "App name", hint: `The name under the icon and in the store. ${APP_NAME_MAX} letters at most.` },
    packageName: {
      label: "Package name",
      hint: "Made from the game's name. Players never see it.",
      own: "Use my own",
      ownHint: "Like com.yourname.game: lowercase letters, digits and underscores, with dots between the parts.",
      suggested: "Use the suggested one",
      /** Under the field before the first AAB. */
      lock: "This can't change after your first upload to Google Play: a new name is a new app.",
      /** After the first AAB. */
      locked: "Fixed by your first Play package. Changing it makes a new app on Google Play.",
      /** The ask when it is locked and the user changes it anyway. */
      ask: "Change the package name? Google Play will treat it as a new app: your current listing can't update to this one.",
      confirm: "Change it anyway",
    },
    icon: {
      label: "Icon",
      poster: "The game's start screen, cropped square.",
      own: "Your own PNG.",
      placeholder: "A neutral icon, until the game has a start screen or you upload one.",
      upload: "Upload a PNG",
      replace: "Upload another",
      usePoster: "Use the game's picture",
      rules: "A square PNG, 512×512 or bigger, under 1 MB.",
      notPng: "That isn't a PNG file.",
      notSquare: "That file isn't square, or is smaller than 512×512.",
      tooBig: "The icon must be under 1 MB.",
    },
  },

  build: {
    title: "Build",
    version: "Version",
    current: "playing now",
    apk: { action: "APK for your phone", time: "usually under a minute" },
    aab: { action: "AAB for Google Play", time: "usually 2 to 4 minutes" },
    leave: "You can leave this page: it keeps going.",
    stop: "Stop",
    stopping: "Stopping…",
    /** The live line per status. */
    queued: "Waiting for its turn",
    ahead: (n: number) => (n === 1 ? "1 build ahead of it" : `${n} builds ahead of it`),
    running: "Building",
    signing: "Signing with your key",
    /** Today's allowance is used (10 a game, 30 an account a day). */
    noneToday: "That's today's builds for this game. More tomorrow.",
    noneTodayUser: "That's today's builds for your account. More tomorrow.",
  },

  builds: {
    title: "Your builds",
    empty: "No builds yet. Your first one appears here with its download.",
    status: {
      queued: "Waiting",
      running: "Building",
      signing: "Signing",
      done: "Ready",
      failed: "Didn't work",
      expired: "Expired",
      cancelled: "Stopped",
    } as Record<string, string>,
    download: "Download",
    downloading: "Getting the file…",
    phone: "Phone link",
    checks: "Checks",
    details: "Details",
    again: "Build again",
    /** A game-code failure: building again fails the same way; the chat is the way out. */
    chat: "Open the chat",
    cancel: "Stop",
    /** An expired row. */
    expired: `Files are kept ${FILE_DAYS} days. Build again for a fresh one.`,
    /** The file is kept 30 days; said as what to do, not as the app expiring. */
    expires: (days: number) => (days <= 0 ? "Download it today" : days === 1 ? "Download it by tomorrow" : `Download it within ${days} days`),
    /** Where the launcher icon came from, on a done row. */
    icon: { poster: "icon: the start screen", own: "icon: your PNG", placeholder: "icon: neutral" } as Record<string, string>,
  },

  phone: {
    title: "On your phone",
    caption: "On a computer? Scan this with your phone.",
    /** When the link is too long for a code (the API's is not; a very long API address would be): the text alone. */
    noCode: "Send this link to your phone, or open it there.",
    life: (minutes: number) => (minutes <= 0 ? "This link has expired. Make a new one." : minutes === 1 ? "Good for 1 more minute." : `Good for ${minutes} more minutes.`),
    expired: "This link has expired.",
    again: "New link",
    copy: "Copy link",
    copied: "Copied",
    steps: [
      "Open the link on your phone and download the file.",
      "Tap the download. Android asks to let your browser install apps: allow it once.",
      "If Google Play Protect warns you, it is because the app is not from the Play Store yet: tap More details, then Install anyway.",
      "If you later install the Play version, uninstall this one first: the two are signed differently.",
    ],
  },

  key: {
    title: "Your signing key",
    text: "This key signs the Android builds of this game. You don't need it to put the app on your phone: TypePlay keeps an encrypted copy, so your builds here keep working. Download it to publish updates from your own computer, and keep it with its password: anyone who has it can upload versions of your game.",
    /** Behind "If you lose it". */
    more: "Google Play keeps the real signing key for you (Play App Signing); this one only proves it is you who uploads.",
    lostTitle: "If you lose it",
    lost: "Google can replace it: Play Console > Protected with Play > Play Store protection > Manage Play app signing > Request upload key reset. The new key works about two days later.",
    fingerprint: "Fingerprint (SHA-256)",
    download: "Download signing key",
    downloading: "Getting the key…",
    inside: "A .zip with the key file and a README that has its password. 5 downloads a day.",
    never: "Not downloaded yet.",
    downloaded: (n: number, when: string) => `Downloaded ${n === 1 ? "once" : `${n} times`}, last on ${when}.`,
  },

  checks: {
    lead: "What Google Play looks at, checked on the file itself.",
  },

  /** While an Android build runs, the game page says so (chat, restore and delete wait). */
  exporting: {
    stage: "Building the Android version…",
    composer: "An Android build is running. You can type your next change and send it when it's done.",
  },

  /** The Google Play checklist (§12), static: for someone who has never published. */
  play: {
    title: "Putting it on Google Play",
    lead: "Everything below happens on Google's side, in your own account. Read it once; nothing here costs credits.",
    show: "Show the steps",
    hide: "Hide the steps",
    account: {
      title: "Your Google Play account",
      options: [
        { id: "before", label: "Made before 13 Nov 2023" },
        { id: "after", label: "Made after" },
        { id: "unsure", label: "Not sure" },
      ] as { id: "before" | "after" | "unsure"; label: string }[],
      before: "Your account is older than the testing rule: once your closed test looks fine you can apply for production.",
      after: "Accounts made after 13 November 2023 need 12 testers opted in for 14 days in a row before you can apply for production. Internal testing doesn't count. Google answers in about 7 days.",
      unsure: "Check the account's creation date in Play Console. If it was made after 13 November 2023, it needs 12 testers opted in for 14 days in a row before you can apply for production; internal testing doesn't count.",
    },
    steps: [
      {
        title: "Your account",
        text: "A Google Play developer account of your own: $25 once, 18 or older, an ID and a card check. New personal accounts also verify a phone. Start it now: it takes days and happens outside TypePlay.",
      },
      {
        title: "Name and package",
        text: `The app name is ${APP_NAME_MAX} letters at most. The package name is permanent after the first upload.`,
      },
      {
        title: "Your signing key",
        text: "Download it from this page and keep it with its password. Google keeps the real signing key; this one proves it is you who uploads.",
      },
      {
        title: "Pictures",
        text: "A 512×512 icon (32-bit PNG), a 1024×500 feature graphic (no transparency), and 2 to 8 screenshots at 1080×1920 or 1920×1080. Until TypePlay makes these for you: take them on your phone.",
      },
      {
        title: "Words and declarations",
        text: "A short description (80 letters) and a full one (4,000). A privacy policy address: Play asks for one even when the game collects nothing. Then the questionnaires. These answers fit a game made here today; if you add online features, ads or accounts, answer again.",
        list: [
          "Ads: No.",
          "App access: everything is open, no sign-in.",
          "Target audience: 13 and over, unless the game is truly made for children (then the Families rules apply).",
          "Content rating: the IARC questionnaire, honest answers about the game.",
          "Data safety: collects nothing. True for a plain TypePlay game: it asks for no permissions, not even the internet.",
          "Financial features, Health, Government app, Advertising ID: none, no.",
        ],
      },
      {
        title: "The file",
        text: "Google Play takes the AAB, not the APK from your phone. The checks on its row must all be good.",
      },
      {
        title: "Create the app in Play Console",
        text: "App name, Game, Free, a contact email, the two policies, the Play App Signing terms. Fill in \"Set up your app\", then upload the AAB to a closed testing track and add your testers.",
      },
      {
        title: "Testers",
        /** The page fills in the game's package name: `link` is appended to the text. */
        text: "Testers join through this link, once the app is on a testing track:",
        link: true,
        account: true,
      },
      {
        title: "Go live, and updates",
        text: "Apply for production; the review takes up to 7 days, longer in rare cases. For an update: Build again here (the build number rises by itself), then upload the new AAB.",
      },
    ] as { title: string; text: string; list?: string[]; link?: boolean; account?: boolean }[],
    testersLink: (packageName: string) => `https://play.google.com/apps/testing/${packageName}`,
    testersRule: "The rule depends on when your account was made:",
  },

  help: site.email,
} as const;
