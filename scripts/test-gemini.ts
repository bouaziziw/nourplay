import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '../.env') })

import { resolveAIConfig, validateVideo } from '../workers/video-validator/src/validator.worker'

async function run() {
  console.log('--- TEST CONFIGURATION IA ---')
  const aiConfig = resolveAIConfig()
  console.log('Provider:', aiConfig.provider)
  console.log('Model:', aiConfig.model)
  console.log('BaseURL:', aiConfig.baseURL)
  console.log('API Key present:', Boolean(aiConfig.apiKey))

  console.log('\n--- TEST APPEL VALIDATEUR AVEC GEMINI ---')
  const testInput = {
    videoId: 'gemini-test-01',
    title: 'Comptine pour enfants : Les petits poissons dans l\'eau',
    description: 'Une comptine éducative et douce pour apprendre les animaux marins aux tout-petits.',
    language: 'fr',
    requestedAgeRating: 'AGE_ALL',
    tags: ['enfants', 'chanson', 'apprentissage'],
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
  }

  const result = await validateVideo(testInput)
  console.log('\n--- RÉSULTAT DE VALIDATION ---')
  console.log('Statut final:', result.status)
  console.log('Score:', result.score)
  console.log('Décision IA:', result.log.decision)
  console.log('Résumé IA:', result.log.summary)
  console.log('Tranche d\'âge:', result.log.age_rating)
  console.log('Violations:', result.log.violations)
  if (result.log.provider_error) {
    console.error('Erreur fournisseur:', result.log.provider_error)
    process.exit(1)
  }
  console.log('\n Test Gemini réussi avec succès!')
}

run().catch((err) => {
  console.error('Erreur lors du test Gemini:', err)
  process.exit(1)
})
