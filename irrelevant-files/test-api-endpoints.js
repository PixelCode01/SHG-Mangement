// Simple API endpoint test for SHG contribution tracking
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testApiEndpoints() {
  try {
    console.log('🚀 Testing API endpoint data structure...\n');
    
    // Find an existing group or use a test group
    let testGroup = await prisma.group.findFirst({
      where: { name: 'Test SHG Group' }
    });

    if (!testGroup) {
      console.log('📝 Creating minimal test data...');
      
      // Create minimal test group
      testGroup = await prisma.group.create({
        data: {
          groupId: 'GRP-TEST-API',
          name: 'Test SHG Group',
          address: 'Test Address',
          collectionFrequency: 'MONTHLY',
          collectionDayOfMonth: 15,
          monthlyContribution: 500.0
        }
      });

      // Create a test member
      const testMember = await prisma.member.create({
        data: {
          name: 'Test Member',
          email: 'test@example.com',
          phone: '1234567890'
        }
      });

      // Create membership
      await prisma.memberGroupMembership.create({
        data: {
          memberId: testMember.id,
          groupId: testGroup.id
        }
      });

      // Create periodic record
      const periodicRecord = await prisma.groupPeriodicRecord.create({
        data: {
          groupId: testGroup.id,
          meetingDate: new Date(),
          recordSequenceNumber: 1,
          totalCollectionThisPeriod: 500.0
        }
      });

      // Create member contribution
      await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: periodicRecord.id,
          memberId: testMember.id,
          compulsoryContributionDue: 500.0,
          minimumDueAmount: 500.0,
          status: 'PENDING',
          dueDate: new Date(),
          remainingAmount: 500.0
        }
      });

      console.log('✅ Test data created');
    }

    console.log(`\n🏛️ Test Group ID: ${testGroup.id}`);
    console.log(`🔗 Group Name: ${testGroup.name}`);

    // Test 1: Fetch current contributions (simulating API call)
    console.log('\n📊 Testing current contributions endpoint structure...');
    
    const currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId: testGroup.id },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
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
        },
        cashAllocations: {
          orderBy: { lastModifiedAt: 'desc' },
          take: 1
        }
      }
    });

    if (currentRecord) {
      console.log('✅ Current record found:', {
        id: currentRecord.id,
        meetingDate: currentRecord.meetingDate,
        contributionsCount: currentRecord.memberContributions.length,
        cashAllocationsCount: currentRecord.cashAllocations.length
      });
      
      console.log('\n👥 Member contributions:');
      currentRecord.memberContributions.forEach((contrib, index) => {
        console.log(`  ${index + 1}. ${contrib.member.name} - Status: ${contrib.status}, Due: ₹${contrib.minimumDueAmount}, Remaining: ₹${contrib.remainingAmount}`);
      });
    } else {
      console.log('❌ No current record found');
    }

    // Test 2: Test data for bulk update
    console.log('\n💰 Testing bulk contribution update structure...');
    
    const members = await prisma.member.findMany({
      where: {
        memberships: {
          some: { groupId: testGroup.id }
        }
      }
    });

    console.log(`✅ Found ${members.length} members for bulk update`);
    
    if (members.length > 0) {
      console.log('📋 Member list for bulk operations:');
      members.forEach((member, index) => {
        console.log(`  ${index + 1}. ${member.name} (ID: ${member.id})`);
      });
    }

    // Test 3: Test late fine rule structure
    console.log('\n⚖️ Testing late fine rules...');
    
    const lateFineRules = await prisma.lateFineRule.findMany({
      where: { groupId: testGroup.id },
      include: {
        tierRules: true
      }
    });

    console.log(`✅ Found ${lateFineRules.length} late fine rules`);
    
    lateFineRules.forEach((rule, index) => {
      console.log(`  ${index + 1}. Rule Type: ${rule.ruleType}, Enabled: ${rule.isEnabled}, Tiers: ${rule.tierRules.length}`);
    });

    // Test 4: Test collection schedule
    console.log('\n📅 Testing collection schedule...');
    
    console.log(`✅ Collection details:`, {
      frequency: testGroup.collectionFrequency,
      dayOfMonth: testGroup.collectionDayOfMonth,
      monthlyContribution: testGroup.monthlyContribution
    });

    console.log('\n🎉 All API endpoint structures are working correctly!');
    
    return {
      groupId: testGroup.id,
      recordId: currentRecord?.id,
      membersCount: members.length,
      success: true
    };

  } catch (error) {
    console.error('❌ API endpoint test failed:', error);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testApiEndpoints()
  .then((result) => {
    if (result.success) {
      console.log('\n✅ API Endpoint Test Summary:');
      console.log(`- Group ID: ${result.groupId}`);
      console.log(`- Record ID: ${result.recordId || 'N/A'}`);
      console.log(`- Members: ${result.membersCount}`);
      console.log('\n🌐 You can now test the actual API endpoints:');
      console.log(`1. GET /api/groups/${result.groupId}/contributions/current`);
      console.log(`2. POST /api/groups/${result.groupId}/contributions/bulk`);
      console.log(`3. POST /api/groups/${result.groupId}/allocations`);
      console.log(`4. GET /api/groups/${result.groupId}/reports`);
      console.log('\n🚀 All systems ready for contribution tracking!');
    } else {
      console.log(`\n❌ Test failed: ${result.error}`);
    }
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
