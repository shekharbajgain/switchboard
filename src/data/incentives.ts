// ---------------------------------------------------------------------------
// Switchboard — curated NYC heating-electrification incentive dataset.
//
// This file is the SINGLE SOURCE OF TRUTH the "AI" is allowed to speak from.
// The engine reasons over this data only; the narrator explains this data only.
// Result: the app physically cannot invent a program or a dollar amount that
// isn't grounded here. That constraint *is* our anti-hallucination guardrail
// (rubric #02). Dollar amounts are ILLUSTRATIVE placeholders for the demo and
// are labeled "verify" everywhere they surface in the UI; the program names and
// rules are real NYC / NYS / Con Edison / federal programs (as of 2025 — always
// verify current status, which is exactly what the app tells the user to do).
// ---------------------------------------------------------------------------

export type Measure = 'heat-pump' | 'insulation' | 'induction'
export type Ownership = 'own' | 'rent'
export type BuildingType = '1-family' | '2-4-family' | 'coop-condo' | 'larger'
export type Fuel = 'oil' | 'gas' | 'electric-resistance' | 'steam' | 'unsure'
export type IncomeBand =
  | 'under-67' | '67-100' | '100-125' | '125-165' | 'over-165' | 'prefer-not'

export interface Profile {
  zip: string
  ownership: Ownership
  building: BuildingType
  fuel: Fuel
  measures: Measure[]
  income: IncomeBand
}

export type Status =
  | 'qualifies'      // confirmed, goes in the stack
  | 'income-bonus'   // qualifies specifically because of an income tier
  | 'unconfirmed'    // we can't ground a number, so we refuse to invent one
  | 'not-eligible'   // honestly does not apply to this household
  | 'not-applicable' // not relevant to what they selected

export interface ProgramEval {
  status: Status
  reason: string
  amount?: number // point-estimate placeholder, only when it goes in the stack
}

export interface Program {
  id: string
  name: string
  funder: 'Federal' | 'New York State' | 'NYC' | 'Con Edison'
  kind: 'Tax credit' | 'Rebate' | 'Free program' | 'Tax abatement'
  estLow: number
  estHigh: number
  requiresParticipatingContractor?: boolean
  claimTiming: string
  verifyAt: string
  alwaysSurface?: boolean // show in "needs a closer look" even when not-applicable
  evaluate: (p: Profile) => ProgramEval
}

// Illustrative assumed project cost for an outer-borough 2-family:
// whole-home cold-climate heat pump + insulation / air-sealing. Placeholder.
export const ASSUMED_PROJECT_COST = 24000

const wants = (p: Profile, m: Measure) => p.measures.includes(m)
const isOwner = (p: Profile) => p.ownership === 'own'

export const PROGRAMS: Program[] = [
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

// Demo personas — one click loads each, so a live pitch is fast, repeatable, and
// can show range when judges ask "what about someone different?"
export const MARIA: Profile = {
  zip: '11372',
  ownership: 'own',
  building: '2-4-family',
  fuel: 'oil',
  measures: ['heat-pump', 'insulation', 'induction'],
  income: '100-125',
}

// Income-qualified Bronx homeowner — unlocks the FREE EmPower+ track (equity path).
export const DARNELL: Profile = {
  zip: '10456',
  ownership: 'own',
  building: '1-family',
  fuel: 'gas',
  measures: ['heat-pump', 'insulation'],
  income: 'under-67',
}

export interface Persona { id: string; label: string; sub: string; profile: Profile }

export const PERSONAS: Persona[] = [
  { id: 'maria', label: 'Maria · Jackson Heights', sub: '2-family, oil boiler, moderate income', profile: MARIA },
  { id: 'darnell', label: 'Darnell · the Bronx', sub: '1-family, gas, income-qualified for free upgrades', profile: DARNELL },
]
