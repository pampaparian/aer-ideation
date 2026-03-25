import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

function stripMarkdown(raw: string): string {
  return raw.replace(/^```json[\s\S]*?\n/i,'').replace(/^```\s*\n/i,'').replace(/\n?```\s*$/i,'').trim()
}

function fallbackChildren(parentId: string, depth: number): IdeaNode[] {
  const defs: Array<{ kind: NodeKind; label: string; desc: string }> = [
    { kind: 'mutation',   label: 'Digital edition',       desc: 'Digital version med högt distributionsvärde' },
    { kind: 'symbiosis',  label: 'Kollaborationsprojekt', desc: 'Samarbete med komplementär konstnär' },
    { kind: 'adaptation', label: 'Prenumerationsmodell',  desc: 'Recurring intäkt via abonnentbas' },
    { kind: 'emergence',  label: 'AI-driven plattform',   desc: 'Ny kategori uppstår via intelligent motor' },
  ]
  return defs.map((d, i) => ({
    id: `${parentId}_${i+1}`, label: d.label, description: d.desc,
    kind: d.kind, depth: depth + 1, parentId, children: [],
  }))
}

export async function POST(req: NextRequest) {
  const {
    rootThing, parentId, parentLabel, parentKind, parentDescription, depth,
    pathChain,  // PathNode[]: full derivation chain from root to this node
    siblings,   // string[]: sibling labels NOT selected at this level
  } = await req.json()

  if (!parentLabel || !parentId)
    return NextResponse.json({ error: 'Saknar parentLabel/parentId' }, { status: 400 })

  const newDepth = (depth ?? 1) + 1

  if (!GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('split: API-nyckel saknas')
    return NextResponse.json({ children: fallbackChildren(parentId, depth ?? 1) })
  }

  // Build context string from path chain
  const chainLabels: string[] = pathChain?.map((n: { label: string }) => n.label) ?? []
  const pathContext = chainLabels.length > 1
    ? `\nKONTEXTKEDJA (hela tankekedjan hittills — generera INTE liknande begrepp):\n${rootThing} \u2192 ${chainLabels.join(' \u2192 ')}\n`
    : ''

  const siblingsContext = siblings && siblings.length > 0
    ? `\nUNDVIK DESSA (redan genererade vid detta steg):\n${(siblings as string[]).join(', ')}\n`
    : ''

  const deepContext = newDepth >= 3
    ? `\nDJUP ${newDepth}: Konceptet är nu smalt och specifikt. Generera alternativa FORMAT, KANALER eller AFFÄRSMODELLER kring detta begrepp — inte fler sub-typer. Välj riktningar som divergerar BORT från redan utforskade grenar.\n`
    : ''

  const systemPrompt = `Du är ett innovationssystem inbyggt i David Stenbecks personliga idéverktyg Ær Ideation.

PERSONA:
David Stenbeck: svensk digital konstnär (Cinema 4D, @dovneon, 260k+), poet (@ultrahavn).
Estetik: minimalism, rymd, litterär tyngd, precision. ULTRAHAVN.
Domän: digital konst, poesi, AI-verktyg, publikationer, förlagsmodeller, pop-ups, utställningar.
Om en idé inte känns som något David skulle bygga, publicera eller driva — är den fel.

MISSION:
Givet ett moderkoncept, generera 4 KONKRETA ALTERNATIVA BEGREPP som strålar utifrån moderkonceptet.
Varje klyvning ska producera genuint DIVERGERANDE alternativ — inte varianter av samma tema.

Returnera ENBART rå JSON. Inga backticks, markdown.

Schema:
{"children":[
{"id":"${parentId}_1","label":"KONKRET NAMN","description":"8 ord","kind":"mutation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_2","label":"KONKRET NAMN","description":"8 ord","kind":"symbiosis","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_3","label":"KONKRET NAMN","description":"8 ord","kind":"adaptation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_4","label":"KONKRET NAMN","description":"8 ord","kind":"emergence","depth":${newDepth},"parentId":"${parentId}","children":[]}
]}

DAVIDS FACIT-KEDJOR:
\"Husbyggnadsbok\" → Digital bok | Prenumerationsmagasin | Workshop-serie | Arkitektur-podcast
\"DIY\" → Möbeltidning | Bygginstruktionsplattform | Flatpack-kollaboration | Pop-up workshop
\"Diktsamling\" → Haikusamling | Elegikatalog | Spoken word-album | Visuell poesi
\"Konstbok\" → Signerad limited edition | Open access PDF | Utställningskatalog | Crowdfundad upplaga
\"Pop-up galleri\" → Residensprogram | Nomadisk utställning | Handelsplats | Kollaborativ installation
\"AI-verktyg\" → Chatbot | Bildgenerator | Kodassistent | Kunskapsmotor

VALIDERINGSKRITERIER:
✓ Publikation, bok, tidskrift, digital release
✓ AI-verktyg, digital plattform
✓ Förlagsmodell, licensiering, prenumeration
✓ Pop-up, installation, utställning, event
✓ Spoken word, podcast, radioformat
✕ Generisk SaaS, corporate, fysisk massproduktion
✕ Granulära fysiska detaljer (material, mått, färg)

FINANSIELL NYKTERHET:
Varije idé måste ha en genomförbar intäktsmodell.
Prenumeration? Licensiering? UpplageFörsäljning? Utställningsarrangör? API-avgift?
Description (8 ord) ska antyda bärigheten.

ANTI-REKURSION (absolut):
1. Label får ALDRIG innehålla moderkonceptets namn: \"${parentLabel}\".
2. Aldrig \"[prefix] ${parentLabel}\" som mönster.
3. Varje barn = ett eget begrepp på egna ben.

label: 1-4 ord
description: 8 ord
children alltid []
Returnera ENBART giltig JSON`

  const userMsg = [
    `Moderkoncept: \"${parentLabel}\" (${parentKind}: ${parentDescription}).`,
    `Rotkontext: \"${rootThing}\".`,
    pathContext,
    siblingsContext,
    deepContext,
    `Generera 4 genuint DIVERGERANDE alternativ. Inga labels får innehålla \"${parentLabel}\".`,
  ].filter(Boolean).join(' ')

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_GENERATIVE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userMsg }] }],
          generationConfig: { temperature: 0.92, maxOutputTokens: 1024, responseMimeType: 'application/json' },
        }),
      }
    )
    if (!resp.ok) {
      console.error('split: HTTP', resp.status)
      return NextResponse.json({ children: fallbackChildren(parentId, depth ?? 1) })
    }
    const gd = await resp.json()
    const raw = gd?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed: { children: IdeaNode[] } = JSON.parse(stripMarkdown(raw))

    // Sanitize: strip recursive labels
    const parentLower = parentLabel.toLowerCase()
    const sanitized = parsed.children.map(child => {
      if (child.label.toLowerCase().includes(parentLower)) {
        console.warn(`split: rekursiv label: "${child.label}" (parent: "${parentLabel}")`)
        return {
          ...child,
          label: child.label
            .replace(new RegExp(parentLabel, 'gi'), '')
            .replace(/\s+/g, ' ')
            .trim() || 'Nytt koncept',
        }
      }
      return child
    })
    return NextResponse.json({ children: sanitized })
  } catch (err) {
    console.error('split: fel -', err)
    return NextResponse.json({ children: fallbackChildren(parentId, depth ?? 1) })
  }
}
