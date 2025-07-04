const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAPICreation() {
  try {
    console.log('🧪 Testing API Contribution Record Creation...\n');

    // Get a test group
    const group = await prisma.group.findFirst({
      where: {
        name: { contains: 'uh' }
      },
      include: {
        memberships: {
          include: {
            member: true
          }
        }
      }
    });

    if (!group) {
      console.log('❌ No test group found');
      return;
    }

    console.log(`✅ Testing with group: ${group.name}`);
    console.log(`   Members to test: ${group.memberships.length}`);

    // Get current periodic record
    const currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId: group.id },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: true
      }
    });

    console.log(`📊 Current record found: ${currentRecord ? 'Yes' : 'No'}`);
    if (currentRecord) {
      console.log(`   Existing contributions: ${currentRecord.memberContributions.length}`);
    }

    // Find members without contribution records
    const membersWithoutRecords = group.memberships.filter(membership => {
      const member = membership.member;
      return !currentRecord?.memberContributions.some(c => c.memberId === member.id);
    });

    console.log(`📋 Members without contribution records: ${membersWithoutRecords.length}`);
    
    if (membersWithoutRecords.length === 0) {
      console.log('ℹ️  All members already have contribution records. Creating a test member...');
      
      // Create a test member and add to group
      const testMember = await prisma.member.create({
        data: {
          name: 'Test API Member',
          phone: '9999999999',
          email: 'test.api@example.com',
          address: 'Test Address'
        }
      });
      
      await prisma.memberGroupMembership.create({
        data: {
          groupId: group.id,
          memberId: testMember.id,
          initialShareAmount: 1000,
          joinedAt: new Date()
        }
      });
      
      membersWithoutRecords.push({
        member: testMember
      });
      
      console.log(`   ✅ Created test member: ${testMember.name}`);
    }

    // Test creating contribution records for members without records
    for (const membership of membersWithoutRecords.slice(0, 3)) {
      const member = membership.member;
      try {
        console.log(`\n🔍 Testing member: ${member.name} (${member.id})`);
        
        console.log(`   📝 Creating contribution record...`);

        // Simulate the API call by directly creating the record
        const newContribution = await createContributionRecord(group.id, member.id);
        
        if (newContribution) {
          console.log(`   ✅ Successfully created contribution record`);
        } else {
          console.log(`   ❌ Failed to create contribution record`);
        }
        
      } catch (error) {
        console.log(`   ❌ Error for member ${member.name}:`, error.message);
        console.log(`      Stack trace:`, error.stack);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function createContributionRecord(groupId, memberId) {
  try {
    // Get or create the current periodic record
    let currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' }
    });

    // If no periodic record exists, create one for the current date
    if (!currentRecord) {
      console.log(`   📅 Creating new periodic record for group...`);
      
      const nextSequenceNumber = await prisma.groupPeriodicRecord.count({
        where: { groupId }
      }) + 1;

      currentRecord = await prisma.groupPeriodicRecord.create({
        data: {
          groupId,
          meetingDate: new Date(),
          recordSequenceNumber: nextSequenceNumber,
          standingAtStartOfPeriod: 0,
          newContributionsThisPeriod: 0,
          totalGroupStandingAtEndOfPeriod: 0,
          cashInHandAtEndOfPeriod: 0,
          cashInBankAtEndOfPeriod: 0,
          membersPresent: 0
        }
      });
      
      console.log(`   ✅ Created periodic record: ${currentRecord.id}`);
    }

    // Check if contribution already exists for this member in this period
    const existingContribution = await prisma.memberContribution.findFirst({
      where: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: memberId
      }
    });

    if (existingContribution) {
      console.log(`   ℹ️  Contribution already exists for this member`);
      return existingContribution;
    }

    // Get group settings for default amounts
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        monthlyContribution: true,
        collectionFrequency: true
      }
    });

    const defaultContributionAmount = group?.monthlyContribution || 0;
    const loanInterestDue = 0;
    const minimumDueAmount = defaultContributionAmount + loanInterestDue;

    // Calculate due date based on group's collection frequency
    const dueDate = new Date(currentRecord.meetingDate);
    if (group?.collectionFrequency === 'WEEKLY') {
      dueDate.setDate(dueDate.getDate() + 7);
    } else if (group?.collectionFrequency === 'FORTNIGHTLY') {
      dueDate.setDate(dueDate.getDate() + 14);
    } else if (group?.collectionFrequency === 'MONTHLY') {
      dueDate.setMonth(dueDate.getMonth() + 1);
    } else if (group?.collectionFrequency === 'YEARLY') {
      dueDate.setFullYear(dueDate.getFullYear() + 1);
    }

    console.log(`   💰 Default contribution: ${defaultContributionAmount}`);
    console.log(`   📅 Due date: ${dueDate.toISOString()}`);

    // Create the contribution record
    const newContribution = await prisma.memberContribution.create({
      data: {
        groupPeriodicRecordId: currentRecord.id,
        memberId: memberId,
        compulsoryContributionDue: defaultContributionAmount,
        loanInterestDue: loanInterestDue,
        minimumDueAmount: minimumDueAmount,
        remainingAmount: minimumDueAmount,
        dueDate: dueDate,
        status: 'PENDING',
        compulsoryContributionPaid: 0,
        loanInterestPaid: 0,
        lateFinePaid: 0,
        totalPaid: 0
      },
      include: {
        member: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        }
      }
    });

    return newContribution;
  } catch (error) {
    console.error(`   ❌ Database operation failed:`, error.message);
    throw error;
  }
}

testAPICreation().catch(console.error);
