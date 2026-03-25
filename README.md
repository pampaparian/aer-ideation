# ÆR IDEATION

Innovationsbiologi. Mata in en grej — få tillbaka ett förgrenat träd av mutationer, symbioser, parasiter, adaptationer och emergenta egenskaper.

## Arkitektur

- **Next.js 14** — App Router, TypeScript
- **Edge Runtime** — `/api/ideate` körs på edge
- **Gemini 1.5 Flash** — AI-motor (fallback-träd om inget API-nyckel)
- **ULTRAHAVN-estetik** — vit bakgrund, 0.5px hairlines, Helvetica, mikrotypografi

## Kom igång

```bash
npm install
cp .env.example .env.local
# Fyll i GOOGLE_GENERATIVE_AI_API_KEY
npm run dev
```

## Biologiska noder

| Kind | Svensk term | Betydelse |
|------|-------------|----------|
| `root` | ursprung | Grejen själv |
| `mutation` | mutation | En förändrad variant |
| `symbiosis` | symbios | Samexistens med annan form |
| `parasite` | parasit | Lever på/av ursprunget |
| `adaptation` | adaption | Anpassning till kontext |
| `extinction` | utrotning | Vad dör när grejen uppstår |
| `emergence` | emergens | Vad som uppstår ur grejen |
