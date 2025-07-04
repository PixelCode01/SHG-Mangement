const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testGroupLeaderLogic() {
  console.log('🧪 Testing Group Leader Assignment Logic...\n')
  
  try {
    // Get the current user
    const user = await prisma.user.findFirst({
      where: { email: 'shjshs75@htstjh.stugy' }
    })
    
    if (!user) {
      console.log('❌ Test user not found')
      return
    }
    
    console.log(`👤 Creating User: ${user.email}`)
    console.log(`👤 User Member ID: ${user.memberId || 'WILL BE AUTO-CREATED'}`)
    
    // Get some existing members for testing different scenarios
    const existingMembers = await prisma.member.findMany({
      take: 3,
      select: { id: true, name: true }
    })
    
    console.log('\n📋 Available Members for Selection:')
    existingMembers.forEach((member, index) => {
      console.log(`  ${index + 1}. ${member.name} (${member.id})`)
    })
    
    console.log('\n🎯 Expected Behavior Tests:')
    
    // Test Case 1: User selects themselves as leader
    console.log('\n1️⃣ Test Case: User selects themselves as leader')
    console.log(`   Input: leaderId = ${user.memberId || 'USER_MEMBER_ID'}`)
    console.log(`   Expected: group.leaderId = ${user.memberId || 'USER_MEMBER_ID'}`)
    console.log(`   Expected: NO pending invitation created`)
    
    // Test Case 2: User selects different member as leader
    console.log('\n2️⃣ Test Case: User selects different member as leader')
    console.log(`   Input: leaderId = ${existingMembers[0]?.id}`)
    console.log(`   Expected: group.leaderId = ${user.memberId || 'USER_MEMBER_ID'} (NOT ${existingMembers[0]?.id})`)
    console.log(`   Expected: Pending invitation created for ${existingMembers[0]?.name}`)
    
    // Test Case 3: Verify creator is always in members list
    console.log('\n3️⃣ Test Case: Creator inclusion in members')
    console.log(`   Expected: ${user.memberId || 'USER_MEMBER_ID'} always included in group.memberships`)
    console.log(`   Expected: Creator can be leader regardless of selection`)
    
    console.log('\n✅ Key Requirements Summary:')
    console.log('   ✓ Group leader ID = User creating group (ALWAYS)')
    console.log('   ✓ Selected leader ≠ Creator → Pending invitation')
    console.log('   ✓ Selected leader = Creator → No pending invitation') 
    console.log('   ✓ Creator always included in group members')
    console.log('   ✓ Auto-create member record if user has none')
    
    console.log('\n🚀 Ready to test in browser!')
    console.log('   Navigate to: /groups/create')
    console.log('   Fill out the form and test both scenarios above')
    
  } catch (error) {
    console.error('❌ Test preparation failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testGroupLeaderLogic()
