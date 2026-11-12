import { PrismaClient, UserRole, PlanInterval } from '../generated/client'
import * as argon2 from 'argon2'

const prisma = new PrismaClient()

function hashPassword(password: string) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  })
}

function hashPin(pin: string) {
  return argon2.hash(pin, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
  })
}

async function main() {
  console.log('Seeding database...')

  // ── Sources vidéo ────────────────────────────────────────────
  await prisma.videoSource.upsert({
    where: { slug: 'youtube' },
    update: {},
    create: {
      name: 'YouTube',
      slug: 'youtube',
      baseUrl: 'https://www.youtube.com',
      embedAllowed: true,
      cguVersion: '2024-01',
      cguCheckedAt: new Date(),
      embedPolicy: {
        embedUrl: 'https://www.youtube.com/embed/{id}',
        allowFullscreen: true,
        requiresConsent: false,
      },
    },
  })

  await prisma.videoSource.upsert({
    where: { slug: 'vimeo' },
    update: {},
    create: {
      name: 'Vimeo',
      slug: 'vimeo',
      baseUrl: 'https://vimeo.com',
      embedAllowed: true,
      cguVersion: '2024-01',
      cguCheckedAt: new Date(),
      embedPolicy: {
        embedUrl: 'https://player.vimeo.com/video/{id}',
        allowFullscreen: true,
        requiresConsent: false,
      },
    },
  })

  // ── Utilisateur admin (dev uniquement) ───────────────────────
  const adminPasswordHash = await hashPassword('Admin1234!')

  await prisma.user.upsert({
    where: { email: 'admin@nourplay.local' },
    update: { passwordHash: adminPasswordHash },
    create: {
      email: 'admin@nourplay.local',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      locale: 'fr',
    },
  })

  // ── Utilisateur enseignant de test ────────────────────────────
  const teacherPasswordHash = await hashPassword('Teacher1234!')

  await prisma.user.upsert({
    where: { email: 'teacher@nourplay.local' },
    update: { passwordHash: teacherPasswordHash },
    create: {
      email: 'teacher@nourplay.local',
      passwordHash: teacherPasswordHash,
      role: UserRole.TEACHER,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      locale: 'fr',
    },
  })

  // ── Utilisateur parent de test ────────────────────────────────
  const parent = await prisma.user.upsert({
    where: { email: 'parent@nourplay.local' },
    update: { passwordHash: await hashPassword('Parent1234!') },
    create: {
      email: 'parent@nourplay.local',
      passwordHash: await hashPassword('Parent1234!'),
      role: UserRole.PARENT,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      locale: 'fr',
    },
  })

  // ── Profil enfant de test ────────────────────────────────────
  const demoPinHash = await hashPin('1234')
  await prisma.childProfile.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: { pinHash: demoPinHash },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: parent.id,
      displayName: 'Petit Loup',
      ageGroup: 'AGE_4_6',
      pinHash: demoPinHash,
    },
  })

  // ── Plans d'abonnement ───────────────────────────────────────
  const plans = [
    {
      slug: 'free',
      name: 'Gratuit',
      priceEur: 0,
      interval: PlanInterval.MONTHLY,
      features: ['1 profil enfant', '5 playlists', 'Vidéothèque complète', 'Support par email'],
    },
    {
      slug: 'premium-monthly',
      name: 'Premium Mensuel',
      priceEur: 999,
      interval: PlanInterval.MONTHLY,
      features: ['Profils enfants illimités', 'Playlists illimitées', 'Planification horaire', 'Rapports d\'activité détaillés', 'Support prioritaire'],
    },
    {
      slug: 'premium-yearly',
      name: 'Premium Annuel',
      priceEur: 7999,
      interval: PlanInterval.YEARLY,
      features: ['Profils enfants illimités', 'Playlists illimitées', 'Planification horaire', 'Rapports d\'activité détaillés', 'Support prioritaire', '2 mois offerts'],
    },
  ]

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: { features: plan.features },
      create: plan,
    })
  }

  console.log('Seed completed.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
