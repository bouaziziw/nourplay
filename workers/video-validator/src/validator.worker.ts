import OpenAI from 'openai'

const MAX_TOKENS = 3500
const MIN_APPROVAL_CONFIDENCE = 0.85
const MIN_REJECTION_CONFIDENCE = 0.75

const AGE_RATINGS = ['all_ages', '7_plus', '13_plus', '16_plus', '18_plus'] as const
const DECISIONS = ['APPROUVE', 'REJETE', 'A_VERIFIER'] as const
const VIOLATION_CATEGORIES = [
  'violence', 'nudity', 'sexual_content', 'drugs', 'alcohol', 'tobacco',
  'hate_speech', 'harassment', 'self_harm', 'suicide', 'illegal_content',
  'fraud', 'spam', 'misinformation', 'shocking_content', 'other',
] as const
const SEVERITIES = ['none', 'low', 'medium', 'high'] as const
const ACTIONS = ['allow', 'age_restrict', 'blur', 'mute', 'remove', 'review'] as const

type Decision = typeof DECISIONS[number]
type AgeRating = typeof AGE_RATINGS[number]
export type VideoStatus = 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW'

export interface VisualFrame {
  timestamp: string
  imageUrl: string
}

export interface PlaylistContext {
  id: string
  name: string
  totalVideos: number
}

export interface ValidateInput {
  videoId: string
  title: string
  description: string
  language: string
  requestedAgeRating: string
  durationSec?: number | null
  sourceSlug?: string
  thumbnailUrl?: string | null
  frames?: VisualFrame[]
  transcript?: string | null
  fullVideoAnalyzed?: boolean
  tags?: string[]
  playlists?: PlaylistContext[]
}

export interface Violation {
  category: typeof VIOLATION_CATEGORIES[number]
  severity: typeof SEVERITIES[number]
  timestamp_start: string
  timestamp_end: string
  evidence: string
  action: typeof ACTIONS[number]
}

export interface PlaylistAssessment {
  is_playlist: boolean
  total_videos: number
  approved: number
  rejected: number
  needs_review: number
  playlist_decision: Decision
}

export interface ModerationReport {
  video_id: string
  decision: Decision
  age_rating: AgeRating
  requested_age_rating: string
  confidence: number
  summary: string
  reasons: string[]
  violations: Violation[]
  audio_analysis: {
    transcript_available: boolean
    offensive_language: boolean
    hate_speech: boolean
    dangerous_instructions: boolean
    notes: string
  }
  playlist_assessment: PlaylistAssessment
  recommended_action: 'publish' | 'reject' | 'age_restrict' | 'human_review'
  review_priority: 'low' | 'medium' | 'high'
  model: string
  analyzed_at: string
  analysis_coverage: {
    title_and_description: boolean
    thumbnail_analyzed: boolean
    sampled_frames: number
    transcript_available: boolean
    full_video_analyzed: boolean
  }
  playlist_assessments: Array<PlaylistAssessment & { playlist_id: string; playlist_name: string }>
}

export interface ValidateResult {
  score: number
  status: VideoStatus
  log: ModerationReport & { provider_error?: string }
}

export interface AIConfig {
  provider: 'gemini' | 'openai' | 'groq' | 'custom'
  apiKey: string
  baseURL?: string
  model: string
  timeoutMs: number
}

/**
 * Configure et résout le fournisseur d'IA.
 * Par défaut : Google Gemini (gratuit et puissant sur Google AI Studio).
 * Alternatives supportées : Groq, OpenAI, ou fournisseur compatible OpenAI.
 */
export function resolveAIConfig(): AIConfig {
  const timeoutMs = Number(process.env.AI_MODERATION_TIMEOUT_MS || process.env.OPENAI_TIMEOUT_MS) || 45000
  const explicitProvider = process.env.AI_PROVIDER?.toLowerCase()

  // 1. Google Gemini (Recommandé : Gratuit, 1500 req/jour, multimodal très puissant)
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  if (explicitProvider === 'gemini' || (!explicitProvider && geminiKey)) {
    if (!geminiKey) {
      throw new Error(
        'GEMINI_API_KEY (ou GOOGLE_AI_API_KEY) est requis pour Gemini. Obtenez une clé gratuite sur https://aistudio.google.com/',
      )
    }
    let model = process.env.AI_MODERATION_MODEL || 'gemini-3-flash-preview'
    if (model === 'gemini-2.0-flash' || model === 'gemini-1.5-flash') {
      model = 'gemini-3-flash-preview'
    }
    return {
      provider: 'gemini',
      apiKey: geminiKey,
      baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai/',
      model,
      timeoutMs,
    }
  }

  // 2. Groq (Fournisseur ultra-rapide avec quota gratuit)
  const groqKey = process.env.GROQ_API_KEY
  if (explicitProvider === 'groq' || (!explicitProvider && groqKey)) {
    if (!groqKey) {
      throw new Error('GROQ_API_KEY est requis pour Groq')
    }
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
      baseURL: process.env.AI_BASE_URL || undefined,
      model: process.env.AI_MODERATION_MODEL || 'gpt-4o-mini',
      timeoutMs,
    }
  }

  throw new Error(
    'Aucune clé API IA configurée. Veuillez renseigner GEMINI_API_KEY (agent gratuit et puissant via https://aistudio.google.com/) ou OPENAI_API_KEY dans votre fichier .env',
  )
}

const SYSTEM_PROMPT = `Tu es un agent IA expert et rigoureux dans la modération de contenus vidéo destinés aux enfants et adolescents (plateforme NourPlay).
Ton objectif est de garantir un environnement 100% sûr, sain, bienveillant et éducatif, tout en permettant aux vidéos conformes et de qualité d'être approuvées rapidement.

Analyse attentivement le titre, la description, les tags, les playlists, la langue, ainsi que la miniature ou les frames fournis.

Vérifie les critères suivants :
- Violence : violence physique ou psychologique, armes, cruauté envers les animaux, scènes de combat sanglantes ou traumatisantes.
- Nudité & sexualité : nudité, tenues inappropriées pour mineurs, insinuations sexuelles, pornographie, fétichisme.
- Substances nocives : consommation ou promotion de drogues, alcool, tabac, cigarettes électroniques.
- Toxicité : discours de haine, cyberharcèlement, intimidation, insultes graves, discrimination.
- Risques vitaux : automutilation, idées suicidaires, défis dangereux (challenges TikTok/YouTube mettant la vie en danger).
- Illégalité & escroquerie : arnaques, piratage, incitation au vol, paris/jeux d'argent illégaux.
- Contenu choquant / anxiogène : jump scares extrêmes, gore, horreur, théories du complot anxiogènes.

Règles de décision :
1. APPROUVE : Si le contenu est un dessin animé sain, une comptine, une vidéo éducative, un tutoriel créatif, du divertissement familial ou adapté aux enfants/jeunes, sans aucun risque de violation détecté.
   Assigne la tranche d'âge appropriée et un niveau de confiance élevé (ex. 0.90 à 0.99).
2. REJETE : Si les éléments prouvent sans ambiguïté une violation grave (pornographie, violence explicite, drogues, haine, incitation au suicide ou danger manifeste).
3. A_VERIFIER : En cas de doute légitime, d'ambiguïté dans le titre/miniature, de paroles à double sens potentielles, ou de thèmes matures nécessitant impérativement le visionnage complet par un adulte modérateur.

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
  "audio_analysis": {
    "transcript_available": false,
    "offensive_language": false,
    "hate_speech": false,
    "dangerous_instructions": false,
    "notes": "Notes d'analyse audio si disponible"
  },
  "recommended_action": "publish | reject | age_restrict | human_review",
  "review_priority": "low | medium | high"
}`

/**
 * Récupère une image et la transforme en data URL base64 pour un envoi direct et fiable à l'IA.
 */
async function fetchImageAsDataUrl(imageUrl: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const contentType = res.headers.get('content-type') || 'image/jpeg'
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:${contentType};base64,${base64}`
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Extrait et parse le JSON même si le modèle l'a encapsulé dans un bloc markdown.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match?.[1]) {
      return JSON.parse(match[1].trim())
    }
    const firstBrace = trimmed.indexOf('{')
    const lastBrace = trimmed.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1))
    }
    throw new Error('Impossible d’extraire un objet JSON valide de la réponse de modération')
  }
}

export async function validateVideo(input: ValidateInput): Promise<ValidateResult> {
  const candidateFrames = input.frames?.length ? input.frames : (
    input.thumbnailUrl ? [{ timestamp: '00:00:00', imageUrl: input.thumbnailUrl }] : []
  )
  const frames = candidateFrames.filter(frame => isTrustedImageUrl(frame.imageUrl) && isTimestamp(frame.timestamp))
  const transcript = input.transcript?.trim() || ''
  const playlistContext = input.playlists ?? []

  let config: AIConfig
  try {
    config = resolveAIConfig()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Configuration IA introuvable'
    const report = createReviewFallback(input, frames.length, Boolean(transcript), message, 'unknown')
    return { score: 0, status: 'NEEDS_REVIEW', log: report }
  }

  try {
    const openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      timeout: config.timeoutMs,
    })

    const textPayload = [
      `video_id: ${input.videoId}`,
      `Tranche demandée: ${input.requestedAgeRating}`,
      `Titre: ${input.title}`,
      `Description: ${input.description || '(absente)'}`,
      `Langue: ${input.language}`,
      `Plateforme: ${input.sourceSlug || '(inconnue)'}`,
      `Durée en secondes: ${input.durationSec ?? 'inconnue'}`,
      `Tags: ${input.tags?.join(', ') || '(aucun)'}`,
      `Transcript audio: ${transcript || '(aucun transcript fourni)'}`,
      `Playlists associées: ${JSON.stringify(playlistContext)}`,
      `Frames/Miniature fournis (${frames.length}): ${frames.map(f => f.timestamp).join(', ') || '(aucun)'}`,
    ].join('\n')

    const contentParts: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
      { type: 'text', text: textPayload },
    ]

    // Charger les images (converties en base64 pour une fiabilité totale)
    for (const frame of frames.slice(0, 5)) {
      try {
        const dataUrl = await fetchImageAsDataUrl(frame.imageUrl)
        contentParts.push({ type: 'image_url', image_url: { url: dataUrl } })
      } catch {
        // En cas d'échec du téléchargement local, transmettre l'URL directe
        contentParts.push({ type: 'image_url', image_url: { url: frame.imageUrl } })
      }
    }

    const response = await openai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: contentParts },
      ],
      response_format: { type: 'json_object' },
      max_tokens: MAX_TOKENS,
      temperature: 0.1,
    })

    const rawContent = response.choices[0]?.message?.content
    if (typeof rawContent !== 'string' || !rawContent) {
      throw new Error(`Le fournisseur IA (${config.provider}/${config.model}) a retourné une réponse vide`)
    }

    const parsed = extractJson(rawContent)
    const report = parseReport(parsed, input, frames.length, config.model)
    const status = decideStatus(report, input.requestedAgeRating)

    report.decision = status === 'APPROVED' ? 'APPROUVE'
      : status === 'REJECTED' ? 'REJETE' : 'A_VERIFIER'
    report.recommended_action = status === 'APPROVED' ? 'publish'
      : status === 'REJECTED' ? 'reject'
        : ageRank(report.age_rating) > requestedAgeRank(input.requestedAgeRating) ? 'age_restrict' : 'human_review'
    report.review_priority = status === 'NEEDS_REVIEW'
      ? (report.confidence < 0.6 || report.violations.some(v => v.severity === 'high') ? 'high' : 'medium')
      : report.review_priority

    return { score: report.confidence, status, log: report }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur inconnue de validation IA'
    const report = createReviewFallback(input, frames.length, Boolean(transcript), message, config.model)
    return { score: 0, status: 'NEEDS_REVIEW', log: report }
  }
}

function parseReport(
  value: unknown,
  input: ValidateInput,
  sampledFrames: number,
  modelName: string,
): ModerationReport {
  if (!isRecord(value)) {
    throw new Error('Le résultat de modération IA n’est pas un objet valide')
  }

  // Normalisation de la décision
  let decision: Decision = 'A_VERIFIER'
  if (typeof value.decision === 'string') {
    const rawDecision = value.decision.toUpperCase().trim()
    if (rawDecision === 'APPROUVE' || rawDecision === 'APPROVED') decision = 'APPROUVE'
    else if (rawDecision === 'REJETE' || rawDecision === 'REJECTED') decision = 'REJETE'
    else decision = 'A_VERIFIER'
  }

  // Normalisation de la tranche d'âge
  let ageRating: AgeRating = requestedAgeToRating(input.requestedAgeRating)
  if (isOneOf(value.age_rating, AGE_RATINGS)) {
    ageRating = value.age_rating
  } else if (typeof value.age_rating === 'string') {
    ageRating = requestedAgeToRating(value.age_rating)
  }

  // Normalisation de la confiance
  let confidence = 0.85
  if (typeof value.confidence === 'number' && Number.isFinite(value.confidence)) {
    confidence = Math.max(0, Math.min(1, value.confidence))
  }

  // Normalisation du résumé et des raisons
  const summary = typeof value.summary === 'string'
    ? value.summary.slice(0, 1000)
    : 'Validation automatique de la vidéo.'
  const reasons: string[] = Array.isArray(value.reasons)
    ? value.reasons.filter(isString).slice(0, 20)
    : [summary]

  // Normalisation des violations
  const violations: Violation[] = Array.isArray(value.violations)
    ? value.violations.filter((v): v is Violation => isViolation(v, input.durationSec)).slice(0, 50)
    : []

  // Analyse audio
  const hasTranscript = Boolean(input.transcript?.trim())
  const rawAudio = isRecord(value.audio_analysis) ? value.audio_analysis : {}
  const audioAnalysis = {
    transcript_available: hasTranscript,
    offensive_language: hasTranscript && Boolean(rawAudio.offensive_language),
    hate_speech: hasTranscript && Boolean(rawAudio.hate_speech),
    dangerous_instructions: hasTranscript && Boolean(rawAudio.dangerous_instructions),
    notes: hasTranscript && typeof rawAudio.notes === 'string'
      ? rawAudio.notes.slice(0, 500)
      : 'Aucun transcript audio fourni.',
  }

  // Recommandation & priorité
  const recommendedAction: 'publish' | 'reject' | 'age_restrict' | 'human_review' =
    isOneOf(value.recommended_action, ['publish', 'reject', 'age_restrict', 'human_review'])
      ? value.recommended_action
      : decision === 'APPROUVE' ? 'publish' : decision === 'REJETE' ? 'reject' : 'human_review'

  const reviewPriority: 'low' | 'medium' | 'high' =
    isOneOf(value.review_priority, ['low', 'medium', 'high'])
      ? value.review_priority
      : decision === 'APPROUVE' ? 'low' : decision === 'REJETE' ? 'high' : 'medium'

  return {
    video_id: input.videoId,
    decision,
    age_rating: ageRating,
    requested_age_rating: input.requestedAgeRating,
    confidence,
    summary,
    reasons,
    violations,
    audio_analysis: audioAnalysis,
    playlist_assessment: emptyPlaylistAssessment(),
    recommended_action: recommendedAction,
    review_priority: reviewPriority,
    model: modelName,
    analyzed_at: new Date().toISOString(),
    analysis_coverage: {
      title_and_description: true,
      thumbnail_analyzed: Boolean(input.thumbnailUrl && isTrustedImageUrl(input.thumbnailUrl)),
      sampled_frames: sampledFrames,
      transcript_available: hasTranscript,
      full_video_analyzed: Boolean(input.fullVideoAnalyzed && hasTranscript),
    },
    playlist_assessments: [],
  }
}

function decideStatus(
  report: ModerationReport,
  requestedAgeRating: string,
): VideoStatus {
  // 1. Rejet si violation grave ou décision explicite avec confiance suffisante
  if (report.decision === 'REJETE') {
    const hasSevereViolation = report.violations.some(
      v => (v.severity === 'high' || v.severity === 'medium') && (v.action === 'remove' || v.action === 'age_restrict'),
    )
    if (report.confidence >= MIN_REJECTION_CONFIDENCE && (hasSevereViolation || report.violations.length > 0)) {
      return 'REJECTED'
    }
    return 'NEEDS_REVIEW'
  }

  // 2. Approbation si le contenu est jugé sûr et approprié
  if (report.decision === 'APPROUVE') {
    const hasUnacceptableViolation = report.violations.some(
      v => v.severity === 'medium' || v.severity === 'high',
    )
    const exceedsRequestedAge = ageRank(report.age_rating) > requestedAgeRank(requestedAgeRating)

    if (!hasUnacceptableViolation && !exceedsRequestedAge && report.confidence >= MIN_APPROVAL_CONFIDENCE) {
      return 'APPROVED'
    }
    return 'NEEDS_REVIEW'
  }

  // 3. Modération humaine requise
  return 'NEEDS_REVIEW'
}

function createReviewFallback(
  input: ValidateInput,
  sampledFrames: number,
  transcriptAvailable: boolean,
  error: string,
  modelName: string,
): ModerationReport & { provider_error: string } {
  return {
    video_id: input.videoId,
    decision: 'A_VERIFIER',
    age_rating: requestedAgeToRating(input.requestedAgeRating),
    requested_age_rating: input.requestedAgeRating,
    confidence: 0,
    summary: 'Analyse automatique indisponible ou incomplète. Une vérification humaine est requise.',
    reasons: [`Erreur du service de modération IA (${modelName}): ${error}`],
    violations: [],
    audio_analysis: {
      transcript_available: transcriptAvailable,
      offensive_language: false,
      hate_speech: false,
      dangerous_instructions: false,
      notes: transcriptAvailable ? 'Transcript disponible, mais non analysé.' : 'Audio non analysé.',
    },
    playlist_assessment: emptyPlaylistAssessment(),
    recommended_action: 'human_review',
    review_priority: 'high',
    model: modelName,
    analyzed_at: new Date().toISOString(),
    analysis_coverage: {
      title_and_description: false,
      thumbnail_analyzed: false,
      sampled_frames: sampledFrames,
      transcript_available: transcriptAvailable,
      full_video_analyzed: false,
    },
    playlist_assessments: [],
    provider_error: error.slice(0, 500),
  }
}

function requestedAgeToRating(value: string): AgeRating {
  switch (value) {
    case 'AGE_4_PLUS':
    case 'ALL':
      return 'all_ages'
    case 'AGE_7_PLUS':
      return '7_plus'
    case 'AGE_10_PLUS':
    case 'AGE_13_PLUS':
      return '13_plus'
    case 'AGE_16_PLUS':
      return '16_plus'
    default:
      return 'all_ages'
  }
}

function ageRank(value: AgeRating): number {
  return value === 'all_ages' ? 0
    : value === '7_plus' ? 2
      : value === '13_plus' ? 4
        : value === '16_plus' ? 5 : 6
}

function requestedAgeRank(value: string): number {
  switch (value) {
    case 'AGE_4_PLUS': return 1
    case 'AGE_7_PLUS': return 2
    case 'AGE_10_PLUS': return 3
    case 'AGE_13_PLUS': return 4
    default: return 0
  }
}

function emptyPlaylistAssessment(): PlaylistAssessment {
  return {
    is_playlist: false,
    total_videos: 0,
    approved: 0,
    rejected: 0,
    needs_review: 0,
    playlist_decision: 'A_VERIFIER',
  }
}

function isViolation(value: unknown, durationSec?: number | null): value is Violation {
  if (!isRecord(value)) return false
  if (!isOneOf(value.category, VIOLATION_CATEGORIES)
    || !isOneOf(value.severity, SEVERITIES)
    || !isTimestamp(value.timestamp_start)
    || !isTimestamp(value.timestamp_end)
    || typeof value.evidence !== 'string'
    || value.evidence.length > 1000
    || !isOneOf(value.action, ACTIONS)) return false
  const start = timestampToSeconds(value.timestamp_start)
  const end = timestampToSeconds(value.timestamp_end)
  return end >= start && (durationSec == null || end <= durationSec + 5)
}

function timestampToSeconds(timestamp: string): number {
  const [hours, minutes, seconds] = timestamp.split(':').map(Number)
  return hours * 3600 + minutes * 60 + seconds
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2,}:[0-5]\d:[0-5]\d$/.test(value)) return false
  const [hours] = value.split(':')
  return Number.isSafeInteger(Number(hours))
}

function isTrustedImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    return ['i.ytimg.com', 'img.youtube.com', 'i.vimeocdn.com'].includes(url.hostname)
      || url.hostname.endsWith('.ytimg.com')
      || url.hostname.endsWith('.vimeocdn.com')
      || url.hostname.endsWith('.googleusercontent.com')
      || url.hostname.endsWith('.nourplay.app')
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isOneOf<const T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 500
}
