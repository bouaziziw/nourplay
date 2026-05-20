import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const MODEL = process.env.AI_MODERATION_MODEL || 'gpt-4o-mini'

interface ValidateInput {
  title: string
  description: string
  language: string
}

interface ValidateResult {
  score: number
  log: {
    model: string
    checks: Record<string, boolean>
    reasons: string[]
    timestamp: string
  }
}

const SYSTEM_PROMPT = `Tu es un système de modération de contenu vidéo pour une plateforme destinée aux enfants (0-15 ans).
Analyse le titre et la description d'une vidéo et évalue si elle est adaptée à un jeune public.

Réponds uniquement avec un JSON de cette forme :
{
  "score": 0.95,
  "checks": {
    "no_violence": true,
    "no_adult_content": true,
    "no_hate_speech": true,
    "no_inappropriate_language": true,
    "educational_or_entertainment": true
  },
  "reasons": ["Le contenu est éducatif et adapté aux enfants"]
}

Le score doit être entre 0 (totalement inapproprié) et 1 (parfaitement adapté).`

export async function validateVideo(input: ValidateInput): Promise<ValidateResult> {
  const userMessage = `Titre: ${input.title}\nDescription: ${input.description}\nLangue: ${input.language}`

  try {
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.1,
    })

    const raw = JSON.parse(response.choices[0].message.content || '{}') as {
      score?: number
      checks?: Record<string, boolean>
      reasons?: string[]
    }

    const score = typeof raw.score === 'number' ? Math.max(0, Math.min(1, raw.score)) : 0

    return {
      score,
      log: {
        model: MODEL,
        checks: raw.checks ?? {},
        reasons: raw.reasons ?? [],
        timestamp: new Date().toISOString(),
      },
    }
  } catch (error) {
    // En cas d'erreur de l'API IA, on place en NEEDS_REVIEW pour revue humaine
    return {
      score: 0.65,
      log: {
        model: MODEL,
        checks: {},
        reasons: [`Erreur IA : ${error instanceof Error ? error.message : 'inconnue'} — revue humaine requise`],
        timestamp: new Date().toISOString(),
      },
    }
  }
}
