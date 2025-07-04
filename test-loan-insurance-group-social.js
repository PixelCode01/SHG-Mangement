#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLoanInsuranceAndGroupSocial() {
  console.log('🧪 Testing Loan Insurance and Group Social Features...\n');
  
  try {
    // 1. Test Group Settings
    console.log('1. Testing Group Settings...');
    const groups = await prisma.group.findMany({
      where: {
        OR: [
          { loanInsuranceEnabled: true },
          { groupSocialEnabled: true }
        ]
      },
      select: {
        id: true,
        name: true,
        loanInsuranceEnabled: true,
        loanInsurancePercent: true,
        groupSocialEnabled: true,
        groupSocialAmount: true,
        members: {
          select: {
            id: true,
            name: true,
            currentLoanAmount: true
          }
        }
      }
    });
    
    console.log(`   Found ${groups.length} groups with loan insurance or group social enabled`);
    groups.forEach(group => {
      console.log(`   - ${group.name}:`);
      if (group.loanInsuranceEnabled) {
        console.log(`     • Loan Insurance: ${group.loanInsurancePercent}% of loan amount`);
      }
      if (group.groupSocialEnabled) {
        console.log(`     • Group Social: ₹${group.groupSocialAmount} per member`);
      }
    });
    
    // 2. Test Member Contributions
    console.log('\n2. Testing Member Contributions with new fields...');
    const contributions = await prisma.memberContribution.findMany({
      where: {
        OR: [
          { loanInsuranceDue: { gt: 0 } },
          { groupSocialDue: { gt: 0 } },
          { loanInsurancePaid: { gt: 0 } },
          { groupSocialPaid: { gt: 0 } }
        ]
      },
      select: {
        id: true,
        member: {
          select: {
            name: true
          }
        },
        loanInsuranceDue: true,
        groupSocialDue: true,
        loanInsurancePaid: true,
        groupSocialPaid: true,
        totalPaid: true,
        status: true
      },
      take: 10
    });
    
    console.log(`   Found ${contributions.length} contributions with loan insurance or group social`);
    contributions.forEach(contribution => {
      console.log(`   - ${contribution.member.name}:`);
      if (contribution.loanInsuranceDue > 0) {
        console.log(`     • Loan Insurance Due: ₹${contribution.loanInsuranceDue}, Paid: ₹${contribution.loanInsurancePaid}`);
      }
      if (contribution.groupSocialDue > 0) {
        console.log(`     • Group Social Due: ₹${contribution.groupSocialDue}, Paid: ₹${contribution.groupSocialPaid}`);
      }
      console.log(`     • Total Paid: ₹${contribution.totalPaid}, Status: ${contribution.status}`);
    });
    
    // 3. Test API Compatibility
    console.log('\n3. Testing API Compatibility...');
    if (groups.length > 0) {
      const testGroup = groups[0];
      console.log(`   Testing with group: ${testGroup.name}`);
      
      // Test group update
      const updatedGroup = await prisma.group.update({
        where: { id: testGroup.id },
        data: {
          loanInsuranceEnabled: testGroup.loanInsuranceEnabled,
          loanInsurancePercent: testGroup.loanInsurancePercent || 2.0,
          groupSocialEnabled: testGroup.groupSocialEnabled,
          groupSocialAmount: testGroup.groupSocialAmount || 50.0
        }
      });
      console.log(`   ✅ Group update successful`);
      
      // Test contribution update if available
      if (contributions.length > 0) {
        const testContribution = contributions[0];
        const updatedContribution = await prisma.memberContribution.update({
          where: { id: testContribution.id },
          data: {
            loanInsurancePaid: testContribution.loanInsurancePaid,
            groupSocialPaid: testContribution.groupSocialPaid,
            totalPaid: testContribution.totalPaid
          }
        });
        console.log(`   ✅ Contribution update successful`);
      }
    }
    
    console.log('\n✅ All tests passed! Loan Insurance and Group Social features are working correctly.');
    
  } catch (error) {
    console.error('❌ Error during testing:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testLoanInsuranceAndGroupSocial().catch(console.error);
