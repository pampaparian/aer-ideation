import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

// Generates root + depth-1 children only.
// Depth-2+ generated on demand via /api/split.
const SYSTEM_PROMPT = `Du är ett affärsinnovationssystem baserat på biologisk konceptklyvning.

MISSION: Klipp upp ett begrepp i 5 konkreta, tydliga alternativ. Varje alternativ ska vara en genomförbar idé — en produkt, tjänst, affarsmodell eller format man kan bygga något kring. Prioritera kommersiell potential och innovationsvärde.

Returnera ENBART rå JSON. Inga backticks, markdown, förklaringar.

Schema:
{"root":{"id":"root","label":"GREJEN","description":"8 ord","kind":"root","depth":0,"parentId":null,"children":[
{"id":"n1","label":"KONKRET NAMN","description":"8 ord, affärspotential tydlig","kind":"mutation","depth":1,"parentId":"root","children":[]},
{"id":"n2","label":"KONKRET NAMN","description":"8 ord","kind":"symbiosis","depth":1,"parentId":"root","children":[]},
{"id":"n3","label":"KONKRET NAMN","description":"8 ord","kind":"parasite","depth":1,"parentId":"root","children":[]},
{"id":"n4","label":"KONKRET NAMN","description":"8 ord","kind":"adaptation","depth":1,"parentId":"root","children":[]},
{"id":"n5","label":"KONKRET NAMN","description":"8 ord","kind":"emergence","depth":1,"parentId":"root","children":[]}
]}}

FEW-SHOT EXEMPEL (följ exakt denna stil):
Input "bok" → barn: Diktsamling, Serieroman, Lärobok, Fotobok, Essabok
Input "musik" → barn: Podcastserie, Synkmusik, Ringtone-label, Live-event-app, AI-kompositr
Input "app" → barn: Prenumerationstjänst, Spelplattform, B2B-verktyg, Marknadsplats, API-produkt
Input "kläder" → barn: Second hand-plattform, Uniform-as-a-service, Fast fashion-parasit, Adaptiv design, Slow fashion-rörelse

KATEGORIERNA är filter (sekundära — idén är primär):
- mutation: väsentlig förvandling av konceptet
- symbiosis: samverkan med något annat system
- parasite: lever av befintligt ekosystem
- adaptation: anpassad till nytt sammanhang
- emergence: ny egenskap uppstår

ABSOLUT FÖRBJUDET i label:
· "mutation av [X]", "symbios av [X]", "adaptation av [X]"
· originalkonceptets namn som suffix
· suffix " variant" " form" " version"

label: 1-4 ord, konkret produktnamn eller kategori
description: 8 ord, visar affärspotential
children alltid []
Returnera ENBART giltig JSON`

function fallbackRoot(thing: string): IdeaNode {
  const defs: Array<{ kind: NodeKind; label: string; desc: string }> = [
    { kind: 'mutation',   label: `${thing}+`,       desc: 'Väsentligt förbättrad version med ny funktion' },
    { kind: 'symbiosis',  label: `${thing} x Y`,    desc: 'Samverkar med komplementärt system för tillväxt' },
    { kind: 'parasite',   label: `${thing} Pro`,    desc: 'Bygger ovanpå befintlig plattform eller marknad' },
    { kind: 'adaptation', label: `Micro-${thing}`,  desc: 'Anpassad variant för ny nisch eller kanal' },
    { kind: 'emergence',  label: `Neo-${thing}`,    desc: 'Ny kategori uppstår ur ursprungskonceptet' },
  ]
  return {
    id: 'root', label: thing,
    description: 'Ursprungskonceptet, klart för klyvning',
    kind: 'root', depth: 0, parentId: null,
    children: defs.map((d, i) => ({
      id: `n${i+1}`, label: d.label, description: d.desc,
      kind: d.kind, depth: 1, parentId: 'root', children: [],
    })),
  }
}

function stripMarkdown(raw: string): string {
  return raw.replace(/^```json[\s\S]*?\n/i,'').replace(/^```\s*\n/i,'').replace(/\n?```\s*$/i,'').trim()
}

export async function POST(req: NextRequest) {
  const { thing } = await req.json()
  if (!thing || typeof thing !== 'string')
    return NextResponse.json({ error: 'Saknar thing' }, { status: 400 })
  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('ideate: API-nyckel saknas')
    return NextResponse.json({ root: fallbackRoot(thing) })
  }
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: `Grejen: ${thing}` }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048, responseMimeType: 'application/json' },
        }),
      }
    )
    if (!resp.ok) { console.error('ideate: HTTP', resp.status); return NextResponse.json({ root: fallbackRoot(thing) }) }
    const gd = await resp.json()
    const raw = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return NextResponse.json(JSON.parse(stripMarkdown(raw)))
  } catch (err) {
    console.error('ideate: fel -', err)
    return NextResponse.json({ root: fallbackRoot(thing) })
  }
}
