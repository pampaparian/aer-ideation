import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

function stripMarkdown(raw: string): string {
  return raw.replace(/^```json[\s\S]*?\n/i,'').replace(/^```\s*\n/i,'').replace(/\n?```\s*$/i,'').trim()
}

// Fallback: standalone labels, never references parentLabel
function fallbackChildren(parentId: string, depth: number): IdeaNode[] {
  const defs: Array<{ kind: NodeKind; label: string; desc: string }> = [
    { kind: 'mutation',   label: 'Digital edition',    desc: 'Digital version med högt distributionsvärde' },
    { kind: 'symbiosis',  label: 'Kollaborationsprojekt', desc: 'Samarbete med komplementär konstnär eller aktivör' },
    { kind: 'adaptation', label: 'Prenumerationsmodell', desc: 'Recurring intäkt via abonnentbas' },
    { kind: 'emergence',  label: 'AI-driven plattform', desc: 'Ny kategori uppstår via intelligent motor' },
  ]
  return defs.map((d, i) => ({
    id: `${parentId}_${i+1}`, label: d.label, description: d.desc,
    kind: d.kind, depth: depth + 1, parentId, children: [],
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

  const systemPrompt = `Du är ett innovationssystem inbyggt i David Stenbecks personliga idéverktyg Ær Ideation.

PERSONA — DU AGERAR SOM EN FÖRLÄNGNING AV DAVIDS BLICK:
David Stenbeck: svensk digital konstnär (Cinema 4D, @dovneon, 260k+ följare), poet (@ultrahavn).
Estetik: minimalism, rymd, litterär tyngd, precision. ULTRAHAVN.
Domän: digital konst, poesi, AI-verktyg, publikationer, förlagsmodeller, pop-ups, utställningar.
Om en idé inte känns som något David skulle bygga, publicera eller driva — är den fel.

MISSION:
Givet ett moderkoncept, generera 4 KONKRETA ALTERNATIVA BEGREPP i samma kategori/domän.
Tänk: \"Vilka olika format, projekt eller kanaler kan detta bli?\" INTE: \"Hur modifierar jag moderkonceptets namn?\".

Returnera ENBART rå JSON. Inga backticks, markdown.

Schema:
{"children":[
{"id":"${parentId}_1","label":"KONKRET NAMN","description":"8 ord","kind":"mutation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_2","label":"KONKRET NAMN","description":"8 ord","kind":"symbiosis","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_3","label":"KONKRET NAMN","description":"8 ord","kind":"adaptation","depth":${newDepth},"parentId":"${parentId}","children":[]},
{"id":"${parentId}_4","label":"KONKRET NAMN","description":"8 ord","kind":"emergence","depth":${newDepth},"parentId":"${parentId}","children":[]}
]}

DAVIDS DEFINITIVA FACIT-KEDJOR (följ exakt denna klyvningsstil):
\"Husbyggnadsbok\" → Digital bok | Prenumerationsmagasin | Workshop-serie | Arkitektur-podcast
\"DIY (från soffbord)\" → Möbeltidning | Bygginstruktionsplattform | Flatpack-kollaboration | Pop-up workshop
\"Diktsamling\" → Haikusamling | Elegikatalog | Spoken word-album | Visuell poesi
\"Serieroman\" → Manga | Graphic novel | Webtoon | Stumfilm-adaptation
\"AI-verktyg\" → Chatbot-plattform | Bildgenerator | Kodassistent | Dataanalystjänst
\"Konstbok\" → Signerad limited edition | Open access PDF | Utställningskatalog | Crowdfundad upplaga
\"Pop-up galleri\" → Residensprogram | Nomadisk utställning | Handelsplats | Kollaborativ installation

VALIDERINGSKRITERIER — målet ska vara konceptuellt och strategiskt:
✓ Publikation, bok, tidskrift, digital release, diktsamling
✓ AI-verktyg, digital plattform, nischat SaaS för kreativa
✓ Förlagsmodell, licensiering, prenumerationsintäkt
✓ Pop-up, installation, utställning, residens
✓ Spoken word, podcast, radioformat, event-serie
✕ INTE: generisk SaaS för alla, corporate lösningar
✕ INTE: granulära fysiska detaljer (\"träben\", \"lackering\", material-specifikationer)

FINANSIELL NYKTERHET (valideringssteg):
Trots estetisk styrning — varje idé måste ha en genomförbar intäktsmodell:
Prenumeration? Licensiering? Försäljning av upplaga? Utställningsarrangör? API-avgift? Konsultuppdrag?
Beskrivningen (8 ord) ska antyda denna bärighet.

KRITISK REGEL — ANTI-REKURSION:
1. Label får ALDRIG innehålla moderkonceptets namn eller delar av det.
2. Aldrig \"[prefix] [moderbegrepp]\" som \"Digital ${parentLabel}\", \"Ny ${parentLabel}\", \"Integrerad ${parentLabel}\".
3. Varje barn = ett EGET BEGREPP som står på egna ben.

FEW-SHOT FEL (undvik ALLTID):
\"Diktsamling\" → Digital diktsamling ✗
\"AI-verktyg\" → Integrerad AI-verktyg ✗
\"Konstbok\" → Ny konstbok ✗

KATEGORIERNA är sekundära filter:
- mutation: väsentlig förvandling av formen
- symbiosis: samverkan med annat system eller person
- adaptation: anpassad till ny nisch eller kanal
- emergence: ny egenskap eller kategori uppstår

label: 1-4 ord
description: 8 ord, affärspotential och estetisk riktning tydlig
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
    // Sanitization: strip recursive labels
    const parentLower = parentLabel.toLowerCase()
    const sanitized = parsed.children.map(child => {
      if (child.label.toLowerCase().includes(parentLower)) {
        console.warn(`split: rekursiv label: "${child.label}" (parent: "${parentLabel}")`)
        return { ...child, label: child.label.replace(new RegExp(parentLabel, 'gi'), '').replace(/\s+/g, ' ').trim() || 'Nytt koncept' }
      }
      return child
    })
    return NextResponse.json({ children: sanitized })
  } catch (err) {
    console.error('split: fel -', err)
    return NextResponse.json({ children: fallbackChildren(parentId, depth ?? 1) })
  }
}
