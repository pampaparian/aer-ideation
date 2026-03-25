import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

function stripMarkdown(raw: string): string {
  return raw.replace(/^```json[\s\S]*?\n/i,'').replace(/^```\s*\n/i,'').replace(/\n?```\s*$/i,'').trim()
}

function fallbackChildren(parentId: string, parentLabel: string, depth: number): IdeaNode[] {
  const defs: Array<{ kind: NodeKind; prefix: string }> = [
    { kind: 'mutation',   prefix: 'Ny' },
    { kind: 'symbiosis',  prefix: 'Integrerad' },
    { kind: 'adaptation', prefix: 'Skalad' },
    { kind: 'emergence',  prefix: 'Latent' },
  ]
  return defs.map((d, i) => ({
    id: `${parentId}_${i+1}`,
    label: `${d.prefix} ${parentLabel}`,
    description: `Derivat med kommersiell potential inom ${d.kind}`,
    kind: d.kind,
    depth: depth + 1,
    parentId,
    children: [],
  }))
}

export async function POST(req: NextRequest) {
  const { rootThing, parentId, parentLabel, parentKind, parentDescription, depth } = await req.json()
  if (!parentLabel || !parentId)
    return NextResponse.json({ error: 'Saknar parentLabel/parentId' }, { status: 400 })
  const newDepth = (depth ?? 1) + 1
  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('split: API-nyckel saknas')
    return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
  }

  const systemPrompt = `Du är ett affärsinnovationssystem för biologisk konceptklyvning.

MISSION: Givet ett moderkoncept, generera 4 konkreta avkomma — produkter, tjänster, format eller affarsmodeller man faktiskt kan bygga. Prioritera kommersiell potential och innovationsvärde.

Returnera ENBART rå JSON. Inga backticks, markdown.

Schema:
{"children":[
{"id":"${parentId}_1","label":"KONKRET NAMN","description":"8 ord","kind":"mutation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_2","label":"KONKRET NAMN","description":"8 ord","kind":"symbiosis","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_3","label":"KONKRET NAMN","description":"8 ord","kind":"adaptation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_4","label":"KONKRET NAMN","description":"8 ord","kind":"emergence","depth":${newDepth},"parentId":"${parentId}","children":[]}
]}

FEW-SHOT KEDJA (exakt denna klyvningsstil):
"Diktsamling" → Klassisk diktsamling / Modern diktsamling / Illustrerad diktbok / Postmodern diktbok
"Modern diktsamling" → Digital diktsamling / Tryckt konstbok / Poetisk Ljudbok / Instagram-dikter
"Serieroman" → Manga / Grafisk roman / Webtoon / Faktaseriebok
"Prenumerationstjänst" → Freemium-app / Box-tjänst / Tillgångsmodell / Community-prenumeration

REGELN: Varje klyvning producerar DIVERGERANDE alternativ — inte varianter på varandra, utan tydliga vägval.

KATEGORIERNA som filter:
- mutation: väsentlig förvandling
- symbiosis: samverkar med annat system
- adaptation: anpassad till ny nisch
- emergence: ny egenskap uppstår

ABSOLUT FÖRBJUDET i label:
· "mutation av [parent]", prefix + moderkonceptets namn
· suffix " variant" " version" " form"

label: 1-4 ord, specifikt namn
description: 8 ord, affärspotential synlig
children alltid []
Returnera ENBART giltig JSON`

  const userMsg = `Moderkoncept: "${parentLabel}" (${parentKind}). Rotkontext: "${rootThing}". Klipp upp i 4 divergerande affärsidéer.`

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 1024, responseMimeType: 'application/json' },
        }),
      }
    )
    if (!resp.ok) { console.error('split: HTTP', resp.status); return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) }) }
    const gd = await resp.json()
    const raw = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return NextResponse.json(JSON.parse(stripMarkdown(raw)))
  } catch (err) {
    console.error('split: fel -', err)
    return NextResponse.json({ children: fallbackChildren(parentId, parentLabel, depth ?? 1) })
  }
}
