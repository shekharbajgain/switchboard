# Switchboard

**NYC clean-energy incentives, found and stacked.** Code for Climate · NY Tech Week 2026 · **Accelerate** track.

NYC has set aside thousands of dollars per household to switch home heating off oil and gas — but most goes unclaimed because the rules are scattered across ~6 agencies (IRS, NYSERDA, Con Edison, NYC). Switchboard asks five plain questions and returns every incentive a household can **stack**, in dollars and tons of CO₂, flags the one move that would forfeit half of it (the participating-contractor trap), and is **honest about what you don't qualify for** — refusing to show a number it can't ground.

## Run it

```bash
npm install      # once
npm run dev      # then open the printed URL (usually http://localhost:5173)
```

Runs entirely on-device — no backend, no API keys, no network calls. Offline-safe.

## How it works

```
Dataset (truth)  ->  Engine (reasoning)  ->  Narrator (plain language)  ->  UI
```

- **`src/data/incentives.ts`** — the curated dataset of real NYC/NYS/Con Edison/federal programs. The single source of truth the "AI" is allowed to speak from; grounding to it is the anti-hallucination guardrail.
- **`src/engine/engine.ts`** — eligibility, stacking, contractor-forfeit detection, claim sequencing, and the CO₂ estimate.
- **`src/engine/explain.ts`** — the plain-language narrator, with a documented seam to drop in a live LLM without weakening the guardrail.
- **`src/App.tsx`** — the 5-question wizard and the results screen (stack, climate, honesty section, claim plan, trust strip).

## Notes

- Dollar amounts are **illustrative placeholders** (labeled "verify" in-app); program names and rules are real (as of 2025).
- v1 scope: heating electrification (heat pump, insulation, induction).
- Two one-click demo personas: **Maria** (2-family, oil, moderate income) and **Darnell** (income-qualified, unlocks the free EmPower+ track).

See **`../Switchboard-Team-Guide.docx`** for the full team guide, demo script, and judge-Q&A playbook.
