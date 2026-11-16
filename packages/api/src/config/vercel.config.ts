import { ConfigFactory } from '@nestjs/config'

export interface VercelEnvironment {
  isVercel: boolean
  region: string
  deploymentId: string
  deploymentUrl: string
  env: string
}

/**
 * Détecte et retourne les informations d'environnement Vercel
 * Vercel set automatiquement : VERCEL=1, VERCEL_REGION, VERCEL_DEPLOYMENT_ID, VERCEL_ENV
 */
export const getVercelConfig = (): VercelEnvironment => {
  const isVercel = process.env.VERCEL === '1'

  return {
    isVercel,
    region: process.env.VERCEL_REGION || 'local',
    deploymentId: process.env.VERCEL_DEPLOYMENT_ID || 'development',
    deploymentUrl: process.env.VERCEL_DEPLOYMENT_URL || `http://localhost:${process.env.PORT || 4000}`,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  }
}

/**
 * Configuration spécifique Vercel pour NestJS
 * À utiliser dans app.module.ts ou dans la validation de configuration
 */
export const vercelConfig: ConfigFactory = () => ({
  vercel: getVercelConfig(),

  // Désactiver les tâches planifiées NestJS sur Vercel
  // (les crons sont disponibles via les routes HTTP + cron-job.org ou Vercel Cron)
  cronEnabled: process.env.VERCEL !== '1',

  // Configuration recommandée pour Vercel Functions
  functions: {
    maxDuration: 60, // 60 secondes max pour une requête
    memory: 1024, // 1 GB RAM par défaut
  },

  // Health checks
  healthCheck: {
    enabled: true,
    path: '/api/v1/health',
    interval: 30000, // 30 secondes (optionnel, Vercel peut utiliser directement l'endpoint)
  },
})
