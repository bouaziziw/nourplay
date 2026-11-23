import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AgeRating, VideoValidationStatus } from '@nourplay/db'

export type VideoStatus = 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW'

export interface ValidateInput {
  videoId: string
  title: string
  description?: string | null
  language?: string | null
  requestedAgeRating: string
  durationSec?: number | null
  sourceSlug?: string
  thumbnailUrl?: string | null
  tags?: string[]
  playlists?: Array<{ id: string; name: string; totalVideos: number }>
}

export interface ValidateResult {
  score: number
  status: VideoStatus
  log: Record<string, unknown>
}

interface HttpResponse {
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  arrayBuffer(): Promise<ArrayBuffer>
  json(): Promise<unknown>
  text(): Promise<string>
}

interface AIConfig {
  provider: 'gemini' | 'openai' | 'groq' | 'custom'
  apiKey: string
  baseURL: string
  model: string
  timeoutMs: number
}

// Motifs de sécurité renforcée pour les moins de 13 ans (Horreur, violence, armes, sexualité, romance/baisers, tromperies)
export const SENSITIVE_UNDER13_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // 1. Horreur populaire, jumpscares, créatures anxiogènes
  {
    pattern: /\b(huggy\s*wuggy|poppy\s*playtime|siren\s*head|fnaf|five\s*nights\s*at\s*freddy'?s|slenderman|momo\s*challenge|skibidi\s*toilet\s*horror|jumpscare|jump\s*scare|creepypasta|terror|gore|torture|bloody)\b/i,
    reason: "Contenu horrifique, jumpscare ou créature anxiogène interdit pour les enfants",
  },
  // 2. Violence extrême, massacres, armes réelles
  {
    pattern: /\b(fusillade|massacre|assassinat|démembrement|décapitation|suicide|mutilation|overdose|égorgement|attentat)\b/i,
    reason: "Scène de violence extrême, armes ou mort interdite pour les enfants",
  },
  // 3. Sexualité, érotisme, nudité, tenues suggestives, tags suggestifs (#hot, #sexy)
  {
    pattern: /(?:#|\b)(?:sexy|nude|erotic|hentai|ecchi|porn|porno|sexe|sexuel|sexuelle|strip|lingerie|underwear|sous-vêtements?|cleavage|décolleté\s*plongeant|fétich|nsfw|sensual|hot\s*(?:girl|babe|kiss|romance|sexy|model|cosplay|teen|scene|video))\b|#(?:hot|sexy|nsfw|sensual|erotic|lingerie|kiss|baiser)\b/i,
    reason: "Contenu à caractère sexuel, érotique, suggestif ou tag adulte interdit pour les enfants",
  },
  // 4. Baisers romantiques/intimes, bisous, romance adulte, couples s'embrassant, intimité, cosplay romantique
  {
    pattern: /(?:#|\b)(?:baisers?|bisous?|bizous?|french\s*kiss|kiss|kisses|kissing|embrass(?:e|ent|er|ades?)|roule\s*une\s*pelle|smooch|makeout|making\s*out|flirt|drague|séduction|romance\s*sensuelle|cosplays?\s*romantiques?|couple\s*kiss|girls?\s*kissing|boys?\s*kissing|femmes?\s*(?:qui\s*)?(?:font\s*des\s*|s')?bi[sz]ous?|hommes?\s*(?:qui\s*)?(?:font\s*des\s*|s')?bi[sz]ous?|lesbian\s*kiss|gay\s*kiss|yuri|yaoi|scène\s*intime|intimité\s*de\s*couple)\b/i,
    reason: "Baisers romantiques/intimes, romance ou démonstration d'intimité interdits pour les profils enfants de moins de 13 ans",
  },
  // 5. Arnaques, paris d'argent, casinos
  {
    pattern: /\b(free\s*robux|free\s*vbucks|générateur\s*de\s*cartes|casino\s*enfant|betting|paris\s*sportifs?)\b/i,
    reason: "Incitation aux jeux d'argent ou arnaques interdite pour les enfants",
  },
]

function isTargetingUnder13(requestedRating?: string | null): boolean {
  if (!requestedRating) return true
  const r = requestedRating.toUpperCase().replace(/[-_]/g, '')
  return r.includes('ALL') || r.includes('4') || r.includes('7') || r.includes('10')
}

const SYSTEM_PROMPT = `Tu es un agent IA expert et rigoureux dans la modération de contenus vidéo destinés aux enfants et adolescents (plateforme NourPlay).
Ton objectif est de garantir un environnement 100% sûr, sain, bienveillant et éducatif, tout en permettant aux vidéos conformes et de qualité d'être approuvées rapidement.

Analyse attentivement le titre, la description, les tags, les playlists, la langue, ainsi que la miniature fournie.

Vérifie les critères suivants :
- Violence : violence physique ou psychologique, armes, cruauté envers les animaux, scènes de combat sanglantes ou traumatisantes.
- Nudité, sexualité & intimité amoureuse :
  * Nudité, tenues suggestives/inappropriées, insinuations sexuelles, pornographie, fétichisme.
  * INTERDICTION STRICTE pour les profils enfants (< 13 ans : all_ages, 7_plus, 4_plus, 10_plus) de TOUT contenu romantique sensuel ou intime : baisers sur la bouche (bisous de couple, french kiss, deux femmes ou deux hommes ou couple s'embrassant amoureusement), scènes de lit, intimité amoureuse physique, drague ou flirt sensuel.
  * Dans les miniatures, images ou titres : Si deux personnes s'embrassent sur la bouche ou manifestent une intimité amoureuse/sensuelle, classe OBLIGATOIREMENT en violation "sexual_content" (sévérité high) avec action "remove", décision REJETE, et age_rating minimum "16_plus".
- Substances nocives : consommation ou promotion de drogues, alcool, tabac, cigarettes électroniques.
- Toxicité : discours de haine, cyberharcèlement, intimidation, insultes graves, discrimination.
- Risques vitaux : automutilation, idées suicidaires, défis dangereux (challenges TikTok/YouTube mettant la vie en danger).
- Illégalité & escroquerie : arnaques, piratage, incitation au vol, paris/jeux d'argent illégaux.
- Contenu choquant / anxiogène : jump scares extrêmes, gore, horreur, théories du complot anxiogènes.

Règles de décision :
1. APPROUVE : Si le contenu est un dessin animé sain, une comptine, une vidéo éducative, un tutoriel créatif, du divertissement familial ou adapté aux enfants/jeunes, sans aucun risque de violation détecté.
   Assigne la tranche d'âge appropriée et un niveau de confiance élevé (ex. 0.90 à 0.99).
2. REJETE :
   - Si les éléments prouvent sans ambiguïté une violation grave (pornographie, violence explicite, drogues, haine, incitation au suicide ou danger manifeste).
   - POUR LES PROFILS ENFANTS (< 13 ans : all_ages, 7_plus, 4_plus, 10_plus) : Si le contenu dépasse la tranche demandée (classé en 13_plus, 16_plus ou 18_plus), s'il comporte des tags suggestifs (#hot, #sexy, #nsfw), des baisers romantiques/amoureux/intimes (cosplay, dessin animé ou réel), de la romance adulte ou du contenu à caractère sexuel/sensuel : la décision DOIT ÊTRE OBLIGATOIREMENT "REJETE" (et JAMAIS "A_VERIFIER"), avec recommended_action "reject", violation "sexual_content" de sévérité "high" et action "remove".
3. A_VERIFIER : STRICTEMENT LIMITÉ aux cas où la vidéo/miniature est techniquement inaudible ou corrompue. Ne JAMAIS utiliser A_VERIFIER pour un contenu romantique, suggestif, mature ou violent destiné aux enfants : il doit être REJETE sans exception.

RÈGLES STRICTES POUR LES ENFANTS DE MOINS DE 13 ANS (tranches all_ages, 7_plus, 4_plus, 10_plus) :
- Tolérance ZÉRO pour toute violence, jumpscares, personnages anxiogènes ou d'horreur populaire (ex. Huggy Wuggy, Poppy Playtime, Siren Head, FNAF, Skibidi Horror), monstres terrifiants, armes réalistes, vulgarité, sexualisation, baisers romantiques/intimes sur la bouche (bisous de couple, deux femmes ou deux hommes s'embrassant), tags suggestifs (#hot) ou romance adulte.
- En cas de titre ou miniature trompeuse ou de thème non adapté aux enfants de moins de 13 ans, classe impérativement en REJETE avec age_rating '13_plus' ou supérieur et recommended_action "reject".
- Une vidéo pour les moins de 13 ans ne peut être APPROUVÉE que si l'environnement est totalement sain, bienveillant et sans aucun doute raisonnable.

Tranches d'âge ("age_rating") :
- all_ages : Contenu universel pour tous, y compris les tout-petits (doux, bienveillant, comptines, animaux, éveil).
- 7_plus : Contenu enfants primaires (aventures gentilles, jeux vidéo tout public, découvertes).
- 13_plus : Contenu début d'adolescence (science, culture, divertissement ados sans sexualité ni drogues).
- 16_plus : Grands adolescents (thèmes plus sérieux, pas de pornographie ni violence extrême).
- 18_plus : Adultes uniquement.

Réponds obligatoirement et UNIQUEMENT avec un objet JSON valide (sans texte d'introduction ni balises markdown supplémentaires) ayant la structure suivante :
{
  "video_id": "string",
  "decision": "APPROUVE | REJETE | A_VERIFIER",
  "age_rating": "all_ages | 7_plus | 13_plus | 16_plus | 18_plus",
  "requested_age_rating": "string",
  "confidence": 0.95,
  "summary": "Résumé factuel et clair de la décision",
  "reasons": ["Raison 1", "Raison 2"],
  "violations": [{
    "category": "violence | nudity | sexual_content | drugs | alcohol | tobacco | hate_speech | harassment | self_harm | suicide | illegal_content | fraud | spam | misinformation | shocking_content | other",
    "severity": "none | low | medium | high",
    "timestamp_start": "00:00:00",
    "timestamp_end": "00:00:00",
    "evidence": "Preuve observable",
    "action": "allow | age_restrict | blur | mute | remove | review"
  }],
  "recommended_action": "publish | reject | age_restrict | human_review",
  "review_priority": "low | medium | high"
}`

@Injectable()
export class VideoValidationService {
  private readonly logger = new Logger(VideoValidationService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Résout la configuration IA à partir des variables d'environnement.
   */
  private resolveAIConfig(): AIConfig {
    const timeoutMs = Number(process.env.AI_MODERATION_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS) || 45000
    const explicitProvider = process.env.AI_PROVIDER?.toLowerCase()

    // 1. Google Gemini (par défaut / recommandé)
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
    if (explicitProvider === 'gemini' || (!explicitProvider && geminiKey)) {
      if (!geminiKey) {
        throw new Error('GEMINI_API_KEY est requis pour le mode Gemini.')
      }
      return {
        provider: 'gemini',
        apiKey: geminiKey,
        baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: process.env.AI_MODERATION_MODEL || 'gemini-3-flash-preview',
        timeoutMs,
      }
    }

    // 2. Groq
    const groqKey = process.env.GROQ_API_KEY
    if (explicitProvider === 'groq' || (!explicitProvider && groqKey)) {
      if (!groqKey) throw new Error('GROQ_API_KEY est requis pour Groq.')
      return {
        provider: 'groq',
        apiKey: groqKey,
        baseURL: 'https://api.groq.com/openai/v1',
        model: process.env.AI_MODERATION_MODEL || 'llama-3.3-70b-versatile',
        timeoutMs,
      }
    }

    // 3. OpenAI ou compatible
    const openAiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
    if (openAiKey) {
      return {
        provider: 'openai',
        apiKey: openAiKey,
        baseURL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.AI_MODERATION_MODEL || 'gpt-4o-mini',
        timeoutMs,
      }
    }

    throw new Error('Aucune clé API IA configurée (GEMINI_API_KEY ou OPENAI_API_KEY).')
  }

  /**
   * Télécharge une image et la convertit en data URL base64.
   */
  private async fetchImageAsDataUrl(imageUrl: string, timeoutMs = 8000): Promise<string | null> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await (fetch(imageUrl as never, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; NourPlayBot/1.0)',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      } as never) as unknown as Promise<HttpResponse>)
      if (!res.ok) return null
      const contentType = res.headers.get('content-type') || 'image/jpeg'
      const buffer = await res.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      return `data:${contentType};base64,${base64}`
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  private isTrustedImageUrl(value: string): boolean {
    try {
      const url = new URL(value)
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
      return ['i.ytimg.com', 'img.youtube.com', 'i.vimeocdn.com', 'www.dailymotion.com'].includes(url.hostname)
        || url.hostname.endsWith('.ytimg.com')
        || url.hostname.endsWith('.vimeocdn.com')
        || url.hostname.endsWith('.dmcdn.net')
        || url.hostname.endsWith('.dailymotion.com')
        || url.hostname.endsWith('.googleusercontent.com')
        || url.hostname.endsWith('.cloudfront.net')
        || url.hostname.endsWith('.nourplay.app')
    } catch {
      return false
    }
  }

  private extractJson(text: string): Record<string, unknown> {
    const trimmed = text.trim()
    try {
      return JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (match?.[1]) {
        return JSON.parse(match[1].trim()) as Record<string, unknown>
      }
      const firstBrace = trimmed.indexOf('{')
      const lastBrace = trimmed.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>
      }
      throw new Error('Impossible d’extraire un objet JSON valide de la réponse de modération.')
    }
  }

  private ageRank(value: string): number {
    return value === 'all_ages' ? 0
      : value === '7_plus' ? 2
        : value === '13_plus' ? 4
          : value === '16_plus' ? 5 : 6
  }

  private requestedAgeRank(value?: string | null): number {
    switch (value) {
      case 'AGE_4_PLUS': return 1
      case 'AGE_7_PLUS': return 2
      case 'AGE_10_PLUS': return 3
      case 'AGE_13_PLUS': return 4
      default: return 0
    }
  }

  /**
   * Analyse et valide une vidéo via le modèle IA configuré.
   */
  async validateVideo(input: ValidateInput): Promise<ValidateResult> {
    const isUnder13 = isTargetingUnder13(input.requestedAgeRating)
    const textToCheck = `${input.title || ''} ${input.description || ''} ${input.tags?.join(' ') || ''}`

    // Guardrail de sécurité immédiat pour les moins de 13 ans (rejet instantané sans appel réseau)
    if (isUnder13) {
      for (const guard of SENSITIVE_UNDER13_PATTERNS) {
        if (guard.pattern.test(textToCheck)) {
          const isSexualOrRomance = guard.reason.includes('sexuel') || guard.reason.includes('Baisers')
          const log = {
            video_id: input.videoId,
            decision: 'REJETE',
            age_rating: isSexualOrRomance ? '16_plus' : '18_plus',
            requested_age_rating: input.requestedAgeRating,
            confidence: 1.0,
            summary: `Rejet automatique de sécurité pour les moins de 13 ans : ${guard.reason}.`,
            reasons: [guard.reason],
            violations: [{
              category: isSexualOrRomance ? 'sexual_content' : 'shocking_content',
              severity: 'high',
              evidence: `Détection de termes interdits pour les enfants : "${textToCheck.slice(0, 100)}"`,
              action: 'remove',
            }],
            model: 'rule-engine-under13',
            analyzed_at: new Date().toISOString(),
          }
          return { score: 1.0, status: 'REJECTED', log }
        }
      }
    }

    let config: AIConfig
    try {
      config = this.resolveAIConfig()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Configuration IA introuvable'
      return {
        score: 0,
        status: 'NEEDS_REVIEW',
        log: {
          video_id: input.videoId,
          decision: 'A_VERIFIER',
          summary: `Validation automatique indisponible: ${message}`,
          reasons: [message],
          confidence: 0,
          model: 'unknown',
          analyzed_at: new Date().toISOString(),
        },
      }
    }

    const textPayload = [
      `video_id: ${input.videoId}`,
      `Tranche demandée: ${input.requestedAgeRating}`,
      `Titre: ${input.title}`,
      `Description: ${input.description || '(absente)'}`,
      `Langue: ${input.language || 'fr'}`,
      `Plateforme: ${input.sourceSlug || '(inconnue)'}`,
      `Durée en secondes: ${input.durationSec ?? 'inconnue'}`,
      `Tags: ${input.tags?.join(', ') || '(aucun)'}`,
      `Playlists associées: ${JSON.stringify(input.playlists ?? [])}`,
      `Miniature fournie: ${input.thumbnailUrl ? 'oui' : 'non'}`,
    ].join('\n')

    const contentParts: Array<Record<string, unknown>> = [
      { type: 'text', text: textPayload },
    ]

    // Si une miniature de confiance est présente, la convertir en base64 pour analyse visuelle
    if (input.thumbnailUrl && this.isTrustedImageUrl(input.thumbnailUrl)) {
      try {
        const dataUrl = await this.fetchImageAsDataUrl(input.thumbnailUrl)
        if (dataUrl && dataUrl.startsWith('data:')) {
          contentParts.push({ type: 'image_url', image_url: { url: dataUrl } })
        }
      } catch (err) {
        this.logger.debug(`Impossible de charger la miniature pour analyse visuelle: ${String(err)}`)
      }
    }

    const fallbackModels = config.provider === 'gemini'
      ? [config.model, 'gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-flash-latest', 'gemini-flash-lite-latest'].filter((m, i, arr) => arr.indexOf(m) === i)
      : [config.model]

    let rawContent: string | null = null
    let usedModel = config.model
    let lastError: unknown = null

    for (const modelToTry of fallbackModels) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), config.timeoutMs)
      try {
        const cleanBaseUrl = config.baseURL.replace(/\/+$/, '')
        const endpoint = cleanBaseUrl.endsWith('/chat/completions')
          ? cleanBaseUrl
          : `${cleanBaseUrl}/chat/completions`

        const response = await (fetch(endpoint as never, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: modelToTry,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: contentParts },
            ],
            response_format: { type: 'json_object' },
            max_tokens: 3500,
            temperature: 0.1,
          }),
        } as never) as unknown as Promise<HttpResponse>)

        if (!response.ok) {
          const errText = await response.text().catch(() => '')
          throw new Error(`HTTP ${response.status} - ${errText.slice(0, 300)}`)
        }

        const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> }
        const text = data?.choices?.[0]?.message?.content
        if (typeof text === 'string' && text.trim()) {
          rawContent = text
          usedModel = modelToTry
          break
        }
      } catch (err) {
        lastError = err
      } finally {
        clearTimeout(timer)
      }
    }

    if (!rawContent) {
      const errDetail = lastError instanceof Error ? lastError.message : String(lastError || 'Réponse vide')
      return {
        score: 0,
        status: 'NEEDS_REVIEW',
        log: {
          video_id: input.videoId,
          decision: 'A_VERIFIER',
          summary: `Erreur du fournisseur IA (${config.provider}): ${errDetail}`,
          reasons: [errDetail],
          confidence: 0,
          model: usedModel,
          analyzed_at: new Date().toISOString(),
        },
      }
    }

    try {
      const parsed = this.extractJson(rawContent)
      const decision = String(parsed.decision || 'A_VERIFIER').toUpperCase()
      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.85
      const violations = Array.isArray(parsed.violations) ? parsed.violations : []
      const ageRating = typeof parsed.age_rating === 'string' ? parsed.age_rating : 'all_ages'
      const summary = typeof parsed.summary === 'string' ? parsed.summary : 'Analyse automatique terminée.'

      const isUnder13 = isTargetingUnder13(input.requestedAgeRating)
      const textToCheck = `${input.title || ''} ${input.description || ''} ${input.tags?.join(' ') || ''}`

      let status: VideoStatus = 'NEEDS_REVIEW'

      // Guardrail regex renforcé pour les moins de 13 ans
      if (isUnder13) {
        for (const guard of SENSITIVE_UNDER13_PATTERNS) {
          if (guard.pattern.test(textToCheck)) {
            status = 'REJECTED'
            break
          }
        }

        if (status !== 'REJECTED') {
          // Si l'IA a détecté une violation de type sexual_content / nudity ou de sévérité élevée/moyenne
          const hasSensitiveViolation = violations.some(
            (v: Record<string, unknown>) => v.category === 'sexual_content' || v.category === 'nudity' || v.severity === 'high' || v.severity === 'medium',
          )
          if (decision === 'REJETE' || decision === 'REJECTED' || hasSensitiveViolation) {
            status = 'REJECTED'
          }

          // Si le résumé, les raisons ou les preuves de l'IA contiennent des termes sensibles (baisers, bizous, romance adulte, #hot)
          const aiText = `${summary} ${Array.isArray(parsed.reasons) ? parsed.reasons.join(' ') : ''} ${violations.map((v: Record<string, unknown>) => String(v.evidence || '')).join(' ')}`
          for (const guard of SENSITIVE_UNDER13_PATTERNS) {
            if (guard.pattern.test(aiText)) {
              status = 'REJECTED'
              break
            }
          }

          // Interdiction formelle de toute tranche mature ou dépassant la tranche demandée pour un profil enfant (< 13 ans)
          if (['13_plus', '16_plus', '18_plus'].includes(ageRating) || this.ageRank(ageRating) > this.requestedAgeRank(input.requestedAgeRating)) {
            status = 'REJECTED'
          }

          // Tolérance ZERO pour la moindre violation pour les enfants (< 13 ans)
          if (violations.length > 0) {
            status = 'REJECTED'
          }

          if (status !== 'REJECTED') {
            if (decision === 'APPROUVE' || decision === 'APPROVED') {
              status = confidence >= 0.92 ? 'APPROVED' : 'NEEDS_REVIEW'
            } else {
              status = 'NEEDS_REVIEW'
            }
          }
        }
      } else {
        if (decision === 'REJETE' || decision === 'REJECTED') {
          status = confidence >= 0.75 ? 'REJECTED' : 'NEEDS_REVIEW'
        } else if (decision === 'APPROUVE' || decision === 'APPROVED') {
          const hasHighViolation = violations.some((v: Record<string, unknown>) => v.severity === 'high' || v.severity === 'medium')
          status = (!hasHighViolation && ageRating !== '18_plus' && confidence >= 0.85) ? 'APPROVED' : 'NEEDS_REVIEW'
        }
      }

      const log = {
        video_id: input.videoId,
        decision: status === 'APPROVED' ? 'APPROUVE' : status === 'REJECTED' ? 'REJETE' : 'A_VERIFIER',
        age_rating: ageRating,
        requested_age_rating: input.requestedAgeRating,
        confidence,
        summary,
        reasons: Array.isArray(parsed.reasons) ? parsed.reasons : [summary],
        violations,
        model: usedModel,
        analyzed_at: new Date().toISOString(),
      }

      return { score: confidence, status, log }
    } catch (parseErr) {
      return {
        score: 0,
        status: 'NEEDS_REVIEW',
        log: {
          video_id: input.videoId,
          decision: 'A_VERIFIER',
          summary: 'Erreur de lecture de la réponse IA.',
          reasons: [parseErr instanceof Error ? parseErr.message : 'Erreur inconnue'],
          confidence: 0,
          model: usedModel,
          analyzed_at: new Date().toISOString(),
        },
      }
    }
  }

  /**
   * Valide une vidéo spécifique par son identifiant en base de données.
   */
  async validateVideoById(videoId: string): Promise<{ success: boolean; status: VideoStatus; score: number }> {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: {
        source: { select: { slug: true } },
        tags: { select: { tag: { select: { name: true } } } },
        playlistVideos: {
          select: {
            playlist: {
              select: {
                id: true,
                name: true,
                _count: { select: { playlistVideos: true } },
              },
            },
          },
        },
      },
    })

    if (!video) {
      this.logger.warn(`Vidéo ${videoId} introuvable pour validation.`)
      return { success: false, status: 'NEEDS_REVIEW', score: 0 }
    }

    const isEligible = video.validationStatus === VideoValidationStatus.PENDING
      || (video.validationStatus === VideoValidationStatus.NEEDS_REVIEW && (video.validationScore === 0 || video.validationScore == null))

    if (!isEligible) {
      this.logger.debug(`Vidéo ${videoId} déjà traitée définitivement (${video.validationStatus}).`)
      return { success: true, status: video.validationStatus as VideoStatus, score: video.validationScore ?? 0 }
    }

    const result = await this.validateVideo({
      videoId: video.id,
      title: video.title,
      description: video.description,
      language: video.language,
      requestedAgeRating: video.ageRating,
      durationSec: video.durationSec,
      sourceSlug: video.source?.slug,
      thumbnailUrl: video.thumbnailUrl,
      tags: video.tags.map(t => t.tag.name),
      playlists: video.playlistVideos.map(pv => ({
        id: pv.playlist.id,
        name: pv.playlist.name,
        totalVideos: pv.playlist._count.playlistVideos,
      })),
    })

    const assessedAgeRatingMap: Record<string, AgeRating> = {
      all_ages: AgeRating.ALL,
      '7_plus': AgeRating.AGE_7_PLUS,
      '13_plus': AgeRating.AGE_13_PLUS,
      '16_plus': AgeRating.AGE_13_PLUS,
      '18_plus': AgeRating.AGE_13_PLUS,
    }
    const evaluatedAgeRating = assessedAgeRatingMap[String(result.log.age_rating)] ?? AgeRating.ALL

    await this.prisma.video.update({
      where: { id: videoId },
      data: {
        validationStatus: result.status as VideoValidationStatus,
        validationScore: result.score,
        validationLog: result.log as never,
        ...(result.status === 'APPROVED' ? { ageRating: evaluatedAgeRating } : {}),
      },
    })

    this.logger.log(`Vidéo ${videoId} validée en direct → ${result.status} (score: ${result.score.toFixed(2)}, modèle: ${result.log.model})`)
    return { success: true, status: result.status, score: result.score }
  }

  /**
   * Traite un lot de vidéos en attente directement en environnement serverless.
   */
  async processPendingVideos(maxCount = 20): Promise<{
    queued: number
    processed: number
    approved: number
    rejected: number
    needsReview: number
  }> {
    let targetVideos = await this.prisma.video.findMany({
      where: {
        validationStatus: VideoValidationStatus.PENDING,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: Math.min(maxCount, 50),
    })

    if (targetVideos.length === 0) {
      targetVideos = await this.prisma.video.findMany({
        where: {
          validationStatus: VideoValidationStatus.NEEDS_REVIEW,
          OR: [
            { validationScore: 0 },
            { validationScore: null },
          ],
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: Math.min(maxCount, 50),
      })
    }

    // Assainissement préalable des vidéos récentes approuvées pour les enfants
    await this.sanitizeRecentApprovedVideos()

    if (targetVideos.length === 0) {
      return { queued: 0, processed: 0, approved: 0, rejected: 0, needsReview: 0 }
    }

    let approved = 0
    let rejected = 0
    let needsReview = 0

    // Concurrence de 3 requêtes en parallèle pour respecter les quotas d'API
    const CHUNK_SIZE = 3
    for (let i = 0; i < targetVideos.length; i += CHUNK_SIZE) {
      const chunk = targetVideos.slice(i, i + CHUNK_SIZE)
      const chunkResults = await Promise.allSettled(
        chunk.map(v => this.validateVideoById(v.id)),
      )

      for (const res of chunkResults) {
        if (res.status === 'fulfilled') {
          if (res.value.status === 'APPROVED') approved++
          else if (res.value.status === 'REJECTED') rejected++
          else needsReview++
        } else {
          needsReview++
        }
      }
    }

    this.logger.log(`Traitement terminé pour ${targetVideos.length} vidéos : ${approved} approuvée(s), ${rejected} rejetée(s), ${needsReview} à réviser.`)

    return {
      queued: targetVideos.length,
      processed: targetVideos.length,
      approved,
      rejected,
      needsReview,
    }
  }

  /**
   * Assainit et rétrograde en REJECTED toute vidéo précédemment approuvée ou en attente
   * qui violerait les règles renforcées pour les enfants (< 13 ans).
   */
  async sanitizeRecentApprovedVideos(limit = 100): Promise<number> {
    try {
      const candidates = await this.prisma.video.findMany({
        where: {
          validationStatus: { in: [VideoValidationStatus.APPROVED, VideoValidationStatus.PENDING, VideoValidationStatus.NEEDS_REVIEW] },
        },
        select: {
          id: true,
          title: true,
          description: true,
          ageRating: true,
          tags: { select: { tag: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      let sanitized = 0
      for (const video of candidates) {
        if (isTargetingUnder13(video.ageRating)) {
          const text = `${video.title || ''} ${video.description || ''} ${video.tags.map(t => t.tag.name).join(' ')}`
          for (const guard of SENSITIVE_UNDER13_PATTERNS) {
            if (guard.pattern.test(text)) {
              await this.prisma.video.update({
                where: { id: video.id },
                data: {
                  validationStatus: VideoValidationStatus.REJECTED,
                  validationScore: 1.0,
                  validationLog: {
                    decision: 'REJETE',
                    age_rating: '16_plus',
                    confidence: 1.0,
                    summary: `Rejet automatique de sécurité pour les enfants : ${guard.reason}.`,
                    reasons: [guard.reason],
                    sanitized_at: new Date().toISOString(),
                  } as never,
                },
              })
              this.logger.warn(`Vidéo assainie rétroactivement (ID: ${video.id}) → REJECTED (${guard.reason})`)
              sanitized++
              break
            }
          }
        }
      }
      return sanitized
    } catch (err) {
      this.logger.error(`Erreur lors de l'assainissement automatique : ${String(err)}`)
      return 0
    }
  }
}
