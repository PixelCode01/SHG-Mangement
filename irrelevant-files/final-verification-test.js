const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function runFinalVerification() {
  console.log('🔍 Starting Final Verification Test...\n')
  
  try {
    // 1. Check group creation logic
    console.log('1. Verifying Group Creation Logic...')
    const groups = await prisma.group.findMany({
      include: {
        memberships: {
          include: {
            member: true
          }
        },
        leader: true,
        pendingLeaderships: true
      }
    })
    
    console.log(`Found ${groups.length} groups`)
    
    for (const group of groups) {
      console.log(`\nGroup: ${group.name}`)
      console.log(`Leader: ${group.leader?.name || 'No leader'} (ID: ${group.leaderId})`)
      console.log(`Members: ${group.memberships.length}`)
      console.log(`Pending Leaderships: ${group.pendingLeaderships.length}`)
      
      // Check if leader is in members
      const leaderInMembers = group.memberships.some(m => m.member.id === group.leaderId)
      console.log(`Leader in members: ${leaderInMembers}`)
    }
    
    // 2. Check late fine rules and contributions
    console.log('\n2. Verifying Late Fine System...')
    const lateFineRules = await prisma.lateFineRule.findMany({
      include: {
        group: true,
        tierRules: true
      }
    })
    
    console.log(`Found ${lateFineRules.length} late fine rules`)
    
    for (const rule of lateFineRules) {
      console.log(`\nGroup: ${rule.group.name}`)
      console.log(`Late Fine Enabled: ${rule.isEnabled}`)
      console.log(`Tier Rules: ${rule.tierRules.length}`)
    }
    
    // 3. Check contributions with late fines
    const contributionsWithLateFines = await prisma.memberContribution.findMany({
      where: {
        lateFineAmount: {
          gt: 0
        }
      },
      include: {
        member: true,
        groupPeriodicRecord: {
          include: {
            group: true
          }
        }
      }
    })
    
    console.log(`\nFound ${contributionsWithLateFines.length} contributions with late fines`)
    
    for (const contribution of contributionsWithLateFines) {
      console.log(`Member: ${contribution.member.name}, Group: ${contribution.groupPeriodicRecord.group.name}, Late Fine: ₹${contribution.lateFineAmount}`)
    }
    
    // 4. Check group permission structure
    console.log('\n3. Verifying Group Permissions...')
    const groupsWithMembers = await prisma.group.findMany({
      include: {
        memberships: {
          include: {
            member: true
          }
        },
        leader: true
      }
    })
    
    for (const group of groupsWithMembers) {
      const leaderId = group.leaderId
      const leaderMember = group.memberships.find(m => m.member.id === leaderId)
      
      console.log(`\nGroup: ${group.name}`)
      console.log(`Leader ID: ${leaderId}`)
      console.log(`Leader exists as member: ${!!leaderMember}`)
      
      if (leaderMember) {
        console.log(`Leader name: ${leaderMember.member.name}`)
      }
    }
    
    // 5. Check periods
    console.log('\n4. Verifying Periods...')
    const allPeriods = await prisma.groupPeriodicRecord.findMany({
      include: {
        group: true
      }
    })
    
    console.log(`Found ${allPeriods.length} total periods`)
    
    for (const period of allPeriods) {
      console.log(`Group: ${period.group.name}, Record #: ${period.recordSequenceNumber}, Date: ${period.meetingDate}`)
    }
    
    console.log('\n✅ Final Verification Complete!')
    console.log('\nSummary:')
    console.log(`- ${groups.length} groups found`)
    console.log(`- ${lateFineRules.length} late fine rules`)
    console.log(`- ${contributionsWithLateFines.length} contributions with late fines`)
    console.log(`- ${allPeriods.length} total periods`)
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

runFinalVerification()
