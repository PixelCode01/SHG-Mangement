const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function listGroups() {
  try {
    console.log('=== LISTING ALL GROUPS ===\n');
    
    const groups = await prisma.group.findMany({
      include: {
        _count: {
          select: {
            memberships: true,
            loans: true
          }
        }
      }
    });

    if (groups.length === 0) {
      console.log('❌ No groups found in database');
      return;
    }

    groups.forEach((group, index) => {
      console.log(`${index + 1}. Group: ${group.name}`);
      console.log(`   ID: ${group.id}`);
      console.log(`   Members: ${group._count.memberships}`);
      console.log(`   Loans: ${group._count.loans}`);
      console.log(`   Cash in Bank: ₹${group.balanceInBank || 0}`);
      console.log(`   Cash in Hand: ₹${group.cashInHand || 0}`);
      console.log(`   Monthly Contribution: ₹${group.monthlyContribution || 0}`);
      console.log(`   Interest Rate: ${group.interestRate || 0}%`);
      console.log(`   Collection Frequency: ${group.collectionFrequency}\n`);
    });
    
  } catch (error) {
    console.error('❌ Error listing groups:', error);
  } finally {
    await prisma.$disconnect();
  }
}

listGroups();
