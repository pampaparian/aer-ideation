import { NextRequest, NextResponse } from 'next/server'
import type { IdeaNode, NodeKind } from '@/lib/types'

export const runtime = 'edge'

const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY

const SYSTEM_PROMPT = `Du är en motor för innovationsbiologi. Givet en 'grej', generera rotobjekt med exakt 5 barn.

Returnera ENBART rå JSON. Inga backticks, inga markdown, inga förklaringar.

Schema:
{"root":{"id":"root","label":"GREJEN","description":"8 ord","kind":"root","depth":0,"parentId":null,"children":[
{"id":"n1","label":"SPECIFIKT NAMN","description":"8 ord","kind":"mutation","depth":1,"parentId":"root","children":[]},
{"id":"n2","label":"SPECIFIKT NAMN","description":"8 ord","kind":"symbiosis","depth":1,"parentId":"root","children":[]},
{"id":"n3","label":"SPECIFIKT NAMN","description":"8 ord","kind":"parasite","depth":1,"parentId":"root","children":[]},
{"id":"n4","label":"SPECIFIKT NAMN","description":"8 ord","kind":"adaptation","depth":1,"parentId":"root","children":[]},
{"id":"n5","label":"SPECIFIKT NAMN","description":"8 ord","kind":"emergence","depth":1,"parentId":"root","children":[]}
]}}

LABEL-REGLER — absolut tvångsbindande:
Label ska vara det specifika konceptets RIKTIGA NAMN. Aldrig ett prefix + originalkonceptet.

Korrekt: Diktsamling, Lärobok, Serieroman, Kokbok, Självbiografi
Fel: Mutation av bok, Symbios av bok, Bok-variant, Adaptation av bok

Fler exempel:
- Input "stol" → Hammock, Kontorsstol, Gungestol, Pall, Hängmatta
- Input "hus" → Herrgard, Nomadtält, Trädkoja, Flytande hem, Bunker
- Input "musik" → Vaggsång, Protestsång, Opera, Remixalbum, Fri jazz
- Input "film" → Dokumentar, Animationsfilm, Tyst film, Kortfilm, Hemvideo

ABSOLUT FÖRBJUDET i label-fältet:
· frasen "mutation av"
· frasen "symbios av"
· frasen "adaptation av"
· frasen "parasit av"
· frasen "emergens av"
· suffix " variant" eller " form"
· originalkonceptets namn som suffix

description: exakt 8 ord, konkret och specifik
children alltid []
Returnera ENBART giltig JSON`

const KIND_NAMES: Record<string, string[]> = {
  mutation:   ['Omformad', 'Förändrad', 'Omvandlad'],
  symbiosis:  ['Förenad', 'Samverkan', 'Hållbar'],
  parasite:   ['Béroende', 'Utnyttjad', 'Parasitisk'],
  adaptation: ['Anpassad', 'Skalbar', 'Flexibel'],
  extinction: ['Utdöd', 'Försvunnen', 'Obsolet'],
  emergence:  ['Framväxande', 'Ny', 'Latent'],
}

function fallbackRoot(thing: string): IdeaNode {
  const kinds: NodeKind[] = ['mutation', 'symbiosis', 'parasite', 'adaptation', 'emergence']
  return {
    id: 'root',
    label: thing,
    description: `Ursprungskonceptet för utforskning`,
    kind: 'root',
    depth: 0,
    parentId: null,
    children: kinds.map((kind, i) => ({
      id: `n${i + 1}`,
      label: `${KIND_NAMES[kind]?.[0] ?? kind} ${thing}`,
      description: `En ${kind}-derivat av ursprungskonceptet`,
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
    console.error('ideate: API-nyckel saknas')
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
      console.error('ideate: Gemini HTTP', response.status)
      return NextResponse.json({ root: fallbackRoot(thing) })
    }
    const geminiData = await response.json()
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = JSON.parse(stripMarkdown(raw))
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('ideate: fel -', err)
    return NextResponse.json({ root: fallbackRoot(thing) })
  }
}
