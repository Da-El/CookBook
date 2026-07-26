# CookBook V2 — LLM cooking assistant (bones)

**Completely separate from V1** (social CookBook on ports 8080 / 5173).

V2 is an in-memory skeleton for:

| Feature | Status |
|---------|--------|
| Import from URL / notes / OCR / video / social | API + UI stub → structured recipe schema |
| Meal planning | Stub planner + `smart_reuse` flag |
| Ingredients → grocery list | Merge by name (LLM normalize later) |
| Step-by-step cooking | Cook mode UI |
| Multiple timers | Client countdown + session API |
| Recipe gallery | Static stub catalog |
| Smart reuse / beginner guides / cost | Schema + placeholders |

## LLM bones (SpaceXAI later)

- Trait: `grok_cookbook_v2_core::LlmProvider`
- Stub: `StubLlm` (always used today)
- Skeleton: `XaiLlm` (`XAI_API_KEY`, `https://api.x.ai/v1`, model `grok-4.5`)
- Prompts: `crates/grok-cookbook-v2-core/src/prompts.rs`

When ready:

1. Implement `XaiLlm::complete` with HTTP to xAI.
2. Change `default_provider()` to return live `XaiLlm` when key is set.
3. Parse JSON into `Recipe` / meal plan / grocery in `services.rs`.

**Never put `XAI_API_KEY` in the browser.** Only V2 API.

## Run locally

```powershell
# Terminal 1 — V2 API (8081)
cargo run -p grok-cookbook-v2-api

# Terminal 2 — V2 web (5174)
cd apps/web-v2
npm install
npm run dev
```

Or: `run-v2-api.bat` and `run-v2-web.bat` from repo root.

- **V2 UI:** http://127.0.0.1:5174  
- **V2 API health:** http://127.0.0.1:8081/healthz  
- **V2 meta:** http://127.0.0.1:8081/v2/meta  

No Postgres required for V2 bones (in-memory).

## Layout

```
crates/grok-cookbook-v2-core/   # domain + LLM + services
crates/grok-cookbook-v2-api/    # Axum on :8081
apps/web-v2/                    # React UI on :5174
v2/README.md                    # this file
```

V1 remains untouched at `apps/web` + `crates/grok-cookbook-api`.
