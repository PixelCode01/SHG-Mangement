const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkContributionData() {
  try {
    console.log('Checking contribution data for the contributions page...');

    const groupId = '68429cd28d2a9277f10c724b';
    
    // Check group with late fine rules
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        lateFineRules: {
          include: {
            tierRules: true
          }
        },
        memberships: {
          include: {
            member: {
              include: {
                users: true
              }
            }
          }
        }
      }
    });

    console.log(`\nGroup: ${group.name}`);
    console.log(`Monthly Contribution: ₹${group.monthlyContribution}`);
    console.log(`Late Fines Enabled: ${group.lateFineRules?.[0]?.isEnabled || false}`);
    console.log(`Members: ${group.memberships.length}`);

    // Check member contribution records
    const memberContributions = await prisma.memberContribution.findMany({
      include: {
        member: {
          include: {
            users: true
          }
        },
        groupPeriodicRecord: true
      }
    });

    console.log(`\nMember Contribution Records: ${memberContributions.length}`);
    
    for (const contrib of memberContributions) {
      const userName = contrib.member.users?.[0]?.name || contrib.member.name;
      console.log(`\n${userName}:`);
      console.log(`  Status: ${contrib.status}`);
      console.log(`  Due: ₹${contrib.compulsoryContributionDue}`);
      console.log(`  Paid: ₹${contrib.compulsoryContributionPaid}`);
      console.log(`  Late Fine: ₹${contrib.lateFineAmount}`);
      console.log(`  Late Fine Paid: ₹${contrib.lateFinePaid}`);
      console.log(`  Days Late: ${contrib.daysLate}`);
      console.log(`  Total Expected: ₹${contrib.minimumDueAmount}`);
      console.log(`  Total Paid: ₹${contrib.totalPaid}`);
      console.log(`  Remaining: ₹${contrib.remainingAmount}`);
    }

    // Check group member periodic records
    const memberPeriodicRecords = await prisma.groupMemberPeriodicRecord.findMany({
      include: {
        member: {
          include: {
            users: true
          }
        },
        groupPeriodicRecord: true
      }
    });

    console.log(`\nGroup Member Periodic Records: ${memberPeriodicRecords.length}`);
    
    for (const record of memberPeriodicRecords) {
      const userName = record.member.users?.[0]?.name || record.member.name;
      console.log(`\n${userName} (Periodic Record):`);
      console.log(`  Compulsory Contribution: ₹${record.compulsoryContribution || 0}`);
      console.log(`  Late Fine Paid: ₹${record.lateFinePaid || 0}`);
    }

  } catch (error) {
    console.error('Error checking contribution data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkContributionData();
