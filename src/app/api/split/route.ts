import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

function stripMarkdown(raw: string): string {
  return raw.replace(/^```json[\s\S]*?\n/i,'').replace(/^```\s*\n/i,'').replace(/\n?```\s*$/i,'').trim()
}

// Fallback uses standalone labels — NEVER references parentLabel to avoid recursion
function fallbackChildren(parentId: string, depth: number): IdeaNode[] {
  const defs: Array<{ kind: NodeKind; label: string; desc: string }> = [
    { kind: 'mutation',   label: 'Direktformat',       desc: 'Kärnan presenterad i renaste möjliga form' },
    { kind: 'symbiosis',  label: 'Hybrid-modell',      desc: 'Samverkar med komplementär aktivör' },
    { kind: 'adaptation', label: 'Premiumsegment',     desc: 'Högvärdesversion för betalningsvillig nisch' },
    { kind: 'emergence',  label: 'Plattformstjänst',   desc: 'Ny infrastruktur uppstår ur konceptets logik' },
  ]
  return defs.map((d, i) => ({
    id: `${parentId}_${i+1}`,
    label: d.label,
    description: d.desc,
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
    return NextResponse.json({ children: fallbackChildren(parentId, depth ?? 1) })
  }

  const systemPrompt = `Du är ett innovationssystem för biologisk konceptklyvning.

FUNDAMENTALT PARADIGM:
Tänk: \"Vilka konkreta alternativ FINNS I VÄRLDEN inom denna kategori?\" INTE: \"Hur modifierar jag moderkonceptets namn?\".

RETURNERA ENBART RÅ JSON. Inga backticks, markdown.

Schema:
{"children":[
{"id":"${parentId}_1","label":"KONKRET NAMN","description":"8 ord","kind":"mutation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_2","label":"KONKRET NAMN","description":"8 ord","kind":"symbiosis","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_3","label":"KONKRET NAMN","description":"8 ord","kind":"adaptation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_4","label":"KONKRET NAMN","description":"8 ord","kind":"emergence","depth":${newDepth},"parentId":"${parentId}","children":[]}
]}

FEW-SHOT KORREKT (konkreta alternativ, INTE modifieringar av moderkonceptets namn):
\"Diktsamling\" → Haikusamling | Elegikatalog | Spoken word-album | Visuell poesi
\"Serieroman\" → Manga | Graphic novel | Webtoon | Stumfilm-adaptation
\"AI-Redaktör\" → Faktacheck-robot | Tonanalysator | Rubrikgenerator | Co-pilot för journalister
\"Kafé\" → Drive-through | Pop-up kök | Ghost kitchen | Automat-kafé
\"Prenumerationstjänst\" → Box-service | Access-modell | Community-prenumeration | Freemium-app
\"Spel\" → Mobilspel | PC-spel | Brädspel | AR-upplevelse
\"Faktakontrollant\" → AI-faktatjänst | Manuell granskare | Crowdsourcad faktakoll | Domänspecialist

FEW-SHOT FEL (undvik ALLTID):
\"Diktsamling\" → Digital diktsamling \u2717 (innehåller moderkonceptet)
\"AI-Redaktör\" → Integrerad AI-Redaktör \u2717 (innehåller moderkonceptet)
\"Kafé\" → Nytt kafé \u2717

KRITISK REGEL:
1. Label får ALDRIG innehålla moderkonceptets namn eller delar av det.
2. Aldrig \"[prefix] [moderbegrepp]\" som \"Integrerad X\", \"Digital X\", \"Modern X\".
3. Varje barn = ett EGET BEGREPP som står på egna ben.

KATEGORIERNA är sekundära filter:
- mutation: väsentlig förvandling
- symbiosis: samverkar med annat system
- adaptation: anpassad till ny nisch
- emergence: ny egenskap uppstår

MISSION: Konkreta, genomförbara affärsidéer med kommersiell potential.
label: 1-4 ord, begreppets riktiga namn
description: 8 ord, affärspotential tydlig
children alltid []
Returnera ENBART giltig JSON`

  const userMsg = `Moderkoncept: \"${parentLabel}\" (${parentKind}: ${parentDescription}). Rotkontext: \"${rootThing}\". Generera 4 konkreta alternativa begrepp UTAN att använda \"${parentLabel}\" i något label-fält.`

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024, responseMimeType: 'application/json' },
        }),
      }
    )
    if (!resp.ok) { console.error('split: HTTP', resp.status); return NextResponse.json({ children: fallbackChildren(parentId, depth ?? 1) }) }
    const gd = await resp.json()
    const raw = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed: { children: IdeaNode[] } = JSON.parse(stripMarkdown(raw))
    // Post-process: remove any label that contains the parentLabel (recursion guard)
    const parentLower = parentLabel.toLowerCase()
    const sanitized = parsed.children.map(child => {
      if (child.label.toLowerCase().includes(parentLower)) {
        console.warn(`split: rekursiv label detekterad och rensad: "${child.label}" (parent: "${parentLabel}")`)
        return { ...child, label: child.label.replace(new RegExp(parentLabel, 'gi'), '').replace(/\\s+/g, ' ').trim() || 'Nytt begrepp' }
      }
      return child
    })
    return NextResponse.json({ children: sanitized })
  } catch (err) {
    console.error('split: fel -', err)
    return NextResponse.json({ children: fallbackChildren(parentId, depth ?? 1) })
  }
}
