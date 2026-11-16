#!/usr/bin/env node

/**
 * Script de validation avant déploiement Vercel
 * Vérifie que la configuration est correcte et complète
 * 
 * Usage: node scripts/validate-vercel.js
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
}

const log = {
  success: (msg) => console.log(`${COLORS.green}✅${COLORS.reset} ${msg}`),
  error: (msg) => console.log(`${COLORS.red}❌${COLORS.reset} ${msg}`),
  warn: (msg) => console.log(`${COLORS.yellow}⚠️${COLORS.reset}  ${msg}`),
  info: (msg) => console.log(`${COLORS.blue}ℹ️${COLORS.reset}  ${msg}`),
}

let errors = 0
let warnings = 0

// ─────────────────────────────────────────────────────────────
// 1. Vérifier les fichiers critiques
// ─────────────────────────────────────────────────────────────

console.log('\n📋 Vérifiant les fichiers critiques...\n')

const requiredFiles = [
  'packages/api/src/app.module.ts',
  'packages/api/src/main.ts',
  'packages/api/vercel.json',
  'packages/api/src/modules/cron/cron.controller.ts',
  'packages/api/src/modules/cron/cron.module.ts',
  'packages/api/src/modules/health/health.controller.ts',
  'packages/api/src/modules/health/health.module.ts',
  'packages/db/prisma/schema.prisma',
  'apps/web/next.config.mjs',
  'apps/web/src/middleware.ts',
  'apps/admin/next.config.mjs',
]

for (const file of requiredFiles) {
  const filePath = path.join(rootDir, file)
  if (fs.existsSync(filePath)) {
    log.success(`Fichier trouvé: ${file}`)
  } else {
    log.error(`Fichier MANQUANT: ${file}`)
    errors++
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Vérifier les configurations
// ─────────────────────────────────────────────────────────────

console.log('\n⚙️  Vérifiant les configurations...\n')

// Vérifier app.module.ts
const appModulePath = path.join(rootDir, 'packages/api/src/app.module.ts')
const appModuleContent = fs.readFileSync(appModulePath, 'utf8')

if (appModuleContent.includes('ScheduleModule.forRoot()')) {
  if (appModuleContent.includes('process.env.VERCEL ? [] : [ScheduleModule.forRoot()]')) {
    log.success('ScheduleModule correctement désactivé pour Vercel')
  } else {
    log.error('ScheduleModule.forRoot() trouvé mais pas correctement conditionné')
    errors++
  }
}

if (appModuleContent.includes('HealthModule')) {
  log.success('HealthModule importé dans AppModule')
} else {
  log.error('HealthModule NON IMPORTÉ dans AppModule')
  errors++
}

if (appModuleContent.includes('CronModule')) {
  log.success('CronModule importé dans AppModule')
} else {
  log.error('CronModule NON IMPORTÉ dans AppModule')
  errors++
}

// Vérifier Prisma schema
const prismaSchemaPath = path.join(rootDir, 'packages/db/prisma/schema.prisma')
const prismaSchemaContent = fs.readFileSync(prismaSchemaPath, 'utf8')

if (prismaSchemaContent.includes('rhel-openssl-3.0.x')) {
  log.success('Binary target Linux (rhel-openssl-3.0.x) configuré pour Prisma')
} else {
  log.error('Binary target Linux MANQUANT dans schema.prisma')
  errors++
}

// Vérifier next.config.mjs (web)
const webNextConfigPath = path.join(rootDir, 'apps/web/next.config.mjs')
const webNextConfigContent = fs.readFileSync(webNextConfigPath, 'utf8')

if (webNextConfigContent.includes('API_PROXY_ORIGIN') && webNextConfigContent.includes('ADMIN_PROXY_ORIGIN')) {
  log.success('Rewrites web configurés avec origines proxy')
} else {
  log.error('Rewrites web INCOMPLETS (origines proxy manquantes)')
  errors++
}

// ─────────────────────────────────────────────────────────────
// 3. Vérifier les secrets
// ─────────────────────────────────────────────────────────────

console.log('\n🔐 Vérifiant les secrets...\n')

const envExamplePath = path.join(rootDir, '.env.example')
if (fs.existsSync(envExamplePath)) {
  const envExampleContent = fs.readFileSync(envExamplePath, 'utf8')

  const secrets = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'COOKIE_SECRET',
    'CRON_SECRET',
    'VAPID_PUBLIC_KEY',
    'VAPID_PRIVATE_KEY',
  ]

  for (const secret of secrets) {
    if (envExampleContent.includes(secret)) {
      log.info(`Variable documentée: ${secret}`)
    } else {
      log.warn(`Variable NON documentée: ${secret}`)
      warnings++
    }
  }
} else {
  log.warn('.env.example introuvable')
}

// ─────────────────────────────────────────────────────────────
// 4. Vérifier que le worker est exclu
// ─────────────────────────────────────────────────────────────

console.log('\n🚫 Vérifiant l\'exclusion du worker...\n')

const deployWorkflow = fs.readFileSync(path.join(rootDir, '.github/workflows/deploy.yml'), 'utf8')
if (/workers\/video-validator\/Dockerfile|pull[^\n]*video-validator/.test(deployWorkflow)) {
  log.warn('deploy.yml build ou déploie encore le worker video-validator')
  warnings++
} else {
  log.success('deploy.yml ne build ni ne déploie le worker video-validator')
}

const composeProd = fs.readFileSync(path.join(rootDir, 'docker-compose.prod.yml'), 'utf8')
if (/video-validator:[\s\S]*?profiles:\s*\[\s*["']worker["']\s*\]/.test(composeProd)) {
  log.success('docker-compose.prod.yml: video-validator derrière le profil "worker" (désactivé par défaut)')
} else {
  log.warn('docker-compose.prod.yml: video-validator démarre par défaut')
  warnings++
}

// Vérifier que OPENAI_API_KEY ne sont pas dans l'API
const mainPath = path.join(rootDir, 'packages/api/src/main.ts')
const mainContent = fs.readFileSync(mainPath, 'utf8')

if (!mainContent.includes('OPENAI_API_KEY')) {
  log.success('OPENAI_API_KEY NOT FOUND dans main.ts (correct: uniquement sur worker)')
} else {
  log.warn('OPENAI_API_KEY trouvée dans main.ts (doit être seulement sur worker)')
  warnings++
}

// ─────────────────────────────────────────────────────────────
// 5. Vérifier les exports de services
// ─────────────────────────────────────────────────────────────

console.log('\n📦 Vérifiant les exports de services (pour Cron)...\n')

const userModulePath = path.join(rootDir, 'packages/api/src/modules/user/user.module.ts')
if (fs.existsSync(userModulePath)) {
  const userModuleContent = fs.readFileSync(userModulePath, 'utf8')
  if (userModuleContent.includes('UserTasksService')) {
    log.success('UserTasksService trouvé dans user.module.ts')
  } else {
    log.warn('UserTasksService pas explicitement exporté')
    warnings++
  }
}

const subscriptionModulePath = path.join(
  rootDir,
  'packages/api/src/modules/subscription/subscription.module.ts',
)
if (fs.existsSync(subscriptionModulePath)) {
  const subscriptionModuleContent = fs.readFileSync(subscriptionModulePath, 'utf8')
  if (subscriptionModuleContent.includes('SubscriptionTasksService')) {
    log.success('SubscriptionTasksService trouvé dans subscription.module.ts')
  } else {
    log.warn('SubscriptionTasksService pas explicitement exporté')
    warnings++
  }
}

// ─────────────────────────────────────────────────────────────
// 6. Résumé
// ─────────────────────────────────────────────────────────────

console.log('\n' + '='.repeat(60))
if (errors === 0 && warnings === 0) {
  log.success('✨ Configuration Vercel PRÊTE pour la production! ✨')
  console.log(
    '\n📝 Prochaines étapes:\n' +
      '  1. Créer les projets Vercel (web, admin, api)\n' +
      '  2. Configurer Neon PostgreSQL et Upstash Redis\n' +
      '  3. Ajouter les variables d\'environnement\n' +
      '  4. Configurer cron-job.org avec les 4 tâches\n' +
      '  5. Déployer le worker sur Railway/Render\n' +
      '  6. Tester les routes: /api/v1/health, /api/v1/subscriptions/plans\n',
  )
  process.exit(0)
} else {
  console.log(
    `\n${COLORS.red}${errors > 0 ? errors + ' erreur(s) critique(s)' : ''}${errors > 0 && warnings > 0 ? ', ' : ''}${warnings > 0 ? warnings + ' avertissement(s)' : ''}${COLORS.reset}`,
  )
  console.log('\n⛔ Résolvez ces problèmes avant de déployer en production.\n')
  process.exit(errors > 0 ? 1 : 0)
}
