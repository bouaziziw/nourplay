import { PrismaClient, UserRole, VideoValidationStatus, AgeRating } from '../generated/client'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

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
  const { createHash: _hash } = await import('crypto')
  const adminPasswordHash = _hash('sha256').update('Admin1234!').digest('hex')

  await prisma.user.upsert({
    where: { email: 'admin@nourplay.local' },
    update: {},
    create: {
      email: 'admin@nourplay.local',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      locale: 'fr',
    },
  })

  // ── Utilisateur parent de test ───────────────────────────────
  const parent = await prisma.user.upsert({
    where: { email: 'parent@nourplay.local' },
    update: {},
    create: {
      email: 'parent@nourplay.local',
      passwordHash: createHash('sha256').update('Parent1234!').digest('hex'),
      role: UserRole.PARENT,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      locale: 'fr',
    },
  })

  // ── Profil enfant de test ────────────────────────────────────
  await prisma.childProfile.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      userId: parent.id,
      displayName: 'Petit Loup',
      ageGroup: 'AGE_4_6',
      pinHash: createHash('sha256').update('1234').digest('hex'),
    },
  })

  console.log('Seed completed.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
