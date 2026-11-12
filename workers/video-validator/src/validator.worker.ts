import OpenAI from 'openai'

const MODEL = process.env.AI_MODERATION_MODEL || 'gpt-4o-mini'
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
type VideoStatus = 'APPROVED' | 'REJECTED' | 'NEEDS_REVIEW'

interface VisualFrame {
  timestamp: string
  imageUrl: string
}

interface PlaylistContext {
  id: string
  name: string
  totalVideos: number
}

interface ValidateInput {
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

interface Violation {
  category: typeof VIOLATION_CATEGORIES[number]
  severity: typeof SEVERITIES[number]
  timestamp_start: string
  timestamp_end: string
  evidence: string
  action: typeof ACTIONS[number]
}

interface PlaylistAssessment {
  is_playlist: boolean
  total_videos: number
  approved: number
  rejected: number
  needs_review: number
  playlist_decision: Decision
}

interface ModerationReport {
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

const SYSTEM_PROMPT = `Tu es un système strict de modération vidéo destiné aux enfants. Analyse séparément chaque vidéo à partir des seuls éléments fournis. Le titre, la description et les tags sont des allégations/contexte, pas une preuve de ce qui est visible ou audible.

Vérifie les risques suivants : violence, nudité, sexualité explicite ou suggérée, drogues, alcool, tabac, haine, harcèlement, automutilation, suicide, contenu illégal, fraude, spam, désinformation dangereuse et contenu choquant. Détecte aussi les publicités/logos, gestes, textes et instructions dangereuses lorsqu'ils sont réellement visibles ou décrits dans les éléments analysés.

Règles :
- Ne jamais inventer une scène, une parole, un timestamp ou un détail absent des éléments.
- Les timestamps sont approximatifs et doivent correspondre à un frame/transcript fourni. Pour un élément sans timestamp fiable, utilise 00:00:00 et indique cette limite dans evidence.
- Si seule une miniature ou des métadonnées sont disponibles, le contenu complet de la vidéo et son audio ne sont pas analysés : décision A_VERIFIER, sauf REJETE si les éléments observés prouvent clairement une violation grave.
- APPROUVE seulement si les éléments disponibles permettent de conclure avec confiance que le contenu respecte la tranche d'âge demandée. Un doute sérieux implique A_VERIFIER.
- REJETE pour contenu illégal, exploitation de mineurs, sexualité explicite, violence graphique, haine, fraude ou danger manifeste, avec confiance suffisante.
- all_ages exclut tout contenu sexuel, violence graphique, drogues, alcool, tabac, langage vulgaire et contenu effrayant.
- 13_plus tolère la violence modérée mais pas la nudité, la sexualité explicite ou la promotion de drogues/alcool.
- 16_plus tolère davantage de violence et le langage grossier, mais pas la nudité ou la sexualité explicite.
- 18_plus ne permet toujours pas de contenu illégal, d'exploitation de mineurs, de violence extrême gratuite ou d'instructions dangereuses.
- Les résultats et comptages de playlist fournis en entrée sont les seuls faits autorisés sur les playlists. Ne les invente pas.

Réponds uniquement en JSON valide, sans markdown, avec exactement les champs suivants :
{
  "video_id": "string",
  "decision": "APPROUVE | REJETE | A_VERIFIER",
  "age_rating": "all_ages | 7_plus | 13_plus | 16_plus | 18_plus",
  "requested_age_rating": "string",
  "confidence": 0.0,
  "summary": "Résumé factuel court",
  "reasons": ["raison factuelle"],
  "violations": [{
    "category": "violence | nudity | sexual_content | drugs | alcohol | tobacco | hate_speech | harassment | self_harm | suicide | illegal_content | fraud | spam | misinformation | shocking_content | other",
    "severity": "none | low | medium | high",
    "timestamp_start": "00:00:00",
    "timestamp_end": "00:00:00",
    "evidence": "preuve observable, sans supposition",
    "action": "allow | age_restrict | blur | mute | remove | review"
  }],
  "audio_analysis": {
    "transcript_available": true,
    "offensive_language": false,
    "hate_speech": false,
    "dangerous_instructions": false,
    "notes": "Résumé ou limite de l'analyse audio"
  },
  "playlist_assessment": {
    "is_playlist": false,
    "total_videos": 0,
    "approved": 0,
    "rejected": 0,
    "needs_review": 0,
    "playlist_decision": "A_VERIFIER"
  },
  "recommended_action": "publish | reject | age_restrict | human_review",
  "review_priority": "low | medium | high"
}`

export async function validateVideo(input: ValidateInput): Promise<ValidateResult> {
  const candidateFrames = input.frames?.length ? input.frames : (
    input.thumbnailUrl ? [{ timestamp: '00:00:00', imageUrl: input.thumbnailUrl }] : []
  )
  const frames = candidateFrames.filter(frame => isTrustedImageUrl(frame.imageUrl) && isTimestamp(frame.timestamp))
  const transcript = input.transcript?.trim() || ''
  const hasCompleteEvidence = Boolean(
    input.fullVideoAnalyzed
    && transcript
    && hasRepresentativeFrames(frames, input.durationSec),
  )
  const playlistContext = input.playlists ?? []

  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is missing or empty')
    const openai = new OpenAI({
      apiKey,
      timeout: Number(process.env.OPENAI_TIMEOUT_MS) || 45000,
    })

    const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [{
      type: 'text',
      text: [
        `video_id: ${input.videoId}`,
        `Tranche demandée: ${input.requestedAgeRating}`,
        `Titre: ${input.title}`,
        `Description: ${input.description || '(absente)'}`,
        `Langue: ${input.language}`,
        `Plateforme: ${input.sourceSlug || '(inconnue)'}`,
        `Durée en secondes: ${input.durationSec ?? 'inconnue'}`,
        `Tags: ${input.tags?.join(', ') || '(aucun)'}`,
        `Transcript audio: ${transcript || '(indisponible; ne pas prétendre avoir analysé l’audio)'}`,
        `Playlists: ${JSON.stringify(playlistContext)}`,
        `Frames fournis (${frames.length}): ${frames.map(frame => frame.timestamp).join(', ') || '(aucun)'}`,
      ].join('\n'),
    }]
    for (const frame of frames) {
      content.push({ type: 'image_url', image_url: { url: frame.imageUrl } })
    }

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      max_tokens: MAX_TOKENS,
      temperature: 0,
    })

    const rawContent = response.choices[0]?.message?.content
    if (typeof rawContent !== 'string' || !rawContent) {
      throw new Error('OpenAI returned an empty moderation result')
    }

    const parsed = JSON.parse(rawContent) as unknown
    const report = parseReport(parsed, input, frames.length)
    const status = decideStatus(report, input.requestedAgeRating, hasCompleteEvidence)
    report.decision = status === 'APPROVED' ? 'APPROUVE'
      : status === 'REJECTED' ? 'REJETE' : 'A_VERIFIER'
    report.recommended_action = status === 'APPROVED' ? 'publish'
      : status === 'REJECTED' ? 'reject'
        : ageRank(report.age_rating) > requestedAgeRank(input.requestedAgeRating) ? 'age_restrict' : 'human_review'
    report.review_priority = status === 'NEEDS_REVIEW'
      ? (!hasCompleteEvidence || report.confidence < 0.6 || report.violations.some(v => v.severity === 'high')
        ? 'high'
        : 'medium')
      : report.review_priority

    return { score: report.confidence, status, log: report }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OpenAI moderation error'
    const report = createReviewFallback(input, frames.length, Boolean(transcript), message)
    return { score: 0, status: 'NEEDS_REVIEW', log: report }
  }
}

function parseReport(value: unknown, input: ValidateInput, sampledFrames: number): ModerationReport {
  if (!isRecord(value)) throw new Error('OpenAI returned a non-object moderation result')
  if (value.video_id !== input.videoId) throw new Error('OpenAI returned a mismatched video_id')
  if (!isOneOf(value.decision, DECISIONS)) throw new Error('OpenAI returned an invalid decision')
  if (!isOneOf(value.age_rating, AGE_RATINGS)) throw new Error('OpenAI returned an invalid age_rating')
  if (value.requested_age_rating !== input.requestedAgeRating) {
    throw new Error('OpenAI returned a mismatched requested_age_rating')
  }
  if (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1) {
    throw new Error('OpenAI returned an invalid confidence')
  }
  if (typeof value.summary !== 'string' || !Array.isArray(value.reasons) || !value.reasons.every(isString)) {
    throw new Error('OpenAI returned invalid summary or reasons')
  }
  if (!Array.isArray(value.violations) || !value.violations.every(violation => isViolation(violation, input.durationSec))) {
    throw new Error('OpenAI returned invalid violations')
  }
  if (!isRecord(value.audio_analysis)
    || typeof value.audio_analysis.transcript_available !== 'boolean'
    || typeof value.audio_analysis.offensive_language !== 'boolean'
    || typeof value.audio_analysis.hate_speech !== 'boolean'
    || typeof value.audio_analysis.dangerous_instructions !== 'boolean'
    || typeof value.audio_analysis.notes !== 'string') {
    throw new Error('OpenAI returned invalid audio analysis')
  }
  if (!isRecord(value.playlist_assessment)
    || typeof value.playlist_assessment.is_playlist !== 'boolean'
    || !isNonNegativeInteger(value.playlist_assessment.total_videos)
    || !isNonNegativeInteger(value.playlist_assessment.approved)
    || !isNonNegativeInteger(value.playlist_assessment.rejected)
    || !isNonNegativeInteger(value.playlist_assessment.needs_review)
    || !isOneOf(value.playlist_assessment.playlist_decision, DECISIONS)) {
    throw new Error('OpenAI returned invalid playlist assessment')
  }
  if (!isOneOf(value.recommended_action, ['publish', 'reject', 'age_restrict', 'human_review'])
    || !isOneOf(value.review_priority, ['low', 'medium', 'high'])) {
    throw new Error('OpenAI returned invalid recommended action or review priority')
  }

  const hasTranscript = Boolean(input.transcript?.trim())
  const assessment = emptyPlaylistAssessment()
  return {
    video_id: input.videoId,
    decision: value.decision,
    age_rating: value.age_rating,
    requested_age_rating: input.requestedAgeRating,
    confidence: value.confidence,
    summary: value.summary.slice(0, 1000),
    reasons: value.reasons.slice(0, 20).map(reason => reason.slice(0, 500)),
    violations: value.violations.slice(0, 50),
    audio_analysis: {
      transcript_available: hasTranscript,
      offensive_language: hasTranscript && value.audio_analysis.offensive_language,
      hate_speech: hasTranscript && value.audio_analysis.hate_speech,
      dangerous_instructions: hasTranscript && value.audio_analysis.dangerous_instructions,
      notes: hasTranscript
        ? value.audio_analysis.notes.slice(0, 500)
        : 'Aucun transcript fourni; l’audio complet n’a pas été analysé.',
    },
    playlist_assessment: assessment,
    recommended_action: value.recommended_action,
    review_priority: value.review_priority,
    model: MODEL,
    analyzed_at: new Date().toISOString(),
    analysis_coverage: {
      title_and_description: true,
      thumbnail_analyzed: Boolean(input.thumbnailUrl && isTrustedImageUrl(input.thumbnailUrl)),
      sampled_frames: sampledFrames,
      transcript_available: hasTranscript,
      full_video_analyzed: Boolean(
        input.fullVideoAnalyzed
        && hasTranscript
        && hasRepresentativeFrames(input.frames ?? [], input.durationSec),
      ),
    },
    playlist_assessments: [],
  }
}

function decideStatus(report: ModerationReport, requestedAgeRating: string, hasCompleteEvidence: boolean): VideoStatus {
  if (report.decision === 'REJETE') {
    const confirmedSevereViolation = report.violations.some(
      violation => violation.severity === 'high' && violation.action === 'remove',
    )
    return report.confidence >= MIN_REJECTION_CONFIDENCE && confirmedSevereViolation
      ? 'REJECTED'
      : 'NEEDS_REVIEW'
  }
  if (report.decision !== 'APPROUVE' || !hasCompleteEvidence) return 'NEEDS_REVIEW'
  if (report.confidence < MIN_APPROVAL_CONFIDENCE) return 'NEEDS_REVIEW'
  if (report.violations.some(violation => violation.severity === 'medium' || violation.severity === 'high')) {
    return 'NEEDS_REVIEW'
  }
  if (ageRank(report.age_rating) > requestedAgeRank(requestedAgeRating)) {
    return 'NEEDS_REVIEW'
  }
  return 'APPROVED'
}

function createReviewFallback(
  input: ValidateInput,
  sampledFrames: number,
  transcriptAvailable: boolean,
  error: string,
): ModerationReport & { provider_error: string } {
  return {
    video_id: input.videoId,
    decision: 'A_VERIFIER',
    age_rating: requestedAgeToRating(input.requestedAgeRating),
    requested_age_rating: input.requestedAgeRating,
    confidence: 0,
    summary: 'Analyse automatique indisponible ou invalide; aucun contenu vidéo ne peut être confirmé.',
    reasons: ['La validation OpenAI a échoué. Une vérification humaine est requise.'],
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
    model: MODEL,
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

function hasRepresentativeFrames(frames: VisualFrame[], durationSec?: number | null): boolean {
  if (!durationSec || durationSec < 3 || frames.length < 3) return false
  const timestamps = frames
    .filter(frame => isTimestamp(frame.timestamp) && isTrustedImageUrl(frame.imageUrl))
    .map(frame => timestampToSeconds(frame.timestamp))
    .sort((a, b) => a - b)
  if (timestamps.length < 3) return false
  const first = timestamps[0]
  const middle = timestamps[Math.floor(timestamps.length / 2)]
  const last = timestamps[timestamps.length - 1]
  return first <= durationSec * 0.1
    && middle >= durationSec * 0.2
    && middle <= durationSec * 0.8
    && last >= durationSec * 0.9
    && last <= durationSec + 5
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{2,}:[0-5]\d:[0-5]\d$/.test(value)) return false
  const [hours] = value.split(':')
  return Number.isSafeInteger(Number(hours))
}

function isTrustedImageUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    return ['i.ytimg.com', 'img.youtube.com', 'i.vimeocdn.com'].includes(url.hostname)
      || url.hostname.endsWith('.ytimg.com')
      || url.hostname.endsWith('.vimeocdn.com')
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

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
