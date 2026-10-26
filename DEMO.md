# Running the MedRekk demo

For whoever is driving, whether or not they built it. Read the first section
before demo day; the rest is the script.

---

## Before the day

### 1. Confirm what the server is storing

```bash
curl -s https://medrekk-backend.rumptycloud.app/health
```

Then check the server's start-up log for one of two lines:

- **`Storage: Postgres`** — data survives restarts. The built-in demo accounts
  **do not exist**; the log also says `SEED_DEMO_DATA is ignored with Postgres`.
  You must register your own accounts (step 2).
- **`Storage: in memory (data is lost on restart)`** — the demo accounts below
  exist, but **everything is wiped whenever the host restarts or sleeps**.
  Re-check an hour before demoing, and assume you may have to re-enter data.

This single line decides your whole setup. Find it before anything else.

### 2. Accounts

With Postgres, register two accounts at the web sign-up and on the app:

| Role | What it needs |
|---|---|
| Patient | Any email. Note the **MedRekk code** shown after sign-up — the worker needs it. |
| Health worker | Any email, plus a facility name. **Starts as PENDING.** |

A PENDING worker can request access, record a visit and attach a document, but
**cannot mark anything "clinically verified"**. If your demo shows verification,
approve the worker first:

1. On the server, set `ADMIN_EMAILS` to your own health-worker account's email
   and restart. **With it blank, nobody can approve anyone** — this is the usual
   reason a worker stays pending forever. The web sign-in rejects patient
   accounts, so the admin must be a health-worker account.
2. In the app, as the worker: **Profile → Your licence**. Pick the register
   (MDCN for doctors, NMCN for nurses), enter the registration number, your
   role, and photograph the licence. Send for review.
3. On the web, signed in as the admin: open **/admin**, check the number against
   the register it names, look at the photo, and click Approve.

The worker's phone picks the approval up on its own — no need to sign out.

Nothing is verified automatically. The approval is a person checking a number on
a public register; say that plainly if asked rather than implying more.

With the in-memory server, these already exist:

| Role | Email | Password |
|---|---|---|
| Patient — Amaka Okafor | `amaka@demo.medrekk` | `demo-pass-123` |
| Health worker — Ngozi Eze (approved) | `nurse@demo.medrekk` | `demo-pass-123` |

Amaka's MedRekk code is **MRK-82941**, blood group O+, with a penicillin allergy,
metformin, a recent clinic visit and type 2 diabetes already in the record.

### 3. Two phones, installed and signed in

Build the Android package and put it on a link:

```bash
cd medrekk && npx eas build --profile preview --platform android
```

Install on **two** handsets — one signed in as the patient, one as the worker —
and sign in on both the night before. Do not plan to sign in live.

### 4. Optional: the on-device models

Both are downloads inside the app, under the Model screen.

- **Speech (about 32 MB)** — needed for the Speak option. Worth installing.
- **Language model (about 450 MB)** — currently does not load on device. The app
  falls back to reading the note on the handset and says *"Read on this phone"*.
  Nothing breaks and no error is shown. **Do not promise an on-device LLM on
  stage**; say the structuring happens on the phone, which is true.

Download both on wifi the night before. Never on venue wifi.

---

## The script

Twelve minutes, in this order. The story is *who decides who sees this*.

**1 — The record belongs to the patient.** Open the patient phone. Show the
record: each entry carries how it got there — self-reported, backed by a
document, confirmed by a clinician. Point at the labels. This is the whole idea.

**2 — The patient can put their own evidence in.** Add → **Photo** → photograph a
prescription (bring a printed one). The text is read on the phone and fills the
box; edit it down to the medicine. Save.

Then say the part that matters: *the entry is still self-reported.* The document
is attached and the next clinician will see it, but evidence you supply about
yourself is worth reviewing, not trusting. **The picture never leaves the phone —
only a fingerprint of it is sent.**

**3 — A clinician asks.** On the worker phone: Find a patient → enter the MedRekk
code and name → request access, naming a reason and what they need.

**4 — The patient decides.** The request appears on the patient phone. Show that
they can **approve less than was asked for**, then approve.

**5 — The visit, with no signal.** Put the worker phone in **aeroplane mode**
first, visibly. Record an encounter by voice or text. Draft items appear; each
one is confirmed by a human before it is saved. Save — it queues on the phone.

**6 — Back online.** Turn aeroplane mode off. The queue syncs and the entry
appears on the patient's phone.

**7 — The patient takes it back.** On the patient phone, end the access. On the
worker phone, it is gone. Show the access log: who looked, when, at what.

**8 — No smartphone, no app.** On a laptop, open `/ussd` and dial the simulator.
Same record, any phone.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| Worker's access vanished after signing out | Fixed — it is restored from the account. If it is still missing, the server is running an old build. |
| "No matching record found" | The name must match the registered name exactly. Check spelling before blaming the code. |
| Worker cannot verify a claim | Their credential is PENDING. See step 2. |
| /admin says this account cannot approve | Its email is not in `ADMIN_EMAILS` on the server. |
| A clinician wants their own record | Profile → Use MedRekk for my own record. One account covers both. |
| Draft says "Read on this phone" | Expected. The language model did not load; the note was still read on the handset. Carry on. |
| Nothing found in a note | Real answer, not a failure. Tap **Add an item** and type it. |
| Everything is empty | In-memory server restarted. Re-register and re-enter. This is why step 1 matters. |

**Never** show the raw server, a terminal, or a connection string on stage.
