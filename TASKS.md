# Beat Addicts — Gap Analysis / Bug Hunt Tracker

Generated from a full top-down audit on 2026-09-07. Grouped by owner lane per current
team split: **Carrie → frontend**, **us → backend**. Notes get appended under each
item as it's completed.

Legend: `[ ]` open · `[x]` done · `[~]` in progress

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
- [ ] **B4 — Service-role Supabase key used as primary DB client** (`backend/services/db.py:19`)
      Bypasses Row Level Security; combined with B2/B3 = any request has full
      table access. **Still open** — real fix needs B2 (auth) done first.
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
- [~] **B11 — Two deployed Supabase edge functions are dead code**
      (`supabase/functions/generate-music`, `supabase/functions/pulse-chat`)
      Nothing in `src/` calls them; frontend talks only to the FastAPI backend
      via `/api` proxy. Decide: wire them up or remove them.
      *(2026-09-07 — `pulse-chat`'s logic (system prompt, provider, env var
      names) was ported into `backend/services/pulse.py` as part of fixing B7,
      so the FastAPI backend now has real functional parity with the edge
      function. The edge function itself is still deployed and still
      unreferenced by `src/` — still needs a decision on whether to delete it
      or keep it as a documented alternative entry point.
      `generate-music/index.ts` is untouched and still fully orphaned.)*
- [~] **B12 — Wildcard CORS + no rate limiting on edge functions** (`supabase/functions/_shared/cors.ts:1-4`)
      A leaked anon key lets anyone burn AI API budget with no validation.
      *(2026-09-07 — added the achievable half: input validation (required
      fields, length caps) on both `pulse-chat` and `generate-music`, so at
      least malformed/oversized requests are rejected before hitting the AI
      provider. Left `cors.ts`'s wildcard origin alone — Supabase edge
      functions gate access via `verify_jwt` (checks the caller has a valid
      anon/user JWT), which is the real access-control layer here, not CORS;
      changing that is a Supabase project-level config decision, not a code
      fix. Real per-user rate limiting still needs a small piece of
      infra (e.g. a Supabase table tracking calls per user/IP) — not done,
      out of scope for a quick fix. **Also note: these edge function changes
      are only in the repo — they need `supabase functions deploy` to
      actually take effect, which I haven't run since it touches the live
      Supabase project.** *(2026-09-07 — checked: I don't actually have
      deploy access to wherever this runs. The project's real backend
      (`nzlodtgybdfhnmssnzlo.backend.onspace.ai` per `.env`) isn't standard
      Supabase — it's a different platform ("OnSpace"), and none of the
      Supabase projects my tools can see match it. Someone with access to
      that OnSpace/Supabase project needs to run the deploy.)*
- [x] **B13 — Unchecked AI response shape in edge functions**
      (`supabase/functions/generate-music/index.ts:59`, `pulse-chat/index.ts:61`)
      `data.choices[0].message.content` assumes well-formed response; throws
      raw TypeError on unexpected shape.
      *(Fixed 2026-09-07 — both functions now use optional chaining and
      return a clean `502 {"error":"AI service returned no content"}` instead
      of an unhandled TypeError when the upstream response is malformed.
      Same caveat as B12: needs deploying to take effect.)*
- [x] **B14 — Client-side-only generation limit, not enforced server-side** (`src/ai/LocalLearning.js:38-46`)
      Trivially bypassed via clearing localStorage; backend never independently
      checks a real limit (ties into B1).
      *(Resolved 2026-09-07 as part of B1 — the backend now enforces a real
      server-side daily cap via `services/legal.py`/`count_recent_generations`,
      independent of anything the client sends or has in localStorage.
      `LocalLearning.js`'s client-side counter is still there for UI/UX
      purposes (showing the user their usage) but is no longer the actual
      enforcement mechanism — that's fine, it's just no longer load-bearing.)*
- [ ] **B15 — Duplicate/diverging fake drum generator, dead code** (`src/ai/DrumEngine.js`)
      Never imported anywhere; structurally different from `AIWorkflow.js`'s
      fallback generator. Decide: delete or consolidate.
      *(Confirmed 2026-09-07 — grepped `src/` for `DrumEngine`, zero matches
      anywhere including the filename itself. Safe to delete. Left for Carrie
      since it's a `src/` file — frontend lane.)*

## Frontend lane (Carrie)

- [x] **F1 — Duplicate `saveToLibrary` declaration** (`src/components/features/Sequencer.tsx`)
      Broke esbuild dependency scan, blocked dev server from starting entirely.
      *(Fixed 2026-09-07 — removed dead duplicate at former line 646.)*
- [ ] **F2 — Frontend silently fakes AI results on any backend failure** (`src/ai/AIWorkflow.js:66-141`)
      Bare `catch {}` on every fetch failure substitutes `Math.random()` patterns
      or canned text, no user-facing indication generation failed.
- [ ] **F3 — Playback ignores live pattern/BPM edits** (`src/components/features/Sequencer.tsx:564-594`)
      Stale closure in `setInterval` over `pattern`/`bpm` at Play time.
- [ ] **F4 — BPM field accepts NaN** (`src/components/layout/Header.tsx:49`)
      `parseInt('')` on emptied field writes `NaN` into the project store.
- [ ] **F5 — Stop button bypasses store's own stop logic** (`src/components/layout/Header.tsx:33-42`)
      Calls `setState` directly instead of a dedicated stop/toggle action.
- [ ] **F6 — PulseAssistant sends stale conversation history** (`src/components/features/PulseAssistant.tsx:24-39`)
      History built from pre-update `messages` array, always one message behind.
- [ ] **F7 — No React Router mounted despite dependency present** (`src/App.tsx`, `src/main.tsx`)
      `Index.tsx`/`NotFound.tsx` unreachable dead code; `NotFound` would throw
      if ever rendered outside a Router (`useLocation`).
- [ ] **F8 — No persistence anywhere** (`src/stores/*.ts`, `src/App.tsx` activeTab state)
      No Zustand `persist` middleware; refresh silently loses entire session,
      no autosave/warning.
- [ ] **F9 — Supabase client throws at module load if env vars missing** (`src/lib/supabase.ts:6-8`)
      No ErrorBoundary anywhere in the app; misconfigured deploy = instant
      white screen.
- [ ] **F10 — Missing type import breaks compilation** (`src/plugins/pluginManager.ts:31`)
      `PluginCategoryConfig` used in return type, never imported.
- [ ] **F11 — No error handling around audio decode** (`src/audio/sampleManager.ts:26-42`)
      Corrupt/oversized/unsupported sample file throws unhandled promise
      rejection; no size cap; no cleanup of old buffers (memory leak risk).
- [ ] **F12 — Dead/no-op UI controls** (multiple files)
      Header's Open/Save/Settings, Sidebar's Settings, PulseAssistant's
      Tips/Learn/Trends, App.tsx's "Upgrade to Pro" — all look clickable, do nothing.
- [ ] **F13 — Mixer "Save Snapshot" doesn't persist anything** (`src/components/features/Mixer.tsx:83-88`)
      Just shows a toast; no data stored, no way to recall.
- [ ] **F14 — Sequencer track-count label hardcoded wrong** (`src/components/features/Sequencer.tsx:707`)
      Says "8 tracks", only 7 `INSTRUMENTS` exist.
- [ ] **F15 — Multi-file sample upload only surfaces last error** (`src/components/features/Sequencer.tsx:136-179`)
      `errorMessage` overwritten per failed file in a loop.

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
