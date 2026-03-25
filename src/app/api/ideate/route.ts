import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

const SYSTEM_PROMPT = `Du är en motor för innovationsbiologi. Givet en 'grej', generera ett förgrenat träd av idénoder.

Returnera ENBART rå JSON, inga markdown-block, ingen kod-wrapper, inga förklaringar. Inga backticks. Bara JSON.

Exempelstruktur (följ exakt samma schema):
{"root":{"id":"root","label":"grejen","description":"vad grejen är","kind":"root","depth":0,"parentId":null,"children":[{"id":"n1","label":"etikett","description":"kort beskrivning","kind":"mutation","depth":1,"parentId":"root","children":[{"id":"n1a","label":"etikett","description":"kort","kind":"mutation","depth":2,"parentId":"n1","children":[]},{"id":"n1b","label":"etikett","description":"kort","kind":"mutation","depth":2,"parentId":"n1","children":[]}]}]}}

Regler:
- Root är grejen själv
- Exakt 5 grenar på djup 1: kind = mutation, symbiosis, parasite, adaptation, emergence (en vardera, i den ordningen)
- Exakt 2 barn per djup-1-nod på djup 2, inga barn på djup 3
- label: max 3 ord. description: max 8 ord. Håll det extremt kort.
- id:n: n1-n5 på djup 1, n1a/n1b, n2a/n2b osv på djup 2
- Returnera ENBART giltig JSON utan några extra tecken utanför JSON-objektet`

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
      description: `En ${kind}-gren.`,
      kind,
      depth: 1,
      parentId: 'root',
      children: [0, 1].map(j => ({
        id: `n${i + 1}${j === 0 ? 'a' : 'b'}`,
        label: `sub-${kind}-${j + 1}`,
        description: `Fördjupad ${kind}-gren.`,
        kind,
        depth: 2,
        parentId: `n${i + 1}`,
        children: [],
      })),
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
    console.error('ideate: GOOGLE_GENERATIVE_AI_API_KEY saknas i miljön')
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
            temperature: 0.7,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('ideate: Gemini HTTP', response.status, response.statusText, '-', err)
      return NextResponse.json({ root: fallbackTree(thing) })
    }

    const geminiData = await response.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('ideate: raw response length', raw.length, 'first50:', raw.slice(0, 50))
    const cleaned = stripMarkdown(raw)
    const parsed = JSON.parse(cleaned)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('ideate: fetch/parse-fel -', err)
    return NextResponse.json({ root: fallbackTree(thing) })
  }
}
