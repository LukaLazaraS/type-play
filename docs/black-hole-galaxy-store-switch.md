# Black Hole Galaxy: replacing the Unity app with the Godot build

Researched 2026-10-21 (Builder). The Godot project is `games/BlackHoleGalaxy-godot` (its own git, no GitHub repo yet); it started from the agent's `packages/agent/output/black-hole-galaxy`.
The Unity game is `../../games/BlackHoleGalaxy`.

## Status (2026-10-21 morning, Builder): ready to upload, pending Luka's three steps

- **Where the game lives.** The store version is `master-project/games/BlackHoleGalaxy-godot`, branch `master`.
  - It is the full port (4 Opus jobs on 10-21: 100 levels, upgrades, energy, revives, 26 skins, tutorial, settings) plus the store layer.
  - It is the one copy to keep working in: it also exports the website build cleanly.
  - Runbook: `store/RELEASE.md`. Builds: `node store/build.mjs android | ios [--push] | test | version`.
- **Tests.** All 24 test files pass (TypePlay's check, about 530 checks).
  - Store tests: the Unity save import end to end (Android XML and iOS binary plist), the ad rules, the purchase rules, Unity's analytics names in real play, and the stubs off a phone.
- **Android.** The AAB builds in WSL.
  - `com.lazaraGames.blackholegalaxy`, 1.3 / 11, SDK 25 / 36, arm64, 16 KB pages.
  - The Unity launcher name is the only entry in the app drawer.
  - The Play-restricted permissions are removed.
  - It is signed once `BHG_KEYSTORE_PASS` is in `store/.env`.
- **iOS.** The Xcode project exports on Windows.
  - Team TN6GSCL952, iPhone, iOS 15, build 11.
  - AdMob's Swift package is linked, the purpose strings are set, and the live app's plist values are kept.
  - It is staged on branch `godot` of `BlackHoleGalaxy-ios`, not pushed. Codemagic builds that branch on push.
- **Luka's steps** (`docs/parked.md` row 22):
  1. Put the keystore password in `store/.env`.
  2. Say "push" for iOS.
  3. Test on a phone.

## Identity (must stay the same)
- **App ID:** `com.lazaraGames.blackholegalaxy` on both stores, case-sensitive [F].
- **Android:**
  - Version 1.2; version codes 6, 8 and 9 shipped, and the settings already say 10. The next upload uses **11 or higher** [F].
  - minSdk 25, arm64 [F].
  - Uploads are AABs with Play App Signing.
  - Upload key: `C:\Users\lazar\.ssh\user.keystore`, alias `prod`. Identical backups in `D:\game dev` and `E:\storage\game dev` (checked 10-21) [F].
  - Godot's Gradle template signs with key password = store password. If they differ, change the alias password with `keytool -keypasswd` (same key, signature still valid) [W].
- **iOS:**
  - Version 1.2, build 5, iPhone only, iOS 15+ [F].
  - Today's pipeline: Unity exports the Xcode project on Windows, it is pushed to the private repo `BlackHoleGalaxy-ios`, and Codemagic (`ci/codemagic.yaml`, M2) signs it and uploads to TestFlight.
  - Signing: cert `5BLDGTFCY8`, profile `Q6TNVBCUHA`, team `TN6GSCL952` [F].
  - The certificate private key backup (`bhg-cert-private-key.pem`) is in `D:\game dev` and `E:\storage\game dev`, identical copies (found 10-21), and in Codemagic's `appstore` group [F].
- **With Godot:** it exports headless on the Codemagic Mac itself, so the export and mirror-repo steps go [W/I].

## SDKs: Unity → Godot 4.7
| Unity [F] | Godot 4.7 [W] |
|---|---|
| **Google Mobile Ads 11.3.0:** rewarded only. Units: Android `ca-app-pub-2640918086530691/3480414693`, iOS `…/3874024721`. Placements: revive, double_reward, skin_unlock, coins_tier0-2, energy_topup | **poingstudios/godot-admob-plugin v5.0.0** (Godot 4.5+, Android + iOS, consent built in). v5 is a fresh rewrite |
| UMP consent | In the AdMob plugin |
| ATT prompt (`BHGAppTracking.mm`) | poingstudios/godot-att-ios or godot-x/att |
| **GameAnalytics 8.0.1** | Official **GA-SDK-GODOT 3.1.2** (GDExtension; 3.1.2+ for 16 KB pages) |
| **Unity IAP 5.4.2, iOS only:** 3 coin packs + 9 skins | Community StoreKit plugins only (hrk4649 v0.4.0 for Godot 4.7). **The weakest link**; avoid the iOS 17+ one |
| Mobile Notifications ("energy full") | godot-notification-scheduler (Godot 4.7, marked unstable) |
| `Handheld.Vibrate` | built in: `Input.vibrate_handheld()` |

Every Godot Android plugin needs the **Gradle build template**, which is also how Godot makes an AAB.

**IAP product IDs** (all start with `com.lazaraGames.blackholegalaxy.`):
- Consumables: `coins_1k`, `coins_5k`, `coins_15k`.
- Non-consumable skins: `skin_poison`, `skin_plasma`, `skin_triangle`, `skin_spinner`, `skin_tempest`, `skin_eclipse`, `skin_trinity`, `skin_void`, `skin_sigil`.

## Player saves (the risky part)
- Unity keeps everything in PlayerPrefs (`BHG_*` keys: progress, coins, energy, skins, ad progress, stats, settings) [F].
- The Godot port saves the same key names to `user://bhg_save.json`, so migration is a copy.
- **Android:** the same package keeps the same sandbox. Godot 4.4+ `JavaClassWrapper` can read `getSharedPreferences("com.lazaraGames.blackholegalaxy.v2.playerprefs", 0)` with no plugin [W/I].
- **iOS:** the data lives in NSUserDefaults, and reading it needs a ~30-line iOS plugin [I].
- **Rules:** migrate once, only when no Godot save exists, and never delete the Unity keys.
- **What the stores restore:**
  - On iOS, StoreKit restores the 9 paid skins.
  - Coin packs live only in `BHG_Coins` and are lost without migration (and Apple 3.1.1 says bought currency may not expire).
  - Android never sold anything.

## Store rules for the update
**Google Play**
- Target **API 36** (required since 31 Aug 2026; Godot 4.7 defaults to it) [W].
- **16 KB page** native libraries [W].
- The Advertising ID declaration is "Yes", so the first Godot release must include AdMob.
- The launcher activity changes name; an `activity-alias` keeps home-screen icons [I].
- Test through the internal testing track.
- Use a staged rollout; there is no going back to a lower versionCode.

**Apple**
- Build 6 or higher with **Xcode 26 / iOS 26 SDK** [W].
- Set iPhone-only.
- Carry these over: `ITSAppUsesNonExemptEncryption=false`, `NSUserTrackingUsageDescription`, `GADApplicationIdentifier`, SKAdNetwork.
- Keep the same 12 product IDs and a working Restore Purchases.
- Use TestFlight over the live install to test migration, then a phased release.

## Effort (estimate)
| Item | Time |
|---|---|
| Content parity (100 levels, 26 skins, energy, upgrades, revive, ad stubs) | in progress 10-21, two agent runs |
| AdMob + consent + ATT | 1-2 days |
| iOS IAP + restore + sandbox tests | 1-2 days |
| GameAnalytics with the Unity event names | 0.5-1 day |
| Notifications | 0.5 day |
| Save migration + upgrade tests on real phones | 2 days |
| Android preset + signing, Codemagic workflow for Godot | 1.5 days |
| Store forms (same SDKs) | 1-2 hours |

**Riskiest items:**
1. Shipping before full content parity: lost progress and paid skins.
2. A migration bug: the first launch is the only clean chance.
3. Young StoreKit plugins.
4. AD_ID / API 36 / 16 KB blockers.
5. Single-copy keys: the upload keystore, and the missing iOS key backup.
