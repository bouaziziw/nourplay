import { PrismaClient, UserRole } from '@nourplay/db'

const targetEmail = (process.argv[2] || 'bouaziziw@gmail.com').trim().toLowerCase()

async function main() {
  const prisma = new PrismaClient()
  try {
    console.log(`Assigning role ADMIN to: ${targetEmail}`)
    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
    })

    if (!user) {
      console.log(`User ${targetEmail} not found. Creating user with role ADMIN...`)
      const created = await prisma.user.create({
        data: {
          email: targetEmail,
          role: UserRole.ADMIN,
          emailVerified: true,
          emailVerifiedAt: new Date(),
        },
      })
      console.log(`Successfully created user ${created.email} with role ${created.role} (ID: ${created.id})`)
    } else {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: UserRole.ADMIN,
          emailVerified: true,
        },
      })
      console.log(`Successfully updated user ${updated.email} from ${user.role} to role ${updated.role} (ID: ${updated.id})`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err)
  process.exit(1)
})
