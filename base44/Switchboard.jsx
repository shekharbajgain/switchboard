// ===========================================================================
// Switchboard — single-file build for Base44 (paste this as one page component).
//
// Everything is here on purpose: the curated incentive DATASET (the single
// source of truth the "AI" is allowed to speak from), the reasoning ENGINE
// (stacking, the contractor-forfeit trap, sequencing, CO2), the plain-language
// NARRATOR, the full UI, and the stylesheet (injected via a <style> tag so it
// needs no external CSS or Tailwind). No backend, no API keys, nothing stored.
//
// Architecture:  Dataset (truth) -> Engine (reasoning) -> Narrator -> UI.
// The dataset constrains the AI so it can never invent a program or amount —
// that grounding is the anti-hallucination guardrail.
// ===========================================================================

import { useMemo, useState } from 'react'

const usd = (n) => `$${Math.round(n).toLocaleString()}`

// ---------------------------------------------------------------------------
// DATASET — real NYC / NYS / Con Edison / federal programs. Dollar amounts are
// ILLUSTRATIVE placeholders (labeled "verify" in the UI); names + rules are real.
// ---------------------------------------------------------------------------
const ASSUMED_PROJECT_COST = 24000

const wants = (p, m) => p.measures.includes(m)
const isOwner = (p) => p.ownership === 'own'

const PROGRAMS = [
  {
    id: 'fed-25c-hp',
    name: 'Federal Efficient Home Improvement Credit (25C) — heat pump',
    funder: 'Federal',
    kind: 'Tax credit',
    estLow: 2000, estHigh: 2000,
    claimTiming: 'Claimed on your federal taxes the year after install.',
    verifyAt: 'IRS — Energy Efficient Home Improvement Credit (25C)',
    evaluate: p =>
      wants(p, 'heat-pump')
        ? { status: 'qualifies', amount: 2000,
            reason: '30% of your heat-pump cost, capped at $2,000 — income doesn’t matter. (Verify current federal status.)' }
        : { status: 'not-applicable', reason: 'No heat pump selected.' },
  },
  {
    id: 'fed-25c-insul',
    name: 'Federal Efficient Home Improvement Credit (25C) — insulation',
    funder: 'Federal',
    kind: 'Tax credit',
    estLow: 1200, estHigh: 1200,
    claimTiming: 'Claimed on your federal taxes the year after install.',
    verifyAt: 'IRS — Energy Efficient Home Improvement Credit (25C)',
    evaluate: p =>
      wants(p, 'insulation')
        ? { status: 'qualifies', amount: 1200,
            reason: '30% of insulation & air-sealing, capped at $1,200 a year. (Verify current federal status.)' }
        : { status: 'not-applicable', reason: 'No insulation work selected.' },
  },
  {
    id: 'nys-clean-heat',
    name: 'NYS Clean Heat — heat-pump rebate (via Con Edison)',
    funder: 'Con Edison',
    kind: 'Rebate',
    estLow: 2000, estHigh: 6000,
    requiresParticipatingContractor: true,
    claimTiming: 'Applied by your contractor at install — money off the top.',
    verifyAt: 'NYS Clean Heat / Con Edison',
    evaluate: p =>
      wants(p, 'heat-pump')
        ? { status: 'qualifies', amount: 3000,
            reason: 'Utility rebate for a cold-climate heat pump, paid through a participating contractor.' }
        : { status: 'not-applicable', reason: 'No heat pump selected.' },
  },
  {
    id: 'nyserda-comfort-home',
    name: 'NYSERDA Comfort Home — insulation & air-sealing rebate',
    funder: 'New York State',
    kind: 'Rebate',
    estLow: 1000, estHigh: 4000,
    requiresParticipatingContractor: true,
    claimTiming: 'Applied by your contractor after a home assessment.',
    verifyAt: 'NYSERDA Comfort Home',
    evaluate: p =>
      wants(p, 'insulation')
        ? { status: 'qualifies', amount: 2000,
            reason: 'State rebate for sealing and insulating your home, through a participating contractor.' }
        : { status: 'not-applicable', reason: 'No insulation work selected.' },
  },
  {
    id: 'nyserda-ahp',
    name: 'NYSERDA Assisted Home Performance — moderate-income bonus',
    funder: 'New York State',
    kind: 'Rebate',
    estLow: 0, estHigh: 5000,
    requiresParticipatingContractor: true,
    claimTiming: 'Confirmed with income documents before work begins.',
    verifyAt: 'NYSERDA Assisted Home Performance with ENERGY STAR',
    evaluate: p => {
      if ((!wants(p, 'insulation') && !wants(p, 'heat-pump')) || !isOwner(p))
        return { status: 'not-applicable', reason: 'No qualifying efficiency work selected.' }
      if (p.income === 'under-67')
        return { status: 'not-applicable', reason: 'At your income you likely qualify for the free EmPower+ track instead — see below.' }
      if (p.income === '67-100' || p.income === '100-125')
        return { status: 'income-bonus', amount: 2500,
          reason: 'Moderate-income bonus — covers up to ~50% of your insulation / air-sealing cost. Matched to the income band you chose.' }
      if (p.income === 'prefer-not')
        return { status: 'unconfirmed', reason: 'This bonus depends on income, which you skipped. Add it and we’ll check — we won’t assume ~$2,500 you might not get.' }
      return { status: 'not-eligible', reason: 'Your income is above the limit for this 50% moderate-income bonus.' }
    },
  },
  {
    id: 'coned-equipment',
    name: 'Con Edison — efficient equipment rebate',
    funder: 'Con Edison',
    kind: 'Rebate',
    estLow: 500, estHigh: 500,
    claimTiming: 'Submitted to Con Edison after install.',
    verifyAt: 'Con Edison energy-efficiency rebates',
    evaluate: p =>
      wants(p, 'heat-pump')
        ? { status: 'qualifies', amount: 500,
            reason: 'Con Edison rebate for qualifying high-efficiency heat-pump equipment.' }
        : { status: 'not-applicable', reason: 'No qualifying equipment selected.' },
  },
  {
    id: 'empower-plus',
    name: 'EmPower+ — free weatherization for income-eligible households',
    funder: 'New York State',
    kind: 'Free program',
    estLow: 0, estHigh: 0,
    claimTiming: 'Income-qualified; upgrades done at no upfront cost.',
    verifyAt: 'NYSERDA EmPower+',
    alwaysSurface: true,
    evaluate: p => {
      if (p.income === 'under-67')
        return { status: 'qualifies', amount: 0,
          reason: 'You likely qualify for FREE weatherization & efficiency upgrades through EmPower+ — no upfront cost on income-qualified work.' }
      if (p.income === 'prefer-not')
        return { status: 'unconfirmed', reason: 'Free upgrades may apply if household income is under ~$67k (3-person, placeholder). You skipped income, so we won’t assume.' }
      return { status: 'not-eligible',
        reason: 'Your income is above the EmPower+ limit (~$67k for a 3-person NYC household, placeholder). We did NOT apply you here — no false promises. If your real income is lower, re-run.' }
    },
  },
  {
    id: 'heehra-induction',
    name: 'Federal Home Electrification Rebate (HEEHRA) — induction stove',
    funder: 'Federal',
    kind: 'Rebate',
    estLow: 0, estHigh: 840,
    claimTiming: 'Point-of-sale once New York’s program launches.',
    verifyAt: 'NYSERDA — federal electrification rebates rollout',
    alwaysSurface: true,
    evaluate: p =>
      wants(p, 'induction')
        ? { status: 'unconfirmed',
            reason: 'Up to ~$840 for an induction stove — but this federal rebate is state-administered and not confirmed live in New York yet. We won’t show a number we can’t ground. Check NYSERDA for rollout status.' }
        : { status: 'not-applicable', reason: 'No induction stove selected.' },
  },
  {
    id: 'nyc-solar-pta',
    name: 'NYC Solar Property Tax Abatement',
    funder: 'NYC',
    kind: 'Tax abatement',
    estLow: 0, estHigh: 0,
    claimTiming: 'Filed with NYC Dept. of Finance after a solar install.',
    verifyAt: 'NYC Department of Finance — solar property tax abatement',
    alwaysSurface: true,
    evaluate: () =>
      ({ status: 'not-applicable',
         reason: 'Applies to rooftop solar only — not heating upgrades. Out of scope for this v1, shown so you know we actually checked.' }),
  },
]

const MARIA = {
  zip: '11372', ownership: 'own', building: '2-4-family', fuel: 'oil',
  measures: ['heat-pump', 'insulation', 'induction'], income: '100-125',
}
const DARNELL = {
  zip: '10456', ownership: 'own', building: '1-family', fuel: 'gas',
  measures: ['heat-pump', 'insulation'], income: 'under-67',
}
const PERSONAS = [
  { id: 'maria', label: 'Maria · Jackson Heights', sub: '2-family, oil boiler, moderate income', profile: MARIA },
  { id: 'darnell', label: 'Darnell · the Bronx', sub: '1-family, gas, income-qualified for free upgrades', profile: DARNELL },
]

// ---------------------------------------------------------------------------
// ENGINE — reasons over the whole household: what stacks, what the wrong
// contractor would forfeit, the claim sequence, and the CO2 avoided.
// ---------------------------------------------------------------------------
const HEATING_TONS = { oil: 5.5, gas: 3.5, steam: 5.0, 'electric-resistance': 1.5, unsure: 4.0 }
const AVG_CAR_TONS = 4.6 // tons CO2 per year for an average gas car (placeholder)

function computeImpact(profile) {
  const base = profile.measures.includes('heat-pump') ? (HEATING_TONS[profile.fuel] ?? 4.0) : 0
  const insul = profile.measures.includes('insulation') ? 0.8 : 0
  const tonsPerYear = Math.round((base + insul) * 10) / 10
  const carsEquivalent = Math.round((tonsPerYear / AVG_CAR_TONS) * 10) / 10
  return { tonsPerYear, carsEquivalent, basis: 'vs. your current heating — illustrative estimate' }
}

function evaluateProfile(profile) {
  const scored = PROGRAMS.map(program => ({ program, result: program.evaluate(profile) }))

  const inStack = (s) => s.result.status === 'qualifies' || s.result.status === 'income-bonus'
  const stack = scored.filter(inStack)
  const attention = scored.filter(s =>
    s.result.status === 'unconfirmed' ||
    s.result.status === 'not-eligible' ||
    (s.result.status === 'not-applicable' && s.program.alwaysSurface),
  )

  const totalPoint = stack.reduce((sum, s) => sum + (s.result.amount ?? 0), 0)
  const rangeLow = stack.reduce((sum, s) => sum + s.program.estLow, 0)
  const rangeHigh = stack.reduce((sum, s) => sum + s.program.estHigh, 0)

  const projectCost = ASSUMED_PROJECT_COST
  const outOfPocket = Math.max(0, projectCost - totalPoint)
  const percentOff = projectCost > 0 ? Math.round((totalPoint / projectCost) * 100) : 0

  const gated = stack.filter(s => s.program.requiresParticipatingContractor)
  const contractorGatedTotal = gated.reduce((sum, s) => sum + (s.result.amount ?? 0), 0)
  const contractorGatedNames = gated.map(s => s.program.name)

  const federal = stack.filter(s => s.program.funder === 'Federal')
  const federalTotal = federal.reduce((sum, s) => sum + (s.result.amount ?? 0), 0)
  const stateUtilTotal = totalPoint - federalTotal

  const hasIncomeBonus = stack.some(s => s.result.status === 'income-bonus')

  const claimPlan = []
  claimPlan.push({ text: 'Book a free home energy assessment — it’s the on-ramp to the NYSERDA programs and confirms what your home actually needs.' })
  if (contractorGatedTotal > 0)
    claimPlan.push({ warn: true, text: `Choose a NYS Clean Heat participating contractor BEFORE any work. Use a non-participating contractor and you forfeit ≈${usd(contractorGatedTotal)} in stacked rebates.` })
  if (hasIncomeBonus)
    claimPlan.push({ text: 'Submit income documentation for the moderate-income bonus before work begins — it can’t be added back later.' })
  claimPlan.push({ text: 'Install your heat pump and insulation with the participating contractor.' })
  if (stateUtilTotal > 0)
    claimPlan.push({ text: `Your utility & state rebates (≈${usd(stateUtilTotal)}) come off the top at install — you don’t front that money.` })
  if (federalTotal > 0)
    claimPlan.push({ text: `Claim your federal tax credits (≈${usd(federalTotal)}) when you file — they arrive at tax time, not upfront.` })

  return {
    stack, attention, totalPoint, rangeLow, rangeHigh, projectCost, outOfPocket,
    percentOff, contractorGatedTotal, contractorGatedNames, federalTotal, stateUtilTotal, claimPlan,
    impact: computeImpact(profile),
  }
}

// ---------------------------------------------------------------------------
// NARRATOR — the plain-language half of the AI. Drop-in seam: swap this for a
// grounded LLM call; because it only speaks from `outcome` (dataset-bound), the
// anti-hallucination guarantee is unchanged.
// ---------------------------------------------------------------------------
const fuelWord = {
  'oil': 'oil', 'gas': 'gas', 'electric-resistance': 'electric-baseboard',
  'steam': 'steam', 'unsure': 'its current',
}
const buildingWord = {
  '1-family': 'single-family home', '2-4-family': '2–4 family home',
  'coop-condo': 'co-op / condo', 'larger': 'larger building',
}

function narrate(profile, outcome) {
  const where = profile.zip ? `in ${profile.zip}` : 'in NYC'
  const home = `${profile.ownership === 'own' ? 'owner-occupied ' : ''}${buildingWord[profile.building]}`
  const n = outcome.stack.length
  const dollars = `$${Math.round(outcome.totalPoint).toLocaleString()}`
  const lead = `For an ${home} ${where} heating with ${fuelWord[profile.fuel]} heat, going electric unlocks ${n} program${n === 1 ? '' : 's'} worth about ${dollars} — roughly ${outcome.percentOff}% of a typical $${outcome.projectCost.toLocaleString()} project.`
  const theCatch =
    outcome.contractorGatedTotal > 0
      ? ` The catch most people miss: about $${Math.round(outcome.contractorGatedTotal).toLocaleString()} of it only survives if you pick a participating contractor first.`
      : ''
  return lead + theCatch
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const OWNERSHIP = [
  { value: 'own', label: 'I own it', sub: 'House, co-op, or condo you own' },
  { value: 'rent', label: 'I rent', sub: 'Some programs still apply' },
]
const BUILDING = [
  { value: '1-family', label: '1-family house' },
  { value: '2-4-family', label: '2–4 family house' },
  { value: 'coop-condo', label: 'Co-op / condo' },
  { value: 'larger', label: 'Larger building' },
]
const FUEL = [
  { value: 'oil', label: 'Oil boiler' },
  { value: 'gas', label: 'Gas' },
  { value: 'steam', label: 'Steam' },
  { value: 'electric-resistance', label: 'Electric baseboard' },
  { value: 'unsure', label: 'Not sure' },
]
const MEASURES = [
  { value: 'heat-pump', label: 'Heat pump', sub: 'Heating + cooling, replaces your boiler' },
  { value: 'insulation', label: 'Insulation & air-sealing', sub: 'Keeps the heat you pay for' },
  { value: 'induction', label: 'Induction stove', sub: 'Swap out gas cooking' },
]
const INCOME = [
  { value: 'under-67', label: 'Under ~$67k' },
  { value: '67-100', label: '~$67k – $100k' },
  { value: '100-125', label: '~$100k – $125k' },
  { value: '125-165', label: '~$125k – $165k' },
  { value: 'over-165', label: 'Over ~$165k' },
  { value: 'prefer-not', label: 'Prefer not to say' },
]
const FUNDER_CLASS = {
  'Federal': 'badge-federal',
  'New York State': 'badge-state',
  'NYC': 'badge-nyc',
  'Con Edison': 'badge-coned',
}

export default function Switchboard() {
  const [screen, setScreen] = useState('landing')
  const [d, setD] = useState({ measures: [] })

  const profile = {
    zip: d.zip ?? '',
    ownership: d.ownership ?? 'own',
    building: d.building ?? '2-4-family',
    fuel: d.fuel ?? 'oil',
    measures: d.measures ?? [],
    income: d.income ?? 'prefer-not',
  }

  const outcome = useMemo(() => evaluateProfile(profile), [JSON.stringify(profile)])

  function restart() {
    setD({ measures: [] })
    setScreen('landing')
  }
  function loadPersona(p) {
    setD(p)
    setScreen('results')
  }
  function toggleMeasure(m) {
    setD(p => {
      const cur = p.measures ?? []
      return { ...p, measures: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] }
    })
  }

  const stepValid = {
    1: /^\d{5}$/.test(d.zip ?? ''),
    2: !!d.ownership && !!d.building,
    3: !!d.fuel,
    4: (d.measures ?? []).length > 0,
    5: true,
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="app">
        <header className="topbar">
          <div className="wordmark" onClick={restart} role="button">
            <span className="logo-dot" /> Switchboard
          </div>
          <div className="tag">NYC clean-energy incentives, found &amp; stacked</div>
        </header>

        <main className="stage">
          {screen === 'landing' && <Landing onStart={() => setScreen(1)} onPick={loadPersona} />}

          {typeof screen === 'number' && (
            <Wizard
              step={screen}
              valid={stepValid[screen]}
              draft={d}
              setD={setD}
              toggleMeasure={toggleMeasure}
              onBack={() => setScreen(screen === 1 ? 'landing' : screen - 1)}
              onNext={() => setScreen(screen === 5 ? 'results' : screen + 1)}
            />
          )}

          {screen === 'results' && (
            <Results profile={profile} outcome={outcome} onRestart={restart} onEdit={() => setScreen(1)} />
          )}
        </main>

        <footer className="foot">
          Estimates are illustrative placeholders — verify each with the provider. Built for Code for Climate · Accelerate track.
        </footer>
      </div>
    </>
  )
}

function Landing({ onStart, onPick }) {
  return (
    <section className="card hero">
      <p className="eyebrow">Accelerate · clean energy access</p>
      <h1>NYC already set aside thousands to get you off fossil heat.</h1>
      <p className="lede">
        The money exists — federal, state, city, and Con Edison. It goes unclaimed because the rules
        are scattered across six agencies. Answer five quick questions and Switchboard finds every
        incentive you can <em>stack</em>, the one move that would forfeit half of it, and is honest
        about what you don’t qualify for.
      </p>
      <div className="cta-row">
        <button className="btn primary" onClick={onStart}>Find my incentives</button>
      </div>
      <div className="examples">
        <span className="ex-label">Or try a real-world example:</span>
        <div className="ex-chips">
          {PERSONAS.map(p => (
            <button key={p.id} className="chip-btn" onClick={() => onPick(p.profile)}>
              <span className="chip-name">{p.label}</span>
              <span className="chip-sub">{p.sub}</span>
            </button>
          ))}
        </div>
      </div>
      <p className="micro">No account. Nothing you type is saved. ~60 seconds.</p>
    </section>
  )
}

function Wizard({ step, valid, draft, setD, toggleMeasure, onBack, onNext }) {
  return (
    <section className="card wizard">
      <ProgressBar step={step} total={5} />

      {step === 1 && (
        <Question title="Where’s your home?" help="Sets your utility and which city and state programs apply.">
          <input
            className="text-input"
            inputMode="numeric"
            maxLength={5}
            placeholder="ZIP code (e.g. 11372)"
            value={draft.zip ?? ''}
            onChange={e => { const zip = e.target.value.replace(/\D/g, '').slice(0, 5); setD(p => ({ ...p, zip })) }}
            autoFocus
          />
        </Question>
      )}

      {step === 2 && (
        <Question title="Do you own or rent — and what kind of building?" help="Ownership and building type gate most rebates.">
          <div className="grid two">
            {OWNERSHIP.map(o => (
              <Choice key={o.value} selected={draft.ownership === o.value}
                onClick={() => setD(p => ({ ...p, ownership: o.value }))} title={o.label} sub={o.sub} />
            ))}
          </div>
          <div className="grid two tight">
            {BUILDING.map(b => (
              <Choice key={b.value} small selected={draft.building === b.value}
                onClick={() => setD(p => ({ ...p, building: b.value }))} title={b.label} />
            ))}
          </div>
        </Question>
      )}

      {step === 3 && (
        <Question title="How do you heat it now?" help="Switching off oil or gas is where the biggest incentives live.">
          <div className="grid two">
            {FUEL.map(f => (
              <Choice key={f.value} selected={draft.fuel === f.value}
                onClick={() => setD(p => ({ ...p, fuel: f.value }))} title={f.label} />
            ))}
          </div>
        </Question>
      )}

      {step === 4 && (
        <Question title="What are you thinking about doing?" help="Pick any that interest you — we’ll find what stacks.">
          <div className="grid one">
            {MEASURES.map(m => (
              <Choice key={m.value} checkbox selected={(draft.measures ?? []).includes(m.value)}
                onClick={() => toggleMeasure(m.value)} title={m.label} sub={m.sub} />
            ))}
          </div>
        </Question>
      )}

      {step === 5 && (
        <Question title="Roughly, your household income?" help="Optional. Used only to check income-based bonuses — never stored.">
          <div className="grid two">
            {INCOME.map(i => (
              <Choice key={i.value} small selected={draft.income === i.value}
                onClick={() => setD(p => ({ ...p, income: i.value }))} title={i.label} />
            ))}
          </div>
        </Question>
      )}

      <div className="wizard-nav">
        <button className="btn ghost" onClick={onBack}>← Back</button>
        <button className="btn primary" disabled={!valid} onClick={onNext}>
          {step === 5 ? 'See my incentives' : 'Next'}
        </button>
      </div>
    </section>
  )
}

function ProgressBar({ step, total }) {
  return (
    <div className="progress">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={'pip' + (i < step ? ' on' : '')} />
      ))}
      <span className="progress-label">Step {step} of {total}</span>
    </div>
  )
}

function Question({ title, help, children }) {
  return (
    <div className="question">
      <h2>{title}</h2>
      <p className="help">{help}</p>
      <div className="answers">{children}</div>
    </div>
  )
}

function Choice({ title, sub, selected, onClick, small, checkbox }) {
  return (
    <button
      type="button"
      className={`choice${selected ? ' sel' : ''}${small ? ' small' : ''}`}
      onClick={onClick}
    >
      <span className={checkbox ? 'box' : 'dot'} aria-hidden>{selected ? '✓' : ''}</span>
      <span className="choice-text">
        <span className="choice-title">{title}</span>
        {sub && <span className="choice-sub">{sub}</span>}
      </span>
    </button>
  )
}

function Results({ profile, outcome, onRestart, onEdit }) {
  const pct = Math.min(100, Math.round((outcome.totalPoint / outcome.projectCost) * 100))

  return (
    <section className="results">
      <div className="card summary">
        <p className="narrate">{narrate(profile, outcome)}</p>
        <div className="bignum">
          <span className="found">{usd(outcome.totalPoint)}</span>
          <span className="found-label">in incentives found · {outcome.stack.length} programs stacked</span>
        </div>

        <div className="bar" aria-hidden>
          <div className="bar-fill" style={{ width: `${pct}%` }} />
          <div className="bar-marks">
            <span>Incentives {usd(outcome.totalPoint)}</span>
            <span>You pay ≈ {usd(outcome.outOfPocket)}</span>
          </div>
        </div>
        <p className="out-of-pocket">
          On a typical <strong>{usd(outcome.projectCost)}</strong> project, your out-of-pocket drops to
          about <strong>{usd(outcome.outOfPocket)}</strong> — roughly <strong>{outcome.percentOff}% off</strong>.
          <span className="ph">illustrative placeholder figures</span>
        </p>
        {outcome.impact.tonsPerYear > 0 && (
          <div className="climate">
            <span className="leaf" aria-hidden>🌿</span>
            <span>
              <strong>≈ {outcome.impact.tonsPerYear} tons CO₂/yr</strong> avoided — about{' '}
              {outcome.impact.carsEquivalent} car{outcome.impact.carsEquivalent === 1 ? '' : 's'} off the
              road, and one home off fossil heat. <span className="ph">estimate</span>
            </span>
          </div>
        )}
      </div>

      <h3 className="section-h">Your stack</h3>
      <div className="stack-list">
        {outcome.stack.map(s => <StackCard key={s.program.id} s={s} />)}
      </div>

      {outcome.attention.length > 0 && (
        <>
          <h3 className="section-h">Needs a closer look — what we <em>won’t</em> promise</h3>
          <p className="section-note">
            A calculator hides these. We surface them — telling you what you don’t get is how you know the rest is real.
          </p>
          <div className="stack-list">
            {outcome.attention.map(s => <AttentionCard key={s.program.id} s={s} />)}
          </div>
        </>
      )}

      <h3 className="section-h">Your claim plan</h3>
      <ol className="plan">
        {outcome.claimPlan.map((step, i) => (
          <li key={i} className={step.warn ? 'warn' : ''}>
            <span className="plan-num">{step.warn ? '!' : i + 1}</span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>

      <div className="trust">
        <strong>Why you can trust this:</strong> every figure traces to a named program below — nothing is invented.
        Estimates are placeholders to verify with each provider. Your answers were used on this device only and <strong>were not saved</strong>.
        <div className="sources">Sources cited: {[...new Set(outcome.stack.concat(outcome.attention).map(s => s.program.verifyAt))].slice(0, 6).join(' · ')}</div>
      </div>

      <div className="cta-row center">
        <button className="btn primary" onClick={onEdit}>Edit my answers</button>
        <button className="btn ghost" onClick={onRestart}>Start over</button>
      </div>
    </section>
  )
}

function StackCard({ s }) {
  const { program, result } = s
  const isBonus = result.status === 'income-bonus'
  return (
    <div className={`pcard${isBonus ? ' bonus' : ''}`}>
      <div className="pcard-top">
        <span className={`badge ${FUNDER_CLASS[program.funder]}`}>{program.funder}</span>
        <span className="kind">{program.kind}</span>
        {isBonus && <span className="bonus-tag">income bonus</span>}
      </div>
      <div className="pcard-name">{program.name}</div>
      <div className="pcard-reason">{result.reason}</div>
      <div className="pcard-foot">
        <span className="amount">
          {result.amount && result.amount > 0 ? `≈ ${usd(result.amount)}` : 'Free'}
          <span className="verify">est · verify</span>
        </span>
        <span className="timing">{program.claimTiming}</span>
      </div>
    </div>
  )
}

function AttentionCard({ s }) {
  const { program, result } = s
  const chip =
    result.status === 'unconfirmed' ? { cls: 'chip-amber', text: 'Can’t confirm yet' }
    : result.status === 'not-eligible' ? { cls: 'chip-red', text: 'Not you — here’s why' }
    : { cls: 'chip-gray', text: 'Checked · N/A' }
  return (
    <div className="pcard muted">
      <div className="pcard-top">
        <span className={`badge ${FUNDER_CLASS[program.funder]}`}>{program.funder}</span>
        <span className={`chip ${chip.cls}`}>{chip.text}</span>
      </div>
      <div className="pcard-name">{program.name}</div>
      <div className="pcard-reason">{result.reason}</div>
      <div className="pcard-foot">
        <span className="timing">Verify at: {program.verifyAt}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// STYLES — injected so this component is fully self-contained (no external CSS).
// ---------------------------------------------------------------------------
const CSS = `
:root {
  --bg: #eef2f0; --surface: #ffffff; --ink: #0e1b18; --muted: #5d6b66; --faint: #8a9893;
  --line: #e1e8e5; --green: #0c8a5f; --green-deep: #0a6f4d; --green-soft: #e6f4ee;
  --gold: #c98a16; --gold-soft: #fbf1dc; --amber: #b7791f; --amber-soft: #fdf3e2;
  --red: #b4452f; --red-soft: #fbeae6; --blue: #2b5fa6; --purple: #6a4ca3;
  --orange: #c2691c; --teal: #167b86; --radius: 16px;
  --shadow: 0 1px 2px rgba(16,40,33,.05), 0 12px 32px -16px rgba(16,40,33,.22);
}
.app *, .app *::before, .app *::after { box-sizing: border-box; }
.app {
  min-height: 100%; display: flex; flex-direction: column;
  color: var(--ink); line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  background:
    radial-gradient(1200px 600px at 80% -10%, #dff0e8 0%, transparent 55%),
    var(--bg);
}
.topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px clamp(18px, 5vw, 44px); border-bottom: 1px solid var(--line);
  background: rgba(255,255,255,.7); backdrop-filter: blur(8px);
  position: sticky; top: 0; z-index: 10;
}
.wordmark { display: flex; align-items: center; gap: 10px; font-weight: 750; font-size: 19px; letter-spacing: -.02em; cursor: pointer; }
.logo-dot { width: 14px; height: 14px; border-radius: 4px; background: linear-gradient(135deg, var(--green), #16b277); box-shadow: 0 0 0 4px var(--green-soft); }
.tag { color: var(--muted); font-size: 13.5px; text-align: right; }
@media (max-width: 620px) { .tag { display: none; } }
.stage { flex: 1; width: 100%; max-width: 880px; margin: 0 auto; padding: clamp(20px, 4vw, 40px) clamp(16px, 5vw, 28px) 64px; }
.foot { text-align: center; color: var(--faint); font-size: 12.5px; padding: 18px; border-top: 1px solid var(--line); }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(24px, 4vw, 40px); }
.btn { font: inherit; font-weight: 650; cursor: pointer; border-radius: 11px; padding: 12px 20px; border: 1px solid transparent; transition: transform .04s ease, background .15s ease, box-shadow .15s ease; }
.btn:active { transform: translateY(1px); }
.btn.primary { background: var(--green); color: #fff; box-shadow: 0 8px 18px -8px rgba(12,138,95,.6); }
.btn.primary:hover { background: var(--green-deep); }
.btn.primary:disabled { background: #b9c6c1; box-shadow: none; cursor: not-allowed; }
.btn.ghost { background: transparent; color: var(--green-deep); border-color: var(--line); }
.btn.ghost:hover { background: var(--green-soft); }
.cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 26px; }
.cta-row.center { justify-content: center; margin-top: 30px; }
.hero .eyebrow { text-transform: uppercase; letter-spacing: .14em; font-size: 12px; font-weight: 700; color: var(--green); margin: 0 0 14px; }
.hero h1 { font-size: clamp(28px, 5vw, 40px); line-height: 1.1; letter-spacing: -.025em; margin: 0 0 16px; max-width: 16ch; }
.lede { font-size: 17px; color: var(--muted); margin: 0; max-width: 60ch; }
.lede em { color: var(--ink); font-style: normal; font-weight: 650; }
.micro { color: var(--faint); font-size: 13px; margin: 16px 0 0; }
.examples { margin-top: 24px; }
.ex-label { display: block; color: var(--faint); font-size: 13px; font-weight: 600; margin-bottom: 10px; }
.ex-chips { display: flex; gap: 10px; flex-wrap: wrap; }
.chip-btn { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left; background: #fbfdfc; border: 1.5px solid var(--line); border-radius: 12px; padding: 11px 15px; cursor: pointer; font: inherit; transition: all .12s ease; }
.chip-btn:hover { border-color: var(--green); background: var(--green-soft); transform: translateY(-1px); }
.chip-name { font-weight: 700; font-size: 14px; }
.chip-sub { color: var(--muted); font-size: 12.5px; }
.wizard { min-height: 420px; display: flex; flex-direction: column; }
.progress { display: flex; align-items: center; gap: 8px; margin-bottom: 26px; }
.pip { height: 6px; width: 34px; border-radius: 99px; background: var(--line); transition: background .2s; }
.pip.on { background: var(--green); }
.progress-label { margin-left: auto; color: var(--faint); font-size: 13px; font-weight: 600; }
.question { flex: 1; }
.question h2 { font-size: clamp(21px, 3.4vw, 27px); letter-spacing: -.02em; margin: 0 0 6px; }
.help { color: var(--muted); margin: 0 0 22px; font-size: 15px; }
.grid { display: grid; gap: 12px; }
.grid.one { grid-template-columns: 1fr; }
.grid.two { grid-template-columns: 1fr 1fr; }
.grid.tight { margin-top: 12px; }
@media (max-width: 560px) { .grid.two { grid-template-columns: 1fr; } }
.text-input { width: 100%; font: inherit; font-size: 20px; letter-spacing: .04em; padding: 16px 18px; border: 1.5px solid var(--line); border-radius: 12px; background: #fbfdfc; color: var(--ink); }
.text-input:focus { outline: none; border-color: var(--green); box-shadow: 0 0 0 4px var(--green-soft); }
.choice { display: flex; align-items: flex-start; gap: 12px; text-align: left; background: #fbfdfc; border: 1.5px solid var(--line); border-radius: 12px; padding: 15px 16px; cursor: pointer; font: inherit; transition: all .12s ease; }
.choice:hover { border-color: #bcd6cb; background: #fff; }
.choice.sel { border-color: var(--green); background: var(--green-soft); }
.choice.small { padding: 13px 15px; align-items: center; }
.dot, .box { flex: none; width: 22px; height: 22px; border-radius: 99px; border: 1.5px solid #c2cfca; display: grid; place-items: center; color: #fff; font-size: 13px; font-weight: 800; margin-top: 1px; }
.box { border-radius: 7px; }
.choice.sel .dot, .choice.sel .box { background: var(--green); border-color: var(--green); }
.choice-text { display: flex; flex-direction: column; }
.choice-title { font-weight: 650; }
.choice-sub { color: var(--muted); font-size: 13.5px; }
.wizard-nav { display: flex; justify-content: space-between; margin-top: 28px; }
.results { display: flex; flex-direction: column; gap: 22px; }
@keyframes riseIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.results > * { animation: riseIn .45s cubic-bezier(.2,.8,.2,1) both; }
.results > *:nth-child(2) { animation-delay: .05s; }
.results > *:nth-child(3) { animation-delay: .10s; }
.results > *:nth-child(4) { animation-delay: .15s; }
.results > *:nth-child(5) { animation-delay: .20s; }
.results > *:nth-child(6) { animation-delay: .25s; }
.results > *:nth-child(n+7) { animation-delay: .30s; }
@media (prefers-reduced-motion: reduce) { .results > * { animation: none; } }
.summary { background: linear-gradient(180deg, #ffffff, #fbfefc); }
.narrate { font-size: 17px; color: var(--ink); margin: 0 0 20px; line-height: 1.55; }
.bignum { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.found { font-size: clamp(42px, 8vw, 60px); font-weight: 800; letter-spacing: -.03em; color: var(--green-deep); line-height: 1; }
.found-label { color: var(--muted); font-size: 15px; font-weight: 600; }
.bar { margin: 22px 0 12px; height: 38px; border-radius: 10px; overflow: hidden; background: repeating-linear-gradient(45deg, #eef1f0, #eef1f0 10px, #e8edeb 10px, #e8edeb 20px); position: relative; border: 1px solid var(--line); }
.bar-fill { height: 100%; background: linear-gradient(90deg, var(--green), #18b277); transition: width .6s cubic-bezier(.2,.8,.2,1); }
.bar-marks { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; font-size: 13px; font-weight: 700; color: #0c3a2a; pointer-events: none; }
.bar-marks span:last-child { color: var(--muted); }
.out-of-pocket { font-size: 15.5px; color: var(--muted); margin: 6px 0 0; }
.out-of-pocket strong { color: var(--ink); }
.climate { display: flex; align-items: center; gap: 11px; margin-top: 16px; padding: 13px 15px; background: var(--green-soft); border: 1px solid #c5e5d6; border-radius: 12px; font-size: 14.5px; color: #14513a; line-height: 1.45; }
.climate strong { color: var(--green-deep); }
.leaf { font-size: 19px; line-height: 1; flex: none; }
.ph { display: inline-block; margin-left: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--gold); background: var(--gold-soft); padding: 2px 8px; border-radius: 6px; }
.section-h { font-size: 19px; letter-spacing: -.01em; margin: 8px 0 2px; }
.section-h em { color: var(--green-deep); font-style: normal; }
.section-note { color: var(--muted); font-size: 14px; margin: 0 0 14px; max-width: 64ch; }
.stack-list { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
@media (max-width: 620px) { .stack-list { grid-template-columns: 1fr; } }
.pcard { background: var(--surface); border: 1px solid var(--line); border-radius: 13px; padding: 16px 17px; display: flex; flex-direction: column; gap: 8px; box-shadow: var(--shadow); }
.pcard.bonus { border-color: #cdb27a; background: linear-gradient(180deg, #fffdf7, #fff); }
.pcard.muted { background: #fafbfb; box-shadow: none; }
.pcard-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pcard-name { font-weight: 700; font-size: 15px; line-height: 1.3; }
.pcard-reason { color: var(--muted); font-size: 14px; }
.pcard-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 6px; flex-wrap: wrap; }
.amount { font-weight: 800; color: var(--green-deep); font-size: 17px; display: flex; align-items: baseline; gap: 8px; }
.verify { font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--faint); }
.timing { font-size: 12.5px; color: var(--faint); }
.badge { font-size: 11px; font-weight: 750; padding: 3px 9px; border-radius: 7px; color: #fff; letter-spacing: .01em; }
.badge-federal { background: var(--blue); }
.badge-state { background: var(--purple); }
.badge-nyc { background: var(--orange); }
.badge-coned { background: var(--teal); }
.kind { font-size: 12px; color: var(--faint); font-weight: 600; }
.bonus-tag { font-size: 11px; font-weight: 750; color: var(--gold); background: var(--gold-soft); padding: 3px 9px; border-radius: 7px; }
.chip { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 7px; }
.chip-amber { background: var(--amber-soft); color: var(--amber); }
.chip-red { background: var(--red-soft); color: var(--red); }
.chip-gray { background: #eef1f0; color: var(--muted); }
.plan { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.plan li { display: flex; gap: 14px; align-items: flex-start; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; font-size: 15px; }
.plan li.warn { border-color: #e6b8ab; background: var(--red-soft); }
.plan-num { flex: none; width: 27px; height: 27px; border-radius: 99px; background: var(--green); color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 14px; }
.plan li.warn .plan-num { background: var(--red); }
.trust { background: var(--green-soft); border: 1px solid #c5e5d6; border-radius: 13px; padding: 16px 18px; font-size: 14px; color: #14513a; }
.sources { margin-top: 8px; font-size: 12px; color: var(--green-deep); opacity: .85; }
`
