import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

// Generates root + depth-1 children only.
// Depth-2+ generated on demand via /api/split.
const SYSTEM_PROMPT = `Du är ett innovationssystem. Givet ett begrepp, generera 5 KONKRETA ALTERNATIVA BEGREPP inom samma domän.

FUNDAMENTALT PARADIGM:
Tänk: \"Vilka 5 faktiska saker av denna typ finns i världen?\" Inte: \"Hur modifierar jag det här begreppets namn?\".
Varje barn ska vara ett EGET BEGREPP — en konkret produkt, tjänst eller format.

Returnera ENBART rå JSON. Inga backticks, markdown, förklaringar.

Schema:
{"root":{"id":"root","label":"GREJEN","description":"8 ord","kind":"root","depth":0,"parentId":null,"children":[
{"id":"n1","label":"KONKRET NAMN","description":"8 ord, affärspotential","kind":"mutation","depth":1,"parentId":"root","children":[]},
{"id":"n2","label":"KONKRET NAMN","description":"8 ord","kind":"symbiosis","depth":1,"parentId":"root","children":[]},
{"id":"n3","label":"KONKRET NAMN","description":"8 ord","kind":"parasite","depth":1,"parentId":"root","children":[]},
{"id":"n4","label":"KONKRET NAMN","description":"8 ord","kind":"adaptation","depth":1,"parentId":"root","children":[]},
{"id":"n5","label":"KONKRET NAMN","description":"8 ord","kind":"emergence","depth":1,"parentId":"root","children":[]}
]}}

FEW-SHOT EXEMPEL (följ exakt denna stil — riktiga namn, inga prefix):
Input \"bok\" → Diktsamling | Serieroman | Lärobok | Fotobok | Novellsamling
Input \"musik\" → Podcastserie | Ringtone-label | AI-kompositör | Live-eventapp | Studiobokning
Input \"redaktör\" → Chefredaktör | Faktakontrollant | Bildredaktör | Webredaktör | Korrläsare
Input \"app\" → Mobilspel | B2B-verktyg | Marknadsplats | API-produkt | Community-plattform
Input \"mat\" → Catering | Matleverns | Prenumerationslåda | Ghost kitchen | Recepttjänst

KATEGORIERNA är SEKUNDÄRA FILTER (idén är primär):
- mutation: väsentlig förvandling
- symbiosis: samverkan med annat system
- parasite: lever av befintligt ekosystem
- adaptation: anpassad till ny nisch
- emergence: ny egenskap uppstår

ABSOLUT FÖRBJUDET:
· Label får INTE innehålla rotkonseptets namn
· Inga prefix + begreppet (\"Ny bok\", \"Digital bok\", \"Integrerad bok\" = FEL)
· Suffix \" variant\" \" version\" \" form\"

label: 1-4 ord, det konkreta begreppets riktiga namn
description: 8 ord, affärspotential tydlig
children alltid []
Returnera ENBART giltig JSON`

function fallbackRoot(thing: string): IdeaNode {
  // Standalone labels — domain-agnostic, no reference to 'thing' in labels
  const defs: Array<{ kind: NodeKind; label: string; desc: string }> = [
    { kind: 'mutation',   label: 'Direktkanal',       desc: 'Direkt till slutkund utan mellanhaänd' },
    { kind: 'symbiosis',  label: 'Plattformstjänst',  desc: 'Samverkar med befintlig infrastruktur' },
    { kind: 'parasite',   label: 'White-label',        desc: 'Lever på andra aktörers varuumärken' },
    { kind: 'adaptation', label: 'Nicheprodukt',       desc: 'Smal, djup lösning för specifik nisch' },
    { kind: 'emergence',  label: 'Ekosystemprodukt',   desc: 'Ny kategori uppstår ur konceptets logik' },
  ]
  return {
    id: 'root', label: thing,
    description: 'Ursprungskonceptet, redo för klyvning',
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
          generationConfig: { temperature: 0.85, maxOutputTokens: 2048, responseMimeType: 'application/json' },
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
