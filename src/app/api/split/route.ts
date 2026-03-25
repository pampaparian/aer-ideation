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

function fallbackChildren(parentId: string, parentLabel: string, depth: number): IdeaNode[] {
  const kinds: NodeKind[] = ['mutation', 'symbiosis', 'adaptation', 'emergence']
  const adjectives = ['Komprimerad', 'Distribuerad', 'Hybrid', 'Latent']
  return kinds.map((kind, i) => ({
    id: `${parentId}_${i + 1}`,
    label: `${adjectives[i]} ${parentLabel}`,
    description: `En vidare derivat via biologisk ${kind}`,
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

  const newDepth = (depth ?? 1) + 1

  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('split: API-nyckel saknas')
    return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
  }

  const systemPrompt = `Du är en biologisk klyv-motor för innovationsbiologi. Givet ett moderkoncept, generera 4 specifika avkomma.

Returnera ENBART rå JSON. Inga backticks, inga markdown.

Schema:
{"children":[
{"id":"${parentId}_1","label":"SPECIFIKT NAMN","description":"8 ord","kind":"mutation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_2","label":"SPECIFIKT NAMN","description":"8 ord","kind":"symbiosis","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_3","label":"SPECIFIKT NAMN","description":"8 ord","kind":"adaptation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_4","label":"SPECIFIKT NAMN","description":"8 ord","kind":"emergence","depth":${newDepth},"parentId":"${parentId}","children":[]}
]}

LABEL-REGLER — absolut tvångsbindande:
Label ska vara det specifika konceptets RIKTIGA NAMN. Aldrig prefix + moderkonceptet.

Korrekt: Haiku, Elegi, Sonet, Friverspoesi (om moderkonceptet är Diktsamling)
Korrekt: Blandning, Förstoring, Abstraktion, Reduktion (om moderkonceptet är Teckning)
Fel: Mutation av Diktsamling, Adaptation av Diktsamling, Diktsamling-variant

ABSOLUT FÖRBJUDET:
· frasen "mutation av"
· frasen "symbios av"
· frasen "adaptation av"
· suffix " variant", " form", " version"
· moderkonceptets namn som suffix

description: exakt 8 ord, konkret
children alltid []
Returnera ENBART giltig JSON`

  const userMsg = `Moderkoncept: "${parentLabel}" (${parentKind}). Rotkontext: "${rootThing}". Generera 4 specifika avkomma.`

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
      console.error('split: Gemini HTTP', response.status)
      return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
    }
    const geminiData = await response.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = JSON.parse(stripMarkdown(raw))
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('split: fel -', err)
    return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
  }
}
