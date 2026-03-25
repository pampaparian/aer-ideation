import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

function stripMarkdown(raw: string): string {
  return raw
    .replace(/^```json[\s\S]*?\n/i, '')
    .replace(/^```\s*\n/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

function fallbackChildren(
  parentId: string,
  parentLabel: string,
  depth: number
): IdeaNode[] {
  const kinds: NodeKind[] = ['mutation', 'symbiosis', 'parasite', 'adaptation']
  return kinds.map((kind, i) => ({
    id: `${parentId}_${kind}`,
    label: `${kind} av ${parentLabel}`,
    description: `En ${kind}-form av ${parentLabel}`,
    kind,
    depth: depth + 1,
    parentId,
    children: [],
  }))
}

export async function POST(req: NextRequest) {
  const { rootThing, parentId, parentLabel, parentKind, parentDescription, depth } =
    await req.json()

  if (!parentLabel || !parentId) {
    return NextResponse.json({ error: 'Saknar parentLabel eller parentId' }, { status: 400 })
  }

  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('split: GOOGLE_GENERATIVE_AI_API_KEY saknas')
    return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
  }

  const newDepth = (depth ?? 1) + 1

  const systemPrompt = `Du är en biologisk klyv-motor för innovationsbiologi. Givet ett moderkoncept, generera 4 specifika avkomma.

Returnera ENBART rå JSON. Inga markdown-block, inga backticks, inga förklaringar.

Schema:
{"children":[
{"id":"${parentId}_1","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"mutation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_2","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"symbiosis","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_3","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"adaptation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_4","label":"SPECIFIKT NAMN","description":"8 ord konkret","kind":"emergence","depth":${newDepth},"parentId":"${parentId}","children":[]}
]}

VIKTIGT:
- label: det specifika konceptets faktiska namn (INTE "X variant" eller "mutation av Y")
- Varje barn ska vara ett konkret, namngivet begrepp som är ett specifikt derivat av "${parentLabel}"
- description: exakt 8 ord konkret
- children alltid []
- Returnera ENBART giltig JSON`

  const userMsg = `Moderkoncept: ${parentLabel} (${parentKind}: ${parentDescription}). Rotkontext: ${rootThing}. Generera 4 biologiska avkomma.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) {
      const err = await response.text()
      console.error('split: Gemini HTTP', response.status, '-', err)
      return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
    }

    const geminiData = await response.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    console.log('split: raw length', raw.length, 'parent:', parentLabel)
    const cleaned = stripMarkdown(raw)
    const parsed = JSON.parse(cleaned)
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('split: fel -', err)
    return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
  }
}
