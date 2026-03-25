import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

const SYSTEM_PROMPT = `Du är en motor för innovationsbiologi. Din uppgift är att, givet en 'grej' (ett koncept, en idé, ett objekt, ett fenomen), generera ett förgrenat träd av idénoder.

Varje nod representerar en biologisk-analogisk mutation, symbiosis, parasit, adaptation, utrotning eller emergent egenskap av den ursprungliga grejen.

Returnera EXAKT denna JSON-struktur utan markdown-wrapper:
{
  "root": {
    "id": "root",
    "label": "<kortfattad etikett, max 4 ord>",
    "description": "<en mening>",
    "kind": "root",
    "depth": 0,
    "parentId": null,
    "children": [
      {
        "id": "<unik kort id>",
        "label": "<kortfattad etikett, max 4 ord>",
        "description": "<en mening>",
        "kind": "mutation" | "symbiosis" | "parasite" | "adaptation" | "extinction" | "emergence",
        "depth": 1,
        "parentId": "root",
        "children": [
          ... (2 barn per nod på djup 2, inga barn på djup 3)
        ]
      }
    ]
  }
}

Reglerna:
- Root-noden är grejen själv
- Djup 1: exakt 5 grenar (en per biologisk mekanism: mutation, symbiosis, parasite, adaptation, emergence)
- Djup 2: exakt 2 barn per djup-1-nod
- Djup 3: inga barn
- Alla id:n är unika korta strängar (t.ex. "n1", "n2a", etc)
- Returnera bara giltig JSON, inget annat`

function fallbackTree(thing: string): IdeaNode {
  const kinds: NodeKind[] = ['mutation', 'symbiosis', 'parasite', 'adaptation', 'emergence']
  return {
    id: 'root',
    label: thing,
    description: `Ursprunget: ${thing}`,
    kind: 'root',
    depth: 0,
    parentId: null,
    children: kinds.map((kind, i) => ({
      id: `n${i + 1}`,
      label: `${kind} av ${thing}`,
      description: `En ${kind}-gren utgående från ${thing}.`,
      kind,
      depth: 1,
      parentId: 'root',
      children: [0, 1].map(j => ({
        id: `n${i + 1}${j}`,
        label: `sub-${kind}-${j + 1}`,
        description: `Fördjupad ${kind}-gren ${j + 1}.`,
        kind,
        depth: 2,
        parentId: `n${i + 1}`,
        children: [],
      })),
    })),
  }
}

export async function POST(req: NextRequest) {
  const { thing } = await req.json()
  if (!thing || typeof thing !== 'string') {
    return NextResponse.json({ error: 'Saknar fält: thing' }, { status: 400 })
  }

  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json({ root: fallbackTree(thing) })
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
            temperature: 0.85,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ root: fallbackTree(thing) })
    }

    const geminiData = await response.json()
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = JSON.parse(text)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('ideate route error:', err)
    return NextResponse.json({ root: fallbackTree(thing) })
  }
}
