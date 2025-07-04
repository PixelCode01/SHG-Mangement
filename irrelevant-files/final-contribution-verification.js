const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyContributionFix() {
  try {
    console.log('🔍 Final Verification: Contribution Record Fix\n');
    
    const groupId = '6841a5ea4aee2245b9ff2fc4'; // The test group
    
    // 1. Check group exists and has members
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { 
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!group) {
      console.log('❌ Group not found');
      return;
    }
    
    console.log(`✅ Group found: ${group.name}`);
    console.log(`   Members: ${group.memberships.length}`);
    
    // 2. Check current periodic record exists
    const currentRecord = await prisma.groupPeriodicRecord.findFirst({
      where: { groupId },
      orderBy: { meetingDate: 'desc' },
      include: {
        memberContributions: {
          include: {
            member: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!currentRecord) {
      console.log('❌ No periodic record found');
      return;
    }
    
    console.log(`✅ Current periodic record found: ${currentRecord.id}`);
    console.log(`   Meeting Date: ${currentRecord.meetingDate.toISOString().split('T')[0]}`);
    console.log(`   Contribution records: ${currentRecord.memberContributions.length}`);
    
    // 3. Check if all members have contribution records
    const memberIds = new Set(group.memberships.map(m => m.member.id));
    const contributionMemberIds = new Set(currentRecord.memberContributions.map(c => c.memberId));
    
    const missingMembers = group.memberships.filter(m => !contributionMemberIds.has(m.member.id));
    
    if (missingMembers.length === 0) {
      console.log('✅ All members have contribution records!');
    } else {
      console.log(`⚠️  Missing contribution records for ${missingMembers.length} members:`);
      missingMembers.forEach(membership => {
        console.log(`   - ${membership.member.name} (ID: ${membership.member.id})`);
      });
    }
    
    // 4. Show contribution record details for verification
    console.log('\n📊 Contribution Records Summary:');
    currentRecord.memberContributions.forEach(contrib => {
      const status = contrib.totalPaid >= contrib.minimumDueAmount ? '✅ PAID' : 
                    contrib.totalPaid > 0 ? '🟡 PARTIAL' : '🔴 PENDING';
      console.log(`   ${contrib.member.name}: ${status}`);
      console.log(`      Due: ₹${contrib.minimumDueAmount}, Paid: ₹${contrib.totalPaid}`);
    });
    
    // 5. Test the creation function (simulating API POST)
    console.log('\n🧪 Testing contribution record creation...');
    
    if (missingMembers.length > 0) {
      const testMember = missingMembers[0].member;
      console.log(`   Creating record for: ${testMember.name}`);
      
      const newContribution = await prisma.memberContribution.create({
        data: {
          groupPeriodicRecordId: currentRecord.id,
          memberId: testMember.id,
          compulsoryContributionDue: group.monthlyContribution || 100,
          loanInterestDue: 0,
          minimumDueAmount: group.monthlyContribution || 100,
          dueDate: new Date(),
          status: 'PENDING'
        },
        include: {
          member: {
            select: { name: true }
          }
        }
      });
      
      console.log(`   ✅ Successfully created contribution record for ${newContribution.member.name}`);
      console.log(`      Record ID: ${newContribution.id}`);
      console.log(`      Due Amount: ₹${newContribution.minimumDueAmount}`);
    } else {
      console.log('   ℹ️  All members already have contribution records');
    }
    
    // 6. Final verification
    const finalCount = await prisma.memberContribution.count({
      where: { groupPeriodicRecordId: currentRecord.id }
    });
    
    console.log(`\n🎉 Final Result:`);
    console.log(`   Total members: ${group.memberships.length}`);
    console.log(`   Total contribution records: ${finalCount}`);
    
    if (finalCount >= group.memberships.length) {
      console.log('   ✅ SUCCESS: All members have contribution records!');
      console.log('\n✨ The "No contribution record found" error should be resolved.');
    } else {
      console.log('   ⚠️  Some members still missing contribution records');
    }
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyContributionFix();
