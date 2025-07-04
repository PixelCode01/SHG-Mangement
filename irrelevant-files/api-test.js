// Quick API endpoint verification
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testBasicPrismaOperations() {
  try {
    console.log('🔍 Testing basic Prisma operations...');
    
    // Test group creation
    const testGroup = await prisma.group.create({
      data: {
        groupId: 'TEST-' + Date.now(),
        name: 'Quick Test Group',
        collectionFrequency: 'MONTHLY',
        collectionDayOfMonth: 15
      }
    });
    console.log('✅ Group created:', testGroup.id);
    
    // Test member creation
    const testMember = await prisma.member.create({
      data: {
        name: 'Test Member',
        email: 'test@example.com'
      }
    });
    console.log('✅ Member created:', testMember.id);
    
    // Test membership
    const membership = await prisma.memberGroupMembership.create({
      data: {
        memberId: testMember.id,
        groupId: testGroup.id
      }
    });
    console.log('✅ Membership created:', membership.id);
    
    // Test periodic record
    const periodicRecord = await prisma.groupPeriodicRecord.create({
      data: {
        groupId: testGroup.id,
        meetingDate: new Date(),
        recordSequenceNumber: 1
      }
    });
    console.log('✅ Periodic record created:', periodicRecord.id);
    
    // Test member contribution
    const contribution = await prisma.memberContribution.create({
      data: {
        groupPeriodicRecordId: periodicRecord.id,
        memberId: testMember.id,
        compulsoryContributionDue: 500.0,
        minimumDueAmount: 500.0,
        dueDate: new Date()
      }
    });
    console.log('✅ Member contribution created:', contribution.id);
    
    // Test cash allocation
    const allocation = await prisma.cashAllocation.create({
      data: {
        groupPeriodicRecordId: periodicRecord.id,
        allocationType: 'BANK_TRANSFER',
        totalAllocated: 1000.0
      }
    });
    console.log('✅ Cash allocation created:', allocation.id);
    
    // Test late fine rule
    const lateFineRule = await prisma.lateFineRule.create({
      data: {
        groupId: testGroup.id,
        ruleType: 'DAILY_FIXED',
        isEnabled: true,
        dailyAmount: 10.0
      }
    });
    console.log('✅ Late fine rule created:', lateFineRule.id);
    
    // Cleanup
    await prisma.memberContribution.delete({ where: { id: contribution.id } });
    await prisma.cashAllocation.delete({ where: { id: allocation.id } });
    await prisma.lateFineRule.delete({ where: { id: lateFineRule.id } });
    await prisma.groupPeriodicRecord.delete({ where: { id: periodicRecord.id } });
    await prisma.memberGroupMembership.delete({ where: { id: membership.id } });
    await prisma.member.delete({ where: { id: testMember.id } });
    await prisma.group.delete({ where: { id: testGroup.id } });
    
    console.log('✅ Cleanup completed');
    console.log('\n🎉 All Prisma operations successful!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testBasicPrismaOperations();
