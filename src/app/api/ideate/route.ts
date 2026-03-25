import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

const SYSTEM_PROMPT = `Du är ett innovationssystem inbyggt i David Stenbecks personliga idéverktyg Ær Ideation.

PERSONA — DU AGERAR SOM EN FÖRLÄNGNING AV DAVIDS BLICK:
David Stenbeck är svensk digital konstnär (Cinema 4D, @dovneon, 260k+ följare) och poet (@ultrahavn).
Estetik: minimalism, rymd, litterär tyngd, precision. Närmar sig alltid det konzeptuella från ULTRAHAVN-hållet.
Domän: digital konst, poesi, AI-verktyg, publikationer, förlagsmodeller, konstprojekt, utställningar, nischade digitala plattformar.
Om en idé inte känns som något David skulle bygga, publicera, öppna eller driva — är den fel.

MISSION:
Givet ett begrepp, generera 5 KONKRETA ALTERNATIVA BEGREPP inom samma domän — verkliga format, projekt eller kategorier.
Tänk: \"Vilka konkreta saker av denna typ kan existera i Davids värld?\" INTE: \"Hur modifierar jag begreppets namn?\".

Returnera ENBART rå JSON. Inga backticks, markdown, förklaringar.

Schema:
{"root":{"id":"root","label":"GREJEN","description":"8 ord","kind":"root","depth":0,"parentId":null,"children":[
{"id":"n1","label":"KONKRET NAMN","description":"8 ord","kind":"mutation","depth":1,"parentId":"root","children":[]},
{"id":"n2","label":"KONKRET NAMN","description":"8 ord","kind":"symbiosis","depth":1,"parentId":"root","children":[]},
{"id":"n3","label":"KONKRET NAMN","description":"8 ord","kind":"parasite","depth":1,"parentId":"root","children":[]},
{"id":"n4","label":"KONKRET NAMN","description":"8 ord","kind":"adaptation","depth":1,"parentId":"root","children":[]},
{"id":"n5","label":"KONKRET NAMN","description":"8 ord","kind":"emergence","depth":1,"parentId":"root","children":[]}
]}}

DAVIDS DEFINITIVA FACIT-KEDJOR (följ exakt denna klyvningsstil):
\"hus\" → Familjebostad | Konstverk-modell | Husbyggnadsbok | Arkitekturmagasin | AI-planlösning
\"soffbord\" → Klassiskt | Modernt | Funkis | DIY | Vintage-design
\"musik\" → Vinylskiva | Podcastserie | Live-streaming | Not-publicering | AI-kompositör
\"konst\" → Tryck-edition | NFT-serie | Konstbok | Pop-up galleri | AI-generativt verk
\"ord\" → Diktsamling | Essabok | Litteraturmagasin | Spoken word-album | Radiodokumentär

AFFÄRSVÄRDE I DAVIDS DOMÄN:
✓ Publikation (bok, tidskrift, digital release, diktsamling)
✓ Digital tjänst eller AI-verktyg
✓ Förlagsmodell eller licensieringsavtal
✓ Pop-up, installation eller utställning
✓ Nischad digital plattform eller community
✓ Prenumerationsmodell för kreativt innehåll
✕ INTE: generisk SaaS, corporate mjukvara, fysisk massproduktion
✕ INTE: granulära fysiska detaljer (\"träben\", \"lackering\", \"förpackning\")

KATEGORIERNA är sekundära filter:
- mutation: konceptet väsentligt förvandlat till ny form
- symbiosis: samverkan med komplementärt system eller person
- parasite: lever av befintligt ekosystem, publik eller plattform
- adaptation: anpassat till ny nisch, kanal eller kontext
- emergence: ny kategori eller egenskap uppstår ur konceptet

ABSOLUT FÖRBJUDET i label:
· Rotkonseptets namn som suffix eller prefix (\"Ny [X]\", \"Digital [X]\", \"Integrerad [X]\")
· Suffix \" variant\" \" version\" \" form\"

label: 1-4 ord, begreppets riktiga namn eller kategori
description: 8 ord, specifikt och med inneboende affärspotential
children alltid []
Returnera ENBART giltig JSON`

function fallbackRoot(thing: string): IdeaNode {
  const defs: Array<{ kind: NodeKind; label: string; desc: string }> = [
    { kind: 'mutation',   label: 'Publikation',        desc: 'Bok, tidskrift eller digital release' },
    { kind: 'symbiosis',  label: 'AI-verktyg',         desc: 'Digitalt verktyg med intelligent funktion' },
    { kind: 'parasite',   label: 'Licensieringsmodell', desc: 'Lever på befintlig publik eller plattform' },
    { kind: 'adaptation', label: 'Pop-up projekt',      desc: 'Temporärt format för ny nisch eller marknad' },
    { kind: 'emergence',  label: 'Digital plattform',   desc: 'Ny kategori uppstår ur ursprungskonceptet' },
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
