# Switchboard

**NYC clean-energy incentives, found and stacked.** Code for Climate · NY Tech Week 2026 · **Accelerate** track.

NYC has set aside thousands of dollars per household to switch home heating off oil and gas — but most goes unclaimed because the rules are scattered across ~6 agencies (IRS, NYSERDA, Con Edison, NYC). Switchboard asks five plain questions and returns every incentive a household can **stack**, in dollars and tons of CO₂, flags the one move that would forfeit ~$12,500 of it (the participating-contractor trap), estimates the **yearly running cost** now vs. with a heat pump, and is **honest about what you don't qualify for** — refusing to show a number it can't ground.

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
- **`src/engine/engine.ts`** — eligibility, stacking, contractor-forfeit detection, claim sequencing, the CO₂ estimate, and the yearly running-cost comparison.
- **`src/engine/explain.ts`** — the plain-language narrator **and the visible "how it reasoned" trace**, with a documented seam to drop in a live LLM without weakening the guardrail.
- **`src/App.tsx`** — the 5-question wizard and the results screen (stack, climate, honesty section, claim plan, running-cost comparison, the "how Switchboard reasoned" panel, trust strip).

## Notes

- Program names and rules are real and kept **current for 2026** — the app already reflects that the **federal 25C tax credit expired Dec 31, 2025** (shown as "Expired", not counted) and uses Con Edison's real ~$8k NYS Clean Heat rebate. Some dollar amounts remain labeled "verify".
- v1 scope: heating electrification (heat pump, insulation, induction).
- Two one-click demo personas: **Maria** (2-family, oil, moderate income) and **Darnell** (income-qualified, unlocks the free EmPower+ track).
