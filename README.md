# MedRekk

An offline-first, patient-owned medical record. The record lives on the patient's phone, a
clinician sees only what the patient approves and only for as long as they allow, and every look
is written into a log the patient alone can read.

Built for primary care where the network is unreliable and a patient's history otherwise starts
again at every new facility.

**Live:** https://medrekk-web.rumptycloud.app
**Full documentation:** [`docs/`](./docs) — architecture, the consent model, offline design, API
surface, deployment, and the reasoning behind the decisions that were not obvious.

---

## The three repositories

| Repository | What it is | Deployed to |
|---|---|---|
| [`medrekk`](https://github.com/Robinson-Taiwo/medrekk) | The mobile app, for patients and health workers | EAS Build (Android APK) |
| [`medrekk-backend`](https://github.com/Robinson-Taiwo/medrekk-backend) | API, consent engine, audit trail | Rumpty Cloud |
| [`medrekk-web`](https://github.com/Robinson-Taiwo/medrekk-web) | Marketing site, clinician record reader, emergency lookup, USSD simulator, admin | Rumpty Cloud |

They are deliberately separate rather than a monorepo: the mobile app's build pipeline (EAS,
native modules, a 25-minute build) has nothing in common with a Next.js deploy, and coupling them
would have meant every web change invalidating a mobile build cache.

---

## How a record is read

```
 PATIENT PHONE                    BACKEND                      CLINICIAN
 ┌──────────────┐                                             ┌──────────────┐
 │ record       │                                             │ asks with a  │
 │ (SQLite)     │                                             │ MedRekk code │
 └──────┬───────┘                                             └──────┬───────┘
        │                     ┌───────────────┐                      │
        │  push notification  │ access        │  1. request ─────────┘
        │ ◄───────────────────┤ session       │
        │                     │ - scopes      │
        │  2. approve, and    │ - expiry      │
        │     narrow the ─────► - token hash  │  3. scoped record, time-limited
        │     scopes          └───────┬───────┘ ─────────────────────►
        │                             │
        │                     ┌───────▼───────┐
        │                     │ audit trail   │  every view, scan and dial-in
        │ ◄───────────────────┤ (patient-only)│
        └─────────────────────┴───────────────┘
```

Three properties the design turns on:

- **Nothing is shared by default.** A clinician with a patient's code can request access and
  nothing more. The patient sees who is asking, where they work and why, and may approve fewer
  scopes than were requested.
- **Access expires by itself.** A grant carries `grantedUntil`; nobody has to remember to revoke.
- **Every read is recorded**, including emergency scans and USSD dial-ins, in a log only the
  patient can see.

A patient without a smartphone is not excluded: any record can be read by dialling a USSD code
and entering a PIN, and an emergency card is readable from a QR without any approval at all.

---

## Stack

**Mobile** — Expo SDK 57, React Native 0.86, Expo Router (typed routes), NativeWind v4,
expo-sqlite for the offline cache and sync queue, `llama.rn` for on-device extraction with a
deterministic fallback, ML Kit for OCR.

**Backend** — Express 5, TypeScript (ESM, no `any`), Zod at every boundary, Postgres with an
in-memory implementation behind the same interfaces, vitest (24 suites).

**Web** — Next.js 16 App Router, React 19, Tailwind v4, server components by default.

---

## Codebase structure

The same rule holds in all three: **a folder is a capability, not a layer.** There is no
`components/`, `utils/`, `helpers/` bucket that every feature reaches into.

### `medrekk-backend/src`

```
routes/        thin HTTP: parse with Zod, call a service, return
services/      all the behaviour; knows nothing about Express
database/      repository interfaces + two implementations (memory, postgres)
shared/        types and validation schemas shared with the app
middleware/    auth, rate limiting, error shaping
```

Services take their dependencies as an object, so every test builds an app with in-memory
repositories and a fixed clock — the suite runs in 16 seconds with no database. The Postgres
implementation satisfies the same interfaces, which is what makes `AUTH_MODE=dev` safe to refuse
whenever `DATABASE_URL` is set.

### `medrekk/src`

```
app/           screens only (Expo Router file-based routing)
features/      one folder per capability: access, record, emergency, ai, tour, notifications…
components/design/  the design system: Split layout primitives, tokens, toasts
offline/       SQLite cache and the cached-fetch seam
sync/          the queue that carries work recorded with no connection
```

`components/design/tokens.ts` is the single source for colour. Before it there were 130 hardcoded
hex literals across 24 files, from three different grey families — which is most of why the app
read as inconsistent.

### `medrekk-web/src`

```
app/           routes; server components unless they need state
components/    night.tsx (primitives), night-chrome.tsx (header/footer), phone.tsx (mockups)
```

---

## Running it locally

All three use **npm**.

**Backend**

```bash
cd medrekk-backend
npm install
cp .env.example .env
npm run dev          # http://localhost:4000
npm test             # 24 suites
npm run typecheck
```

With no `DATABASE_URL` it runs entirely in memory and seeds demo accounts, which is the fastest
way to see the whole flow.

**Web**

```bash
cd medrekk-web
npm install
npm run dev          # http://localhost:3000
```

**Mobile**

```bash
cd medrekk
npm install
npx expo start
```

Android emulators reach a backend on the host at `10.0.2.2`, not `localhost`.

---

## Environment

**`medrekk-backend`**

| Variable | Notes |
|---|---|
| `PORT` | Defaults to 4000 |
| `AUTH_MODE` | `jwt` by default. `dev` trusts headers and is refused in production and whenever `DATABASE_URL` is set |
| `DATABASE_URL` | Postgres. Unset means in-memory |
| `DATA_ENCRYPTION_KEY` | Required with Postgres. **Back this up — without it the stored record cannot be read** |
| `CORS_ORIGIN` | Must include the deployed web origin |
| `EXPO_PUSH_ENABLED` | `true` sends through Expo's push service |
| `ADMIN_EMAILS` | Comma-separated; gates the credential-approval admin |
| `SEED_DEMO_DATA` | Ignored when `DATABASE_URL` is set |

**`medrekk-web`** — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APK_URL`,
`NEXT_PUBLIC_APK_VERSION`, `NEXT_PUBLIC_USSD_CODE`.

**`medrekk`** — `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`. For builds these come from
`eas.json`'s profile `env`, not from `.env`.

---

## Deploying

### Backend and web — Rumpty Cloud

Both are standard Node deploys. Connect the repository, set the environment variables above, and
deploy. Two things that are easy to miss:

1. **`CORS_ORIGIN` must contain the deployed web origin**, or the browser-side record reader and
   emergency lookup fail with no server-side error to show for it.
2. **New backend routes need a redeploy.** A 404 on a route that exists in `main` means the
   running build predates it.

Provision Postgres from the same dashboard and set `DATABASE_URL` and `DATA_ENCRYPTION_KEY`.

### Mobile — EAS Build

```bash
cd medrekk
npx eas-cli@latest build --profile preview --platform android
```

Produces an installable APK with a shareable link; no Play Store involved.

Before the first build:

- `google-services.json` must sit at `medrekk/google-services.json` **and be tracked by git** —
  EAS only uploads files git knows about.
- Its package name must match `android.package` in `app.json` exactly, or the Google Services
  gradle plugin fails the build.
- For push, upload the FCM V1 service account key via `npx eas-cli credentials`. The key goes to
  EAS, not to the backend — Expo's push service is what talks to Firebase.

---

## Testing

```bash
cd medrekk-backend && npm test        # 24 suites
cd medrekk && npm run check:plain     # plain-language rewriter, by eye
cd medrekk && npm run check:lab       # lab-report reader, by eye
```

The two `check:` scripts print their output rather than asserting. The right answer for "is this
sentence plain enough" is a judgement a person makes, and the cases in them each earned their
place by being wrong once.

---

## Notes on a few decisions

**The on-device model is a bonus, not the product.** Extraction and plain-language rewriting fall
back to a reviewed medical glossary and deterministic parsing when the model will not load, which
on a cheap handset is most of the time. The fallback is what ships and what is demonstrated.

**MedRekk never supplies a reference range.** A lab result is compared only against the interval
printed on that same report. Intervals vary by laboratory, assay, age, sex, pregnancy and
altitude, and a built-in table would quietly turn each of those differences into a false flag.

**The printed emergency card carries two facts.** Blood group and severe allergies — what changes
treatment in the first minute. Everything else stays behind the QR, where it stays current and
where reading it leaves a trace. A card printed in January listing no allergies is worse than no
card once one is added in March.

**A patient may delete a record a clinician wrote.** If the record belongs to the patient it
belongs to them including the parts they disagree with. The removal is written into the audit
trail, which is what keeps that honest.
