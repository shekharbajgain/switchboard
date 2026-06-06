import {
  PROGRAMS, ASSUMED_PROJECT_COST, Profile, Program, ProgramEval, Fuel,
} from '../data/incentives'

// ---------------------------------------------------------------------------
// The reasoning engine — the part a spreadsheet can't do.
//
// It doesn't just look programs up; it reasons over the WHOLE household at once:
//   - which programs stack vs. exclude each other
//   - which dollars are silently forfeited by the wrong contractor choice
//   - what order things must happen in (income docs before work, etc.)
//   - what it honestly CAN'T confirm, surfaced instead of hidden
// Every number it returns traces to a real program in the curated dataset.
// ---------------------------------------------------------------------------

export interface Scored { program: Program; result: ProgramEval }
export interface ClaimStep { text: string; warn?: boolean }
export interface ImpactEstimate { tonsPerYear: number; carsEquivalent: number; basis: string }

// Why money AND carbon: this is a climate hackathon, so the dollars are the hook
// but the tons are the point. Rough, clearly-labeled placeholder estimates of the
// CO2 a household avoids by getting off fossil heat — grounded in their fuel.
const HEATING_TONS: Record<Fuel, number> = {
  oil: 5.5, gas: 3.5, steam: 5.0, 'electric-resistance': 1.5, unsure: 4.0,
}
const AVG_CAR_TONS = 4.6 // tons CO2 per year for an average gas car (placeholder)

function computeImpact(profile: Profile): ImpactEstimate {
  const base = profile.measures.includes('heat-pump') ? (HEATING_TONS[profile.fuel] ?? 4.0) : 0
  const insul = profile.measures.includes('insulation') ? 0.8 : 0
  const tonsPerYear = Math.round((base + insul) * 10) / 10
  const carsEquivalent = Math.round((tonsPerYear / AVG_CAR_TONS) * 10) / 10
  return { tonsPerYear, carsEquivalent, basis: 'vs. your current heating — illustrative estimate' }
}

export interface Outcome {
  stack: Scored[]
  attention: Scored[]
  totalPoint: number
  rangeLow: number
  rangeHigh: number
  projectCost: number
  outOfPocket: number
  percentOff: number
  contractorGatedTotal: number
  contractorGatedNames: string[]
  federalTotal: number
  stateUtilTotal: number
  claimPlan: ClaimStep[]
  impact: ImpactEstimate
}

const usd = (n: number) => `$${Math.round(n).toLocaleString()}`

export function evaluateProfile(profile: Profile): Outcome {
  const scored: Scored[] = PROGRAMS.map(program => ({ program, result: program.evaluate(profile) }))

  const inStack = (s: Scored) =>
    s.result.status === 'qualifies' || s.result.status === 'income-bonus'

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

  const claimPlan: ClaimStep[] = []
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
