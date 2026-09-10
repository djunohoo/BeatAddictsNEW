# Beat Addicts — Gap Analysis / Bug Hunt Tracker

Generated from a full top-down audit on 2026-09-07. Grouped by owner lane per current
team split: **Carrie → frontend**, **us → backend**. Notes get appended under each
item as it's completed.

Legend: `[ ]` open · `[x]` done · `[~]` in progress

---

## Round 2 bug hunt (2026-09-09/10)

A follow-up audit (4 parallel passes: backend, frontend components, AI
integration/state, plus a separate strategic/concept review) after the real
Supabase schema + real AI provider work above. All findings below fixed and
verified.

- [x] **R2-1 — `/generate/chords` crashed on any typical request**
      (`backend/models/music_theory.py`) `build_chords()` was missing the
      `complexity` clamp its sibling functions have; `complexity` defaults to
      `None` on `GenerationRequest`, so omitting it (the normal case) hit
      `None > 66` — raw 500. Fixed with the same clamp pattern as the others.
- [x] **R2-2 — Daily generation cap trivially bypassed** (`backend/services/legal.py`)
      The real server-tracked daily cap (from B4 above) is keyed on a
      client-supplied, unauthenticated `user_id` — sending a fresh UUID per
      request reset it every time. Added a per-IP sliding-window rate limit
      (10/min default, `IP_RATE_LIMIT_PER_MINUTE`) as a backstop — still
      spoofable, but raises the cost of abuse well above "increment a UUID"
      without requiring real auth (B2, not built yet).
- [x] **R2-3 — `/pulse/chat` could starve the shared worker threadpool**
      (`backend/services/pulse.py`, `backend/app/main.py`) it was a sync
      `def` route doing a blocking `httpx.post` with a 90s timeout,
      occupying a shared thread for the whole duration. A handful of
      concurrent chat requests against a slow upstream (no auth to stop
      this) could hang every other endpoint including `/health`. Converted
      to `async def` + `httpx.AsyncClient`.
- [x] **R2-4 — Header's Play/Pause/Stop controlled nothing** (`src/components/layout/Header.tsx`,
      `src/components/features/Sequencer.tsx`) Header wired transport
      buttons to `projectStore`, but Sequencer — the only thing that
      actually makes sound — maintained its own entirely separate
      `isPlaying`/interval/AudioContext state that nothing in the store
      touched. The most prominent global control in the app was dead; the
      `stop()` action added earlier this session (F5) was built specifically
      to fix this and didn't, because the disconnect was one level deeper.
      Fixed by making Sequencer's real playback engine reactive to
      `projectStore.isPlaying` (a `useEffect` starts/stops the actual
      interval + validates notes exist + acquires the AudioContext when the
      store flag flips, regardless of who flipped it) instead of
      maintaining a redundant local flag. Verified in-browser: clicking
      Header's Play/Stop now visibly drives the Sequencer's playhead and
      button state, and vice versa.
- [x] **R2-5 — BPM could silently diverge between Header and Sequencer**
      Same root cause as R2-4 — Header edited `projectStore.currentProject.bpm`,
      Sequencer played from its own separately-persisted local `bpm`. Fixed
      by the same change: Sequencer now reads/writes `bpm` through
      `projectStore` directly (no more separate `bpm` in its own
      localStorage session), so there's one source of truth. Verified:
      typed 150 into Header's BPM field, Sequencer's panel showed 150
      instantly, no refresh needed.
- [x] **R2-6 — StrictMode double-fires drum hits in dev** (`src/components/features/Sequencer.tsx`)
      The tick interval's `setCurrentStep` updater had a side effect
      (`playHit`) inside it. React 18 StrictMode deliberately double-invokes
      `setState` updaters to catch exactly this kind of impurity, so every
      tick played doubled/flanged in development. Split into a pure step
      advance (interval callback) and a separate `useEffect` keyed on
      `currentStep` that does the actual `playHit` side effect — the
      React-idiomatic separation. Also fixed a related stale-closure risk in
      the same code (the interval callback now reads the live step via
      `useProjectStore.getState()` rather than closing over a value).
- [x] **R2-7 — Unsafe `JSON.parse` on localStorage data could crash Mixer/Sequencer**
      (`src/stores/mixStore.ts`, `src/components/features/Sequencer.tsx`) A
      stale/hand-edited/older-schema mixer snapshot or saved pattern would
      be trusted wholesale (`set(snapshot)` / `setPattern(entry.pattern)`)
      with no shape validation, and downstream renders read `tracks[id]`/
      `pattern[id]` with no optional chaining — a missing key would crash
      the whole tab. Added `sanitizeSnapshot()` to `mixStore.ts` (fills gaps
      from defaults instead of trusting the parsed shape) and a shape filter
      on the saved-pattern list load in `Sequencer.tsx` (drops any entry
      missing an instrument key instead of ever offering it in the dropdown).
- [x] **R2-8 — `LocalLearning`'s client-side generation counter contradicted the real server limit**
      (`src/ai/LocalLearning.js`, `src/ai/AIWorkflow.js`) It was a lifetime
      cap (`generationCount` vs. a hardcoded `generationLimit: 50`) with no
      daily reset, computed and shipped to the backend as
      `generation_limit_ok` — but nothing in the frontend ever gated on the
      result, so it was inert today and a landmine for whenever someone
      wired it up (a user hitting 50 lifetime generations would be
      permanently blocked client-side while the server's real daily limit
      keeps resetting). Removed the dead counter/limit tracking entirely
      (kept `recordFeedback`/genre preferences, which are a separate,
      legitimate, non-contradictory feature); `generation_limit_ok` is now
      just a hardcoded `true` with a comment explaining the backend never
      trusts it anyway.
- [x] **R2-9 — Stale/misleading comment in `main.tsx`**
      Claimed `App.tsx` imports `src/lib/supabase.ts` as the reason for the
      dynamic-import safety net; verified (again) that nothing in `src/`
      imports that module. Reworded to describe the guard as defensive
      rather than reacting to a live code path that doesn't exist.

### Strategic/concept review findings (not yet acted on, logged for a product decision)

A separate pass evaluated the app holistically rather than hunting bugs.
Headline finding: the product markets itself as "AI-powered professional
music production" but the honest implementation is a step sequencer with
rules-based (not ML) generation, wrapped in DAW-flavored UI that promises
more than it delivers. Specific gaps: no audio export exists at all; the
**Mixer's effects (reverb/delay/EQ/stereo-width) are pure UI state that
never touches the actual audio graph** — sliders move, sound doesn't change,
identified as the single weakest link since it's the most "professional"-
looking surface and the most hollow; "Plugin Host Bridge" implies DAW
interop (Ableton/FL Studio) that doesn't exist, it's a text generator;
Dashboard stats are fabricated/hardcoded; Voice Clone is a dead top-level
nav tab; persistence is localStorage-only despite a real Supabase project
now existing. Top 5 recommended fixes by impact/achievability: (1) real WAV
export via `OfflineAudioContext` — the audio graph already exists, this is
reachable; (2) make Mixer effects actually process audio; (3) replace
fabricated Dashboard data or label it as sample content; (4) move project
persistence server-side; (5) ship or remove Voice Clone as a nav tab.

**Decision 2026-09-10: all 5, full effort.** Working through them in order,
each shipped as its own PR:

- [x] **S1 — Mixer effects didn't touch the audio graph** (`src/components/features/Sequencer.tsx`)
      Volume/pan/mute/solo/master-volume/stereo-width were already real
      (computed directly into gain/pan values in `playHit`) — the actual gap
      was narrower than the review implied: highpass/lowpass EQ, reverb,
      delay, and the limiter were computed nowhere and never inserted into
      the graph; every instrument connected straight to `ctx.destination`.
      Added a persistent master bus (built once per `AudioContext`, not
      per-hit, so reverb tails carry over between hits): a
      `DynamicsCompressorNode` for the limiter (threshold/ratio set live
      from the mixer's `limiter` switch — near-transparent when off, real
      limiting when on), a `ConvolverNode` with a procedurally-generated
      exponential-decay stereo impulse response for reverb, and a feedback
      `DelayNode` for delay. Every instrument now routes through a per-hit
      highpass→lowpass filter pair (from the track's EQ knobs) into the dry
      signal plus conditional reverb/delay sends, all previously-fake sliders
      now real. Verified by instrumenting `AudioContext.prototype` to count
      node creation during live playback: master bus nodes created exactly
      once (compressor/convolver/delay), highpass/lowpass filters created on
      every hit; fresh-tab console clean through a full play/stop cycle.
- [x] **S2 — No audio export existed at all** (`src/components/features/Sequencer.tsx`)
      Added a real "Export WAV" button. Renders the current pattern (one
      loop, plus a 2.5s tail so reverb/delay can decay) through an
      `OfflineAudioContext`, reusing the *exact same* synthesis functions and
      mixer chain (`buildTrackChain`/the new `createMasterBus`, refactored
      out of S1's live-playback code so both paths share one implementation
      rather than diverging) — what you hear in the sequencer is what you
      get in the file, not a separate re-implementation. Encodes the
      rendered `AudioBuffer` to a 16-bit PCM WAV via a small manual encoder
      (no new dependency needed) and triggers a browser download. Verified:
      confirmed `OfflineAudioContext` rendering produces real non-zero audio
      samples in this environment; confirmed the WAV encoder produces a
      well-formed file (correct RIFF/WAVE/data chunk tags, exact expected
      byte size) using the same encoding logic; ran the actual in-app export
      end-to-end with no console errors, button correctly re-enabled after
      completion. (Hit and fixed an unrelated Vite dev-server hiccup along
      the way: a stale pre-bundled dependency chunk needed a cache clear —
      not a code bug, just a dev-server quirk from adding a new icon import.)
- [x] **S3 — Dashboard stats were fabricated/hardcoded** (`src/components/features/Dashboard.tsx`)
      "24 Projects Created," "156 AI Generations," "42h Studio Time," "Pro"
      membership, and a 4-card "Recent Projects" list were all hardcoded
      numbers/names with no data behind them.
      - **Saved Patterns** (replaces "Projects Created," which had nothing
        real to count against — there's no multi-project system): real count
        read from Sequencer's saved-pattern library in localStorage.
      - **AI Generations**: real count from the Supabase `ai_generations`
        table via a new `GET /stats/generations` backend endpoint
        (`backend/services/db.py:count_all_generations`); shows `···` while
        loading and `—` (not a fake number) if the backend/Supabase is
        unavailable.
      - **Studio Time**: genuinely measured now. New `src/lib/studioTime.ts`
        accumulates real elapsed time in localStorage every 15s while the
        tab is visible (started once from `App.tsx`), replacing a number
        that was never tracked at all.
      - **Membership**: changed "Pro" → "Free" — there's no billing system,
        so claiming a paid tier was an outright false claim, not just an
        optimistic placeholder.
      - **Recent Patterns** (replaces "Recent Projects"): shows the real
        saved-pattern library (name/genre/relative time from a new
        `savedAt` timestamp added to the saved-pattern schema in
        `Sequencer.tsx`, optional so old entries without one still load
        fine), with an honest empty state instead of always showing 4 fake
        cards.
      Verified in-browser: fresh load showed 0/0/`<1m`/Free with an honest
      empty state; saved a real pattern in the Sequencer, confirmed the
      Dashboard's count and the Recent Patterns card updated to reflect it
      on next visit, showing the real name/genre/"just now" timestamp.
      (Also discovered and worked around an unrelated dev-environment
      quirk: uvicorn's `--reload` StatReload was serving a stale import
      snapshot on Windows in this environment, silently 404ing a brand new
      route even after a full process restart — confirmed by testing
      without `--reload`, where the same code worked immediately. Not a
      code bug; noted for whoever runs this backend locally on Windows.)
- [x] **S4 — Voice Clone dead nav tab; "Plugin Host Bridge" implied fake DAW interop**
      A permanently disabled top-level nav tab erodes trust more than the
      backend/AI fallback does, since at least that one warns you; a nav
      item that's dead every single time you click it doesn't. And "Plugin
      Host Bridge" reads like a live connection to Ableton/FL Studio —
      it's actually just generated preset-recipe text (song title, preset
      name, parameter values), no plugin ever gets loaded or connected.
      - Removed Voice Clone from the persistent Sidebar nav entirely
        (`Sidebar.tsx`, `App.tsx`'s `TabType`/render switch,
        `Dashboard.tsx`'s prop type) — matches the same call already made
        for F7's dead router scaffolding.
      - Dashboard's "Voice Cloning" quick-start card and AI Studio's
        "Upgrade to Add Vocals" CTA both kept (as honest premium teasers,
        same pattern as elsewhere) but their buttons are now properly
        `disabled` with a "coming soon" tooltip instead of silently
        navigating to a dead tab or doing nothing on click.
      - Relabeled "Plugin Host Bridge" → "Target DAW / Host" and "Plugin
        Chain Preview" → "Suggested Plugin Chain", with an explicit note
        ("not loaded or connected automatically, set these up yourself in
        your DAW") instead of implying live interop.
      Verified in-browser: sidebar shows 5 icons, not 6; clicking the now-
      disabled "Upgrade to Pro" card button does nothing (confirmed by
      screenshot — stayed on Dashboard); AI Studio shows the relabeled
      "Target DAW / Host" section; no console errors.
- [~] **S5 — Persistence was localStorage-only despite a real Supabase project existing**
      Added real server-side persistence for the saved-pattern library
      (the "projects" S3 already made real on the Dashboard). New
      `saved_patterns` Supabase table (`supabase/migrations/0002_saved_patterns.sql`,
      same access model as 0001 — RLS on, no anon policies, service_role
      only) plus three new backend endpoints: `POST /patterns` (upsert),
      `GET /patterns?user_id=` (list), `DELETE /patterns/{id}` (not wired
      to any UI yet — no delete-saved-pattern button exists — but there for
      when one does). `Sequencer.tsx`'s `savePattern` now fire-and-forgets a
      real save to the backend after its existing local save (never blocks
      or interrupts the local-save UX on failure — just a quiet
      `console.warn`); `loadSavedPatterns` tries the server first and, if
      reachable, treats it as canonical and self-heals localStorage from
      it, otherwise falls back to the existing local-only behavior
      unchanged — works fully offline either way.
      **Scope note**: this covers the saved-pattern library specifically,
      not `projectStore`'s `currentProject` or Sequencer's own
      in-progress session state (bpm/pattern-in-editor/etc, still
      localStorage-only) — those weren't part of what Dashboard surfaces
      as "projects," so extending this further is a separate, larger
      change if wanted later.
      Marked in-progress (`[~]`) rather than done: the migration SQL needs
      to be run manually in the Supabase SQL Editor (same as 0001 — no
      direct DB write access from here) before this actually persists
      anywhere; until then it fails open exactly like every other Supabase
      write in this backend (verified: `POST /patterns` → `{"saved":false}`,
      `GET /patterns` → `{"patterns":null}`, no crash, local save/load still
      works normally). Flip to `[x]` once the migration's been run and
      confirmed.

---

## Real AI provider wired up (2026-09-08)

Talked with Carrie directly to unblock the two "no real access/credentials"
items from earlier:

- **Real Supabase project connected.** The `onspace.ai` URL in `.env`/
  `backend/.env` was stale/wrong — updated both to the actual project
  (`https://lehcpkdtusqjxyevqxsx.supabase.co`) with real anon key
  (frontend) and service-role key (backend, local `.env` only, gitignored).
  A Postgres password was shared in chat during this — not stored or used
  anywhere (not needed; both keys above are separate JWTs), flagged to
  rotate it if that history isn't private enough.
- **Real AI chat/generation provider**: not OnSpace — it's a local LAN GPU
  broker (`blackbetty1:11434`) running Ollama, OpenAI-API-compatible, no
  auth. `backend/services/pulse.py` now points at it via
  `ONSPACE_AI_BASE_URL`/`ONSPACE_AI_MODEL` env vars (API key made optional
  since the broker needs none). Currently using `llama3.2:3b` (small/fast)
  rather than `qwen3:14b` due to broker contention at setup time — bump
  back up once the machine has headroom.
  - **Important: Supabase edge functions (`generate-music`, `pulse-chat`)
    cannot reach this broker** — they run in Supabase's cloud, not on the
    LAN. Real AI only works through the local FastAPI backend (which the
    frontend already talks to via the `/api` proxy). The edge functions
    remain orphaned for this purpose regardless of B11/B12's deploy status.
- **Found and fixed while wiring this up**: `python-dotenv` was a listed
  dependency but `load_dotenv()` was never actually called anywhere —
  `backend/.env` had never been loaded automatically. Added the call to
  `app/main.py`. This also exposed a latent bug: `os.getenv(KEY, default)`
  only applies its default when `KEY` is fully unset, not when set-but-blank
  — `backend/.env`'s empty `GENERATION_DAILY_LIMIT=`/`CORS_ALLOWED_ORIGINS=`
  placeholders were silently breaking `int()` parsing and collapsing CORS to
  block everything, once the file was actually being read. Fixed both to
  `os.getenv(KEY) or default`.
- **Verified end-to-end**: direct backend call answered correctly ("house
  music is 118-130 BPM") in ~20s after unloading a contending 32B model
  that had been sitting loaded on the broker (`deepseek-r1:32b`, mostly
  CPU-offloaded — very slow). Bumped the backend's upstream timeout to 90s
  as a safety margin for slow-but-working responses.

---

## Backend lane (ours)

- [x] **B1 — Bypassable "legal enforcement"** (`backend/services/legal.py:4-8`)
      `enforce_phase0` trusts client-supplied `license_ok`/`generation_limit_ok`
      booleans with no server-side check. Any caller can send `true` and skip
      licensing/rate-limits entirely.
      *(Fixed 2026-09-07 — dropped the client-trust check entirely per product
      decision: no licensing/subscription model exists yet, so nothing real to
      check. Replaced with a real server-tracked daily generation cap per
      `user_id`, counted from the `ai_generations` table via
      `services/db.py:count_recent_generations`. Configurable via
      `GENERATION_DAILY_LIMIT` env var (default 20). Fails open — allows the
      request — if Supabase isn't configured or the count query errors, so a
      DB hiccup can't block all generation. Real licensing is still an open
      product decision — B1 only closes the "trivially bypassable" part.)*
- [ ] **B2 — No auth on any backend endpoint** (`backend/app/main.py:44-127`)
      `user_id` is free text, no session/JWT verification. Anyone can write
      feedback/MIDI/training records under an arbitrary `user_id`.
      **Decision 2026-09-07:** holding off — there's no login/session UI in
      the frontend yet, so backend JWT verification would have nothing to
      verify against. Needs a cross-lane design (frontend login flow +
      backend verification) before this can be done for real. Not a quick fix.
- [x] **B3 — Invalid CORS config** (`backend/app/main.py:18-24`)
      `allow_origins=["*"]` + `allow_credentials=True` is spec-invalid and
      browser-behavior-dependent.
      *(Fixed 2026-09-07 — set `allow_credentials=False` since this API has no
      cookie/session auth to protect; origins now configurable via
      `CORS_ALLOWED_ORIGINS` env var, comma-separated, defaults to `*` for
      local/LAN dev. Verified via OPTIONS preflight: no
      `access-control-allow-credentials` header present anymore.)*
- [x] **B4 — Service-role Supabase key used as primary DB client** (`backend/services/db.py:19`)
      Bypasses Row Level Security; combined with B2/B3 = any request has full
      table access.
      *(Resolved 2026-09-09 — turned out the real Supabase project had zero
      tables at all (the backend's writes had been silently no-op-ing this
      whole time, caught by the B8 fix). Created `ai_generations`,
      `ai_feedback`, `midi_files`, `training_batches` via
      `supabase/migrations/0001_backend_tables.sql`, RLS enabled on all four
      with no anon/authenticated policies — since there's no real per-user
      auth yet (B2), the honest move is to lock those roles out entirely
      rather than write a policy that can't mean anything without a real
      user to scope it to. `service_role` bypasses RLS regardless of
      policies, so the backend (which only ever uses
      `SUPABASE_SERVICE_KEY`) keeps full access with zero code change needed.
      Verified directly: anon-key INSERT → 401 RLS violation; service-key
      INSERT → 201. Verified through the actual backend: a real
      `/generate/drums` call, confirmed the row landed in `ai_generations`
      with the right payload. This also means B1's daily generation-limit
      check is now for real enforceable — it was previously always failing
      open since `count_recent_generations` had no table to query.)*
- [x] **B5 — Committed `.env` with live Supabase project URL** (`.env`, repo root)
      Should be `.env.example` + gitignored (frontend anon key; separately verify
      no service keys are ever committed).
      *(Fixed 2026-09-07 — `git rm --cached .env`, added `.env`/`backend/.env`
      to `.gitignore`, added a proper `.env.example` with empty placeholders.
      The local `.env` file is untouched on disk so existing dev setups keep
      working. Note: only the anon key (meant to be public per Supabase's
      model, protected by RLS) was in it, not a service key — verified no
      service-role keys are or have been committed anywhere in this repo. The
      exposed anon key/URL are still visible in prior git history; true
      rotation would mean regenerating the anon key in the Supabase dashboard
      — didn't do that since it's a live project decision, flagging for you.)*
- [x] **B6 — Most "AI generation" is hardcoded stub data** (`backend/models/inference.py:80-125`)
      bassline/melody/chords/arrangement ignore mood/complexity/density/preferences,
      return same static pattern per genre. Only drums do anything real.
      *(Fixed 2026-09-07, per product decision: "procedural rules upgrade" —
      not an ML model, but real music-theory-based generation. Added
      `backend/models/music_theory.py`: deterministic key/scale selection
      per genre+mood (major for Energetic/Uplifting/Epic, minor for
      Dark/Chill/Minimal), diatonic chord progressions with real triad-quality
      computation (major/minor/diminished, +7ths at high complexity), a
      constrained random-walk melody generator whose step size scales with
      complexity and note count scales with density, a walking bassline
      following the chord progression's roots with complexity-driven passing
      tones, and an arrangement length that grows with complexity. Same
      (genre, mood, complexity, density) always produces the same output
      (seeded), different inputs genuinely produce different output — verified
      across all 6 genre/mood combos and via live HTTP calls to all four
      endpoints. `generate_drums` was already real (patterns.json-backed);
      untouched.)*
- [x] **B7 — Pulse chat backend is a hardcoded placeholder** (`backend/app/main.py:89-92`)
      Always returns the same string; `conversationHistory` accepted but unused.
      *(Fixed 2026-09-07 — added `backend/services/pulse.py`, calling the same
      AI provider ("OnSpace AI") the orphaned `pulse-chat` Supabase edge
      function already called (see B11), reusing its `ONSPACE_AI_BASE_URL`/
      `ONSPACE_AI_API_KEY` env vars and system prompt. `/pulse/chat` now
      returns a real reply or a clean `502` with a real error message instead
      of always succeeding with canned text. `conversationHistory` is now
      actually used (last 6 messages). Verified locally: returns
      `502 {"detail":"AI service not configured"}` since no key is set on this
      VM yet — correct honest behavior. No frontend changes needed, since
      AIClient.js already posts to `/api/pulse/chat` unchanged.)*
- [x] **B8 — Backend swallows all Supabase insert errors** (`backend/services/db.py`)
      No try/except around `.insert().execute()` calls; a transient DB hiccup
      after a successful generation 500s the whole request.
      *(Fixed 2026-09-07 — all inserts now go through a shared `_insert()`
      helper that catches and logs exceptions instead of propagating them;
      persistence failures no longer turn a successful generation into a 500.)*
- [x] **B9 — Bare `except:` masks patterns.json load failures** (`backend/models/inference.py:8-12`)
      Any failure (missing file, bad JSON, permissions) silently falls back to
      `{}` with no log/warning.
      *(Fixed 2026-09-07 — narrowed to `(OSError, json.JSONDecodeError)` and
      added `logger.exception(...)` so a bad patterns file is visible in logs
      instead of silently degrading every drum request to random generation.)*
- [x] **B10 — corrected, was a false positive** (`backend/training/*.py`, `backend/models/train_drums.py`)
      Original claim: "will `ModuleNotFoundError` immediately" because no
      `training/__init__.py` exists and no ML libs are listed. *(Checked
      2026-09-07 — verified by actually importing and running
      `models.train_drums.run(...)`: it works. `training/` is a valid Python
      3 implicit namespace package (no `__init__.py` needed since 3.3), and
      every function in `training/*.py` (`train`, `preprocess`,
      `build_dataset`, `evaluate`, `schedule_retraining`) is a trivial no-op
      stub with zero imports beyond `datetime` — no ML libs are actually used
      anywhere yet, so there's nothing to be missing. The real gap here is
      the same shape as B6: this is 100% placeholder scaffolding with no real
      training logic. Folding the "real gap" half of this into B6's scope
      rather than tracking separately.)*
- [x] **B11 — Two deployed Supabase edge functions are dead code**
      (`supabase/functions/generate-music`, `supabase/functions/pulse-chat`)
      Nothing in `src/` calls them; frontend talks only to the FastAPI backend
      via `/api` proxy. Decide: wire them up or remove them.
      *(Resolved 2026-09-09 — deleted. Now confirmed (see the real-AI-provider
      section above) that Supabase edge functions run in Supabase's cloud and
      structurally cannot reach the LAN-only AI broker (`blackbetty1`) that
      this app actually uses — there's no path to making them work for their
      intended purpose here regardless of deploy access. `pulse-chat`'s logic
      already lives in `backend/services/pulse.py` (ported when fixing B7);
      `generate-music`'s logic was never used anywhere. Removed
      `supabase/functions/` entirely — same call already made for F7's dead
      router scaffolding. If these were ever deployed live on the Supabase
      project, they still exist there until someone runs
      `supabase functions delete generate-music pulse-chat` — I don't have
      deploy access to do that myself.)*
- [x] **B12 — Wildcard CORS + no rate limiting on edge functions** (`supabase/functions/_shared/cors.ts:1-4`)
      A leaked anon key lets anyone burn AI API budget with no validation.
      *(Resolved 2026-09-09 as part of B11 — moot now that the edge functions
      are deleted; there's nothing left to rate-limit or lock down CORS on.
      The input-validation work done on 2026-09-07 (required fields, length
      caps) is gone with the files, which is fine since it was mitigating a
      risk that no longer exists.)*
- [x] **B13 — Unchecked AI response shape in edge functions**
      (`supabase/functions/generate-music/index.ts:59`, `pulse-chat/index.ts:61`)
      `data.choices[0].message.content` assumes well-formed response; throws
      raw TypeError on unexpected shape.
      *(Moot as of 2026-09-09 — files deleted as part of B11. The equivalent
      fix already exists for the real chat path in
      `backend/services/pulse.py` (`get_pulse_reply`'s response-shape check).)*
- [x] **B14 — Client-side-only generation limit, not enforced server-side** (`src/ai/LocalLearning.js:38-46`)
      Trivially bypassed via clearing localStorage; backend never independently
      checks a real limit (ties into B1).
      *(Resolved 2026-09-07 as part of B1 — the backend now enforces a real
      server-side daily cap via `services/legal.py`/`count_recent_generations`,
      independent of anything the client sends or has in localStorage.
      `LocalLearning.js`'s client-side counter is still there for UI/UX
      purposes (showing the user their usage) but is no longer the actual
      enforcement mechanism — that's fine, it's just no longer load-bearing.)*
- [x] **B15 — Duplicate/diverging fake drum generator, dead code** (`src/ai/DrumEngine.js`)
      Never imported anywhere; structurally different from `AIWorkflow.js`'s
      fallback generator. Decide: delete or consolidate.
      *(Confirmed 2026-09-07 — grepped `src/` for `DrumEngine`, zero matches
      anywhere including the filename itself. Deleted as part of the
      frontend quick-wins batch.)*

## Frontend lane (Carrie)

- [x] **F1 — Duplicate `saveToLibrary` declaration** (`src/components/features/Sequencer.tsx`)
      Broke esbuild dependency scan, blocked dev server from starting entirely.
      *(Fixed 2026-09-07 — removed dead duplicate at former line 646.)*
- [x] **F2 — Frontend silently fakes AI results on any backend failure** (`src/ai/AIWorkflow.js:66-141`)
      Bare `catch {}` on every fetch failure substitutes `Math.random()` patterns
      or canned text, no user-facing indication generation failed.
      *(Fixed 2026-09-07, per product decision: toast warning + badge. Every
      `AIWorkflow` generator now returns an `isFallback` flag. Wired into both
      call sites: `AIStudio.tsx` shows a destructive toast per stage
      ("&lt;Stage&gt; generated offline") and tags the stage row with a small
      amber "Offline" badge (tooltip explains why); `Sequencer.tsx`'s
      "Generate AI Beat" button shows the same kind of toast instead of
      always claiming "AI Beat Generated!" regardless of what actually
      happened. Verified in-browser: stopped the FastAPI backend, generated
      a beat, confirmed the "Beat generated offline" toast fired with the
      honest description; restarted the backend, generated again, confirmed
      the request returned 200 (real path) this time.)*
- [x] **F3 — Playback ignores live pattern/BPM edits** (`src/components/features/Sequencer.tsx:564-594`)
      Stale closure in `setInterval` over `pattern`/`bpm` at Play time.
      *(Fixed 2026-09-07 — added a `patternRef` kept in sync during render so
      the running interval always reads the current pattern (fixes step
      toggles doing nothing mid-playback); extracted interval creation into
      `scheduleTicks()` and added a `useEffect` on `bpm` that restarts the
      interval at the new tempo when it changes while playing. Verified
      in-browser: toggled a step mid-playback (note count updated instantly,
      no interruption), dragged BPM from 124→140 mid-playback (step counter
      kept advancing cleanly, no stutter/crash).)*
- [x] **F4 — BPM field accepts NaN** (`src/components/layout/Header.tsx:49`)
      `parseInt('')` on emptied field writes `NaN` into the project store.
      *(Fixed 2026-09-07 — `setBPM` in `projectStore.ts` now guards with
      `Number.isFinite` and clamps to 60-200. Verified in-browser: clearing
      the field snaps back to the last valid value instead of going NaN.)*
- [x] **F5 — Stop button bypasses store's own stop logic** (`src/components/layout/Header.tsx:33-42`)
      Calls `setState` directly instead of a dedicated stop/toggle action.
      *(Fixed 2026-09-07 — added a real `stop()` action to `projectStore.ts`,
      Header now calls it instead of reaching in with raw `setState`.)*
- [x] **F6 — PulseAssistant sends stale conversation history** (`src/components/features/PulseAssistant.tsx:24-39`)
      History built from pre-update `messages` array, always one message behind.
      *(Fixed 2026-09-07 — the just-sent message is now appended explicitly
      to the history payload. Verified in-browser: sent a message, confirmed
      the request reached the backend correctly.)*
- [x] **F7 — No React Router mounted despite dependency present** (`src/App.tsx`, `src/main.tsx`)
      `Index.tsx`/`NotFound.tsx` unreachable dead code; `NotFound` would throw
      if ever rendered outside a Router (`useLocation`).
      *(Resolved 2026-09-07, per product decision: the app doesn't need
      URL-based navigation (no deep-linking/bookmarking use case), so removed
      the dead scaffolding instead of building routing nobody needs — deleted
      `src/pages/Index.tsx` and `src/pages/NotFound.tsx`, uninstalled
      `react-router-dom` via npm (updates package.json + lockfile cleanly).
      Verified: typecheck clean, app loads fine.)*
- [x] **F8 — No persistence anywhere** (`src/stores/*.ts`, `src/App.tsx` activeTab state)
      No Zustand `persist` middleware; refresh silently loses entire session,
      no autosave/warning.
      *(Fixed 2026-09-07 — added Zustand `persist` middleware to
      `projectStore.ts` (localStorage-backed, only `currentProject` persisted,
      not the transient `isPlaying`/`currentStep` playback state). **Important
      discovery made while verifying this**: `Sequencer.tsx` — the actual
      step-grid editing surface — never used `projectStore` at all; its
      `pattern`/`bpm`/genre-mood-style/complexity/density are entirely
      separate local `useState`, completely disconnected from the store. So
      persisting `projectStore` alone would NOT have fixed the real pain
      point (losing sequencer edits on refresh). Per follow-up decision, also
      added a separate localStorage-backed session save/restore directly in
      `Sequencer.tsx` (validates shape on load, falls back to defaults if
      corrupt/missing). Verified in-browser: added 2 notes + changed BPM to
      140, reloaded the page, both fully restored. `App.tsx`'s `activeTab`
      remains unpersisted (minor, low-stakes — just which tab was open).)*
- [x] **F9 — Supabase client throws at module load if env vars missing** (`src/lib/supabase.ts:6-8`)
      No ErrorBoundary anywhere in the app; misconfigured deploy = instant
      white screen.
      *(Fixed 2026-09-07 — note: `src/lib/supabase.ts` is currently unused
      anywhere in `src/` — grepped, zero imports — so this specific throw is
      latent, not yet reachable in practice. Fixed anyway since it'll bite
      the moment someone wires up real Supabase calls. Since the throw
      happens at module-load time (before React mounts), a React
      `ErrorBoundary` alone can't catch it — added one anyway for genuine
      render-time errors, plus switched `main.tsx` to a dynamic `import()`
      of `App.tsx` with a `.catch()` that renders a shared `ErrorScreen`
      component on either failure path. Verified both paths: temporarily
      blanked the Supabase env vars (confirmed app still loads fine today,
      since nothing imports the module) and separately injected a
      synthetic top-level throw into App.tsx, confirmed the error screen
      renders instead of a white screen, then reverted the test throw.)*
- [x] **F10 — Missing type import breaks compilation** (`src/plugins/pluginManager.ts:31`)
      `PluginCategoryConfig` used in return type, never imported.
      *(Fixed 2026-09-07 — added the missing import. Typecheck confirms the
      error is gone; 3 unrelated pre-existing errors elsewhere untouched.)*
- [x] **F11 — No error handling around audio decode** (`src/audio/sampleManager.ts:26-42`)
      Corrupt/oversized/unsupported sample file throws unhandled promise
      rejection; no size cap; no cleanup of old buffers (memory leak risk).
      *(Fixed 2026-09-07 — note: the one current caller (`Sequencer.tsx`'s
      `handleSampleFiles`) already wraps `loadAudioFile` in try/catch, so
      this wasn't actually unhandled in practice today; hardened the
      utility itself anyway since other future callers might not wrap it.
      Added a 50MB file-size cap (checked before reading/decoding) and
      normalized `decodeAudioData`'s reject callback to always produce a
      real `Error` with a usable message, since some browsers can reject
      with a bare/undefined value. Re: "memory leak" — `removeSample`
      already exists and drops the array reference, which is sufficient
      for GC to reclaim an `AudioBuffer` (no manual dispose API exists for
      it); the real risk was only the missing size cap, now addressed.)*
- [x] **F12 — Dead/no-op UI controls** (multiple files)
      Header's Open/Save/Settings, Sidebar's Settings, PulseAssistant's
      Tips/Learn/Trends, App.tsx's "Upgrade to Pro" — all look clickable, do nothing.
      *(Fixed 2026-09-07 — Header's Open/Save/Settings, Sidebar's Settings,
      and App.tsx's "Upgrade to Pro" are now `disabled` with a "coming
      soon" tooltip instead of silently doing nothing (these imply real
      project I/O / settings / billing work that's out of scope here).
      PulseAssistant's Tips/Learn/Trends were simple enough to actually
      wire up instead of just disabling — they now send a real preset
      prompt through the existing chat flow. Verified in-browser: buttons
      render visibly dimmed, clicking Trends sent its prompt and got the
      expected response (fallback message, since no AI key is configured
      on this VM).)*
- [x] **F13 — Mixer "Save Snapshot" doesn't persist anything** (`src/components/features/Mixer.tsx:83-88`)
      Just shows a toast; no data stored, no way to recall.
      *(Fixed 2026-09-07 — added real `saveSnapshot`/`loadSnapshot`/
      `hasSnapshot` to `mixStore.ts`, localStorage-backed, plus a new "Load
      Snapshot" button in the UI. Verified in-browser: randomized the mixer,
      loaded the snapshot, confirmed values actually restored.)*
- [x] **F14 — Sequencer track-count label hardcoded wrong** (`src/components/features/Sequencer.tsx:707`)
      Says "8 tracks", only 7 `INSTRUMENTS` exist.
      *(Fixed 2026-09-07 — now derives from `INSTRUMENTS.length`.)*
- [x] **F15 — Multi-file sample upload only surfaces last error** (`src/components/features/Sequencer.tsx:136-179`)
      `errorMessage` overwritten per failed file in a loop.
      *(Fixed 2026-09-07 — collects all per-file errors into an array and
      shows them combined instead of only the last one.)*

- [x] **B16 — `uv.lock` stale relative to `pyproject.toml`** (repo root)
      Adding `httpx` as a direct dependency to `pyproject.toml` (for B7's real
      `/pulse/chat`) left `uv.lock` only knowing about it transitively (via
      `supabase`'s own deps), not as a direct project dependency. If Replit's
      `uv sync` runs in a strict/frozen mode, an out-of-date lock can fail
      the build. *(Fixed 2026-09-07 — installed `uv`, ran `uv lock` to
      regenerate properly; clean 2-line diff adding `httpx` to the root
      package's direct `dependencies` list. Verified backend still boots
      after.)*

## Infra / environment (log of what's already been done)

- [x] Node.js v22.11.0, Python 3.12.7, GitHub CLI installed on VM; repo cloned to `E:\projects\BeatAddictsNEW`.
- [x] Frontend/backend dev servers running locally (frontend :5000 via Vite w/ `/api` proxy to backend :8000, per `scripts/start-replit.sh` / `replit.md` added by Carrie's Replit-config commits).
- [x] Windows Firewall opened for LAN access (rule was for :8080, **needs updating to :5000** — old port is stale after Carrie's Replit-config merge changed the dev port).
- [x] `.gitignore` updated to exclude `backend/venv/`, `__pycache__/`, `backend/.env`.
- [x] Fixed `package-lock.json` `jspdf` entry pointing at an unreachable Replit-internal registry mirror (`package-firewall.replit.local`) — rewritten to `registry.npmjs.org`.
