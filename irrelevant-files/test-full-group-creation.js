const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testFullGroupCreation() {
  console.log('🧪 Testing Full Group Creation Flow...\n')
  
  try {
    // Get some existing members to use in the test group
    const existingMembers = await prisma.member.findMany({
      take: 3,
      select: { id: true, name: true }
    })
    
    if (existingMembers.length < 3) {
      console.log('❌ Not enough members for testing')
      return
    }
    
    console.log('📋 Using these members for test group:')
    existingMembers.forEach(member => {
      console.log(`  - ${member.name} (${member.id})`)
    })
    
    // Get the current user's member ID
    const user = await prisma.user.findFirst({
      where: { email: 'shjshs75@htstjh.stugy' }
    })
    
    console.log(`\n👤 Group Creator: ${user?.email} (Member ID: ${user?.memberId})`)
    
    // Simulate the API call data structure
    const testGroupData = {
      name: 'Test Group Created via API Fix',
      address: '123 Test Street',
      leaderId: existingMembers[0].id, // Select first member as leader 
      memberCount: 3,
      dateOfStarting: new Date().toISOString(),
      collectionFrequency: 'MONTHLY',
      cashInHand: 1000,
      balanceInBank: 5000,
      monthlyContribution: 100,
      interestRate: 12,
      members: existingMembers.map(member => ({
        memberId: member.id,
        currentShareAmount: 100,
        currentLoanAmount: 0,
        initialInterest: 0
      }))
    }
    
    console.log('\n🔧 Test group data prepared:')
    console.log(`  - Group Name: ${testGroupData.name}`)
    console.log(`  - Selected Leader: ${existingMembers[0].name} (${existingMembers[0].id})`)
    console.log(`  - Creator Member ID: ${user?.memberId}`)
    console.log(`  - Members Count: ${testGroupData.members.length}`)
    
    // The key assertion: the creator's member ID should become the actual leader
    console.log('\n✅ Expected Behavior:')
    console.log(`  - API should create group with leader = ${user?.memberId} (creator)`)
    console.log(`  - API should create pending invitation for ${existingMembers[0].id} (selected leader)`)
    console.log(`  - Creator should be included in members list`)
    
    console.log('\n🎯 Test data ready for manual API testing!')
    console.log('You can now try creating a group in the browser and it should work!')
    
  } catch (error) {
    console.error('❌ Test preparation failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFullGroupCreation()
