import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  PERSONAS, Profile, Measure, Ownership, BuildingType, Fuel, IncomeBand,
} from './data/incentives'
import { evaluateProfile, runningCost, Scored } from './engine/engine'
import { narrate, reasoningSteps } from './engine/explain'

type Screen = 'landing' | 1 | 2 | 3 | 4 | 5 | 'results'

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

const OWNERSHIP: { value: Ownership; label: string; sub: string }[] = [
  { value: 'own', label: 'I own it', sub: 'House, co-op, or condo you own' },
  { value: 'rent', label: 'I rent', sub: 'Some programs still apply' },
]
const BUILDING: { value: BuildingType; label: string }[] = [
  { value: '1-family', label: '1-family house' },
  { value: '2-4-family', label: '2–4 family house' },
  { value: 'coop-condo', label: 'Co-op / condo' },
  { value: 'larger', label: 'Larger building' },
]
const FUEL: { value: Fuel; label: string }[] = [
  { value: 'oil', label: 'Oil boiler' },
  { value: 'gas', label: 'Gas' },
  { value: 'steam', label: 'Steam' },
  { value: 'electric-resistance', label: 'Electric baseboard' },
  { value: 'unsure', label: 'Not sure' },
]
const MEASURES: { value: Measure; label: string; sub: string }[] = [
  { value: 'heat-pump', label: 'Heat pump', sub: 'Heating + cooling, replaces your boiler' },
  { value: 'insulation', label: 'Insulation & air-sealing', sub: 'Keeps the heat you pay for' },
  { value: 'induction', label: 'Induction stove', sub: 'Swap out gas cooking' },
]
const INCOME: { value: IncomeBand; label: string }[] = [
  { value: 'under-67', label: 'Under ~$67k' },
  { value: '67-100', label: '~$67k – $100k' },
  { value: '100-125', label: '~$100k – $125k' },
  { value: '125-165', label: '~$125k – $165k' },
  { value: 'over-165', label: 'Over ~$165k' },
  { value: 'prefer-not', label: 'Prefer not to say' },
]

const FUNDER_CLASS: Record<string, string> = {
  'Federal': 'badge-federal',
  'New York State': 'badge-state',
  'NYC': 'badge-nyc',
  'Con Edison': 'badge-coned',
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [d, setD] = useState<Partial<Profile>>({ measures: [] })

  const profile: Profile = {
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
  function loadPersona(p: Profile) {
    setD(p)
    setScreen('results')
  }
  function toggleMeasure(m: Measure) {
    setD(p => {
      const cur = p.measures ?? []
      return { ...p, measures: cur.includes(m) ? cur.filter(x => x !== m) : [...cur, m] }
    })
  }

  const stepValid: Record<number, boolean> = {
    1: /^\d{5}$/.test(d.zip ?? ''),
    2: !!d.ownership && !!d.building,
    3: !!d.fuel,
    4: (d.measures ?? []).length > 0,
    5: true, // income optional
  }

  return (
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
            onBack={() => setScreen(screen === 1 ? 'landing' : ((screen - 1) as Screen))}
            onNext={() => setScreen(screen === 5 ? 'results' : ((screen + 1) as Screen))}
          />
        )}

        {screen === 'results' && (
          <Results
            profile={profile}
            outcome={outcome}
            onRestart={restart}
            onEdit={() => setScreen(1)}
          />
        )}
      </main>

      <footer className="foot">
        Estimates are illustrative placeholders — verify each with the provider. Built for Code for Climate · Accelerate track.
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ Landing */

function Landing({ onStart, onPick }: { onStart: () => void; onPick: (p: Profile) => void }) {
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

/* ------------------------------------------------------------------- Wizard */

function Wizard(props: {
  step: number
  valid: boolean
  draft: Partial<Profile>
  setD: Dispatch<SetStateAction<Partial<Profile>>>
  toggleMeasure: (m: Measure) => void
  onBack: () => void
  onNext: () => void
}) {
  const { step, valid, draft, setD, toggleMeasure, onBack, onNext } = props

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

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="progress">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={'pip' + (i < step ? ' on' : '')} />
      ))}
      <span className="progress-label">Step {step} of {total}</span>
    </div>
  )
}

function Question({ title, help, children }: { title: string; help: string; children: React.ReactNode }) {
  return (
    <div className="question">
      <h2>{title}</h2>
      <p className="help">{help}</p>
      <div className="answers">{children}</div>
    </div>
  )
}

function Choice(props: {
  title: string; sub?: string; selected: boolean; onClick: () => void
  small?: boolean; checkbox?: boolean
}) {
  const { title, sub, selected, onClick, small, checkbox } = props
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

/* ------------------------------------------------------------------ Results */

function Results(props: {
  profile: Profile
  outcome: ReturnType<typeof evaluateProfile>
  onRestart: () => void
  onEdit: () => void
}) {
  const { profile, outcome, onRestart, onEdit } = props
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

      <RunningCostCard profile={profile} outcome={outcome} />

      <ReasoningPanel profile={profile} outcome={outcome} />

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

function StackCard({ s }: { s: Scored }) {
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

function AttentionCard({ s }: { s: Scored }) {
  const { program, result } = s
  const chip =
    result.status === 'expired' ? { cls: 'chip-red', text: 'Expired — gone for 2026' }
    : result.status === 'unconfirmed' ? { cls: 'chip-amber', text: 'Can’t confirm yet' }
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

const FUEL_WORD: Record<Fuel, string> = {
  'oil': 'oil', 'gas': 'gas', 'steam': 'steam',
  'electric-resistance': 'electric baseboard', 'unsure': 'your current heat',
}

function RunningCostCard({ profile, outcome }: { profile: Profile; outcome: ReturnType<typeof evaluateProfile> }) {
  const [bill, setBill] = useState('')
  const rc = runningCost(profile, bill ? Number(bill) : undefined)
  const word = FUEL_WORD[profile.fuel]
  return (
    <div className="card runcost">
      <h3 className="runcost-title">What it costs to heat — every year</h3>
      <div className="runcost-grid">
        <div className="rc-col">
          <span className="rc-label">Now ({word})</span>
          <span className="rc-num">≈ {usd(rc.currentAnnual)}<span className="rc-per">/yr</span></span>
        </div>
        <span className="rc-arrow" aria-hidden>→</span>
        <div className="rc-col">
          <span className="rc-label">With a heat pump</span>
          <span className="rc-num hp">≈ {usd(rc.heatpumpAnnual)}<span className="rc-per">/yr</span></span>
        </div>
      </div>
      <div className={`rc-verdict ${rc.verdict}`}>
        {rc.verdict === 'cheaper' && <>≈ {usd(rc.delta)}/yr cheaper to run — a clear monthly win (a heat pump is far more efficient than {word}).</>}
        {rc.verdict === 'similar' && <>About the same to run — NYC’s pricey electricity roughly cancels the heat pump’s efficiency, so don’t expect a big monthly cut.</>}
        {rc.verdict === 'pricier' && <>≈ {usd(-rc.delta)}/yr <strong>more</strong> to run — {word} is cheap, so the monthly bill isn’t the reason here. (We’d rather tell you straight.)</>}
      </div>
      <div className="rc-worth">
        <strong>So why switch?</strong> The monthly bill is the smallest part — the payoff is the <strong>≈{usd(outcome.totalPoint)} in incentives</strong>, the <strong>central AC</strong> you also get, and getting off {word}. That’s the real win.
      </div>
      <div className="rc-refine">
        <span>Know your real yearly heating bill?</span>
        <span className="rc-input-wrap">$<input className="rc-input" inputMode="numeric" placeholder={String(rc.currentAnnual)} value={bill}
          onChange={e => setBill(e.target.value.replace(/\D/g, '').slice(0, 6))} /></span>
        <span className="rc-hint">for a sharper number</span>
        <span className="ph">estimate · verify</span>
      </div>
    </div>
  )
}

function ReasoningPanel({ profile, outcome }: { profile: Profile; outcome: ReturnType<typeof evaluateProfile> }) {
  const steps = reasoningSteps(profile, outcome)
  return (
    <details className="reasoning">
      <summary><span className="reasoning-spark" aria-hidden>✦</span> How Switchboard reasoned — step by step</summary>
      <ol className="reasoning-list">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <p className="reasoning-note">
        This is the real logic the engine ran — grounded only in named programs, so it can’t invent a number.
        It’s the drop-in point for a live AI model, which would write this same explanation from the same grounded facts.
      </p>
    </details>
  )
}
