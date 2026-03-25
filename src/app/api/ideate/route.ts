import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

// Generates root + depth-1 children only.
// Depth-2+ is generated on demand via /api/split.
const SYSTEM_PROMPT = `Du är en motor för innovationsbiologi. Givet en 'grej', generera ett rotobjekt med exakt 5 barn.

Returnera ENBART rå JSON. Inga markdown-block, inga backticks, inga förklaringar.

Schema:
{"root":{"id":"root","label":"GREJEN","description":"8 ord","kind":"root","depth":0,"parentId":null,"children":[
{"id":"n1","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"mutation","depth":1,"parentId":"root","children":[]},
{"id":"n2","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"symbiosis","depth":1,"parentId":"root","children":[]},
{"id":"n3","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"parasite","depth":1,"parentId":"root","children":[]},
{"id":"n4","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"adaptation","depth":1,"parentId":"root","children":[]},
{"id":"n5","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"emergence","depth":1,"parentId":"root","children":[]}
]}}

VIKTIGT — label-regler:
- Skriv det specifika begreppets faktiska namn, INTE "mutation av X" eller "X-variant"
- Exempel om input är "bok": Diktsamling, Lärobok, Serieroman, Kokbok, Självbiografi
- Exempel om input är "stol": Hammock, Kontorsstol, Gungestol, Sadel, Hängmatta
- Exempel om input är "musik": Vaggsång, Protestsång, Opera, Remixalbum, Improvisationsjazz
- Exempel om input är "hus": Herrgård, Nomadtält, Trädkoja, Flytande hem, Underjordsbunker
- label: 1-4 ord, specifikt och konkret
- description: exakt 8 ord, beskriver vad det är
- children alltid []
- Returnera ENBART giltig JSON`

function fallbackRoot(thing: string): IdeaNode {
  const kinds: NodeKind[] = ['mutation', 'symbiosis', 'parasite', 'adaptation', 'emergence']
  const examples: Record<NodeKind, string> = {
    root: thing,
    mutation: 'förändrad form',
    symbiosis: 'samlevnad med annat',
    parasite: 'lever på sin värd',
    adaptation: 'anpassad version',
    extinction: 'utdöd form',
    emergence: 'ny egenskap uppstår',
  }
  return {
    id: 'root',
    label: thing,
    description: `Ursprungskonceptet: ${thing}`,
    kind: 'root',
    depth: 0,
    parentId: null,
    children: kinds.map((kind, i) => ({
      id: `n${i + 1}`,
      label: `${kind} av ${thing}`,
      description: examples[kind],
      kind,
      depth: 1,
      parentId: 'root',
      children: [],
    })),
  }
}

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^```json[\s\S]*?\n/i, '')
    .replace(/^```\s*\n/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

export async function POST(req: NextRequest) {
  const { thing } = await req.json()
  if (!thing || typeof thing !== 'string') {
    return NextResponse.json({ error: 'Saknar fält: thing' }, { status: 400 })
  }

  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('ideate: GOOGLE_GENERATIVE_AI_API_KEY saknas')
    return NextResponse.json({ root: fallbackRoot(thing) })
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: `Grejen: ${thing}` }] }],
          generationConfig: {
            temperature: 0.75,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('ideate: Gemini HTTP', response.status, '-', err)
      return NextResponse.json({ root: fallbackRoot(thing) })
    }

    const geminiData = await response.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('ideate: raw length', raw.length)
    const cleaned = stripMarkdown(raw)
    const parsed = JSON.parse(cleaned)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('ideate: fel -', err)
    return NextResponse.json({ root: fallbackRoot(thing) })
  }
}
