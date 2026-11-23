import dotenv from 'dotenv'
import path from 'node:path'
import fs from 'node:fs'

const candidateEnvFiles = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
]

for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile })
  }
}

import { resolveAIConfig, validateVideo } from '../src/validator.worker'

async function run() {
  console.log('====================================================')
  console.log('🤖 VÉRIFICATION DE L’API IA ET DES RÈGLES RENFORCÉES (< 13 ANS)')
  console.log('====================================================')

  const config = resolveAIConfig()
  console.log(`\n1. Fournisseur sélectionné : ${config.provider.toUpperCase()}`)
  console.log(`   Modèle principal       : ${config.model}`)
  console.log(`   Base URL               : ${config.baseURL || 'défaut'}`)
  console.log(`   Clé API configurée     : ${config.apiKey ? 'OUI (masquée)' : 'NON'}`)

  // TEST 1 : Contenu sain pour tout-petits (Doit être APPROVED avec score élevé)
  console.log('\n--- TEST 1 : Vidéo saine pour enfants (Comptine "Bébé Requin", ALL) ---')
  const test1 = await validateVideo({
    videoId: 'test-healthy-kids-01',
    title: 'Bébé Requin - Chanson douce et éducative pour enfants',
    description: 'Une jolie comptine éducative et colorée pour apprendre les animaux marins aux tout-petits en toute bienveillance.',
    language: 'fr',
    requestedAgeRating: 'ALL',
    tags: ['comptine', 'enfants', 'bébé', 'animaux'],
    thumbnailUrl: 'https://i.ytimg.com/vi/XqZsoesa55w/maxresdefault.jpg',
  })
  console.log(`   Statut obtenu : ${test1.status}`)
  console.log(`   Score         : ${test1.score}`)
  console.log(`   Décision IA   : ${test1.log.decision}`)
  console.log(`   Tranche d’âge : ${test1.log.age_rating}`)
  console.log(`   Violations    : ${test1.log.violations.length}`)
  console.log(`   Violations obj: ${JSON.stringify(test1.log.violations)}`)
  console.log(`   Résumé        : ${test1.log.summary}`)
  console.log(`   Raisons       : ${JSON.stringify(test1.log.reasons)}`)

  // TEST 2 : Contenu anxiogène / Huggy Wuggy faussement ciblé enfants (Doit être bloqué < 13 ans -> NEEDS_REVIEW ou REJECTED)
  console.log('\n--- TEST 2 : Contenu anxiogène faussement ciblé enfants (Huggy Wuggy Horror, ALL) ---')
  const test2 = await validateVideo({
    videoId: 'test-borderline-under13-02',
    title: 'Huggy Wuggy Poppy Playtime jumpscare scary animation comptine',
    description: 'Animation avec le monstre Huggy Wuggy qui fait peur et attaque avec jumpscare.',
    language: 'fr',
    requestedAgeRating: 'ALL',
    tags: ['huggy wuggy', 'animation', 'scary'],
  })
  console.log(`   Statut obtenu : ${test2.status}`)
  console.log(`   Score         : ${test2.score}`)
  console.log(`   Décision IA   : ${test2.log.decision}`)
  console.log(`   Tranche d’âge : ${test2.log.age_rating}`)
  console.log(`   Violations    : ${test2.log.violations.length}`)
  console.log(`   Résumé        : ${test2.log.summary}`)

  // TEST 3 : Contenu violent / adulte (Doit être REJECTED)
  console.log('\n--- TEST 3 : Contenu adulte / violence (Combat armé gore, ALL) ---')
  const test3 = await validateVideo({
    videoId: 'test-violent-adult-03',
    title: 'Fusillade sanglante et combat mortel au couteau sang gore',
    description: 'Scène de fusillade avec armes lourdes, sang et violence explicite.',
    language: 'fr',
    requestedAgeRating: 'ALL',
    tags: ['combat', 'armes', 'fusillade'],
  })
  console.log(`   Statut obtenu : ${test3.status}`)
  console.log(`   Score         : ${test3.score}`)
  console.log(`   Décision IA   : ${test3.log.decision}`)
  console.log(`   Tranche d’âge : ${test3.log.age_rating}`)
  console.log(`   Violations    : ${test3.log.violations.length}`)
  console.log(`   Résumé        : ${test3.log.summary}`)

  // TEST 4 : Baisers intimes / bisous sur compte 7+ (Doit être REJECTED)
  console.log('\n--- TEST 4 : Baisers intimes / bisous sur compte 7+ ("deux femme font des bizou", AGE_7_PLUS) ---')
  const test4 = await validateVideo({
    videoId: 'test-sexual-kiss-04',
    title: 'deux femme font des bizou',
    description: 'Scène intime où deux femmes s\'embrassent amoureusement avec des bisous.',
    language: 'fr',
    requestedAgeRating: 'AGE_7_PLUS',
    tags: ['romance', 'bisous', 'femmes'],
  })
  console.log(`   Statut obtenu : ${test4.status}`)
  console.log(`   Score         : ${test4.score}`)
  console.log(`   Décision IA   : ${test4.log.decision}`)
  console.log(`   Tranche d’âge : ${test4.log.age_rating}`)
  console.log(`   Violations    : ${test4.log.violations.length}`)
  console.log(`   Résumé        : ${test4.log.summary}`)

  // TEST 5 : Cosplay romantique baiser avec tag #hot sur compte 7+ (Doit être REJECTED)
  console.log('\n--- TEST 5 : Cosplay romantique baiser avec tag #hot ("Miraculous Ladybug Cosplay #hot", AGE_7_PLUS) ---')
  const test5 = await validateVideo({
    videoId: '65fbcc72-cf91-4d25-abbf-bf155ec96d8c',
    title: 'Miraculous Ladybug Cosplay #hot',
    description: 'Vidéo de cosplay romantique montrant un baiser entre personnages.',
    language: 'fr',
    requestedAgeRating: 'AGE_7_PLUS',
    tags: ['cosplay', '#hot', 'miraculous'],
  })
  console.log(`   Statut obtenu : ${test5.status}`)
  console.log(`   Score         : ${test5.score}`)
  console.log(`   Décision IA   : ${test5.log.decision}`)
  console.log(`   Tranche d’âge : ${test5.log.age_rating}`)
  console.log(`   Violations    : ${test5.log.violations.length}`)
  console.log(`   Résumé        : ${test5.log.summary}`)

  console.log('\n====================================================')
  const test1Ok = test1.status === 'APPROVED'
  const test2Ok = test2.status === 'NEEDS_REVIEW' || test2.status === 'REJECTED'
  const test3Ok = test3.status === 'REJECTED'
  const test4Ok = test4.status === 'REJECTED'
  const test5Ok = test5.status === 'REJECTED'

  console.log(`Test 1 (Enfant sain approuvé)               : ${test1Ok ? '✅ SUCCÈS' : '❌ ÉCHEC (' + test1.status + ')'}`)
  console.log(`Test 2 (Horreur < 13 ans bloquée)            : ${test2Ok ? '✅ SUCCÈS' : '❌ ÉCHEC (' + test2.status + ')'}`)
  console.log(`Test 3 (Violence extrême rejetée)            : ${test3Ok ? '✅ SUCCÈS' : '❌ ÉCHEC (' + test3.status + ')'}`)
  console.log(`Test 4 (Baisers / Romance < 13 ans rejetés)  : ${test4Ok ? '✅ SUCCÈS' : '❌ ÉCHEC (' + test4.status + ')'}`)
  console.log(`Test 5 (Cosplay baiser #hot 7+ rejeté)      : ${test5Ok ? '✅ SUCCÈS' : '❌ ÉCHEC (' + test5.status + ')'}`)

  if (test1Ok && test2Ok && test3Ok && test4Ok && test5Ok) {
    console.log('\n🎉 TOUS LES TESTS DE VALIDATION IA ONT RÉUSSI !')
    console.log('Les règles renforcées protègent efficacement les moins de 13 ans.')
  } else {
    console.error('\n⚠️ Certains tests ont échoué.')
    process.exit(1)
  }
}

run().catch(err => {
  console.error('\n❌ Erreur fatale lors du test IA :', err)
  process.exit(1)
})
