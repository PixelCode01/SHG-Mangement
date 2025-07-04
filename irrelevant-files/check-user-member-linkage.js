const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUserMemberLinkage() {
  console.log('🔍 Checking User-Member Linkage...\n')
  
  try {
    // Get all users
    const users = await prisma.user.findMany({
      include: {
        membersCreated: true // Members they created
      }
    })
    
    console.log(`Found ${users.length} users:`)
    
    for (const user of users) {
      console.log(`\nUser: ${user.email}`)
      console.log(`Role: ${user.role}`)
      console.log(`Member ID: ${user.memberId || 'NOT LINKED'}`)
      console.log(`Members Created: ${user.membersCreated.length}`)
      
      if (user.memberId) {
        // Check if the linked member exists
        const memberRecord = await prisma.member.findUnique({
          where: { id: user.memberId }
        })
        
        if (memberRecord) {
          console.log(`✅ Linked to: ${memberRecord.name}`)
        } else {
          console.log(`❌ BROKEN LINK: Member ${user.memberId} not found`)
        }
      }
    }
    
    // Get all members and see which ones are linked to users
    console.log('\n📋 All Members:')
    const members = await prisma.member.findMany({
      include: {
        users: true
      }
    })
    
    for (const member of members) {
      console.log(`\nMember: ${member.name}`)
      console.log(`ID: ${member.id}`)
      console.log(`Linked Users: ${member.users.length}`)
      
      if (member.users.length > 0) {
        for (const user of member.users) {
          console.log(`  - ${user.email} (${user.role})`)
        }
      } else {
        console.log('  - No linked users')
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUserMemberLinkage()
