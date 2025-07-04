const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function resetUserForTesting() {
  console.log('🔄 Resetting user for full API testing...\n')
  
  try {
    // Reset the user's member linkage to null to test the API auto-creation
    const user = await prisma.user.findFirst({
      where: { email: 'shjshs75@htstjh.stugy' }
    })
    
    if (!user) {
      console.log('❌ User not found')
      return
    }
    
    console.log(`User: ${user.email}`)
    console.log(`Current Member ID: ${user.memberId}`)
    
    // Remove the linkage to test auto-creation
    await prisma.user.update({
      where: { id: user.id },
      data: { memberId: null }
    })
    
    console.log('✅ Reset user.memberId to null')
    console.log('✅ Now the API should automatically create and link a member record')
    console.log('✅ You can test group creation in the browser!')
    
  } catch (error) {
    console.error('❌ Reset failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

resetUserForTesting()
