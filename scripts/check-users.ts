import 'dotenv/config'
import { PrismaClient } from '../packages/db/src'

async function check() {
  const prisma = new PrismaClient()
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, emailVerified: true },
    })
    console.log('Utilisateurs enregistrés :', users)
  } finally {
    await prisma.$disconnect()
  }
}

check().catch(console.error)
