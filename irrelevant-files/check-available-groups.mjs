/**
 * Check available groups in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAvailableGroups() {
  console.log('🔍 CHECKING AVAILABLE GROUPS IN DATABASE');
  console.log('=========================================\n');

  try {
    const groups = await prisma.group.findMany({
      select: {
        id: true,
        name: true,
        cashInHand: true,
        balanceInBank: true,
        memberships: {
          select: {
            member: {
              select: {
                name: true
              }
            },
            initialLoanAmount: true
          }
        }
      }
    });

    console.log(`Found ${groups.length} groups:\n`);
    
    groups.forEach((group, index) => {
      console.log(`${index + 1}. "${group.name}" (ID: ${group.id})`);
      console.log(`   Cash in Hand: ₹${group.cashInHand || 0}`);
      console.log(`   Balance in Bank: ₹${group.balanceInBank || 0}`);
      console.log(`   Members: ${group.memberships.length}`);
      
      let totalInitialLoans = 0;
      group.memberships.forEach(membership => {
        totalInitialLoans += membership.initialLoanAmount || 0;
        console.log(`     - ${membership.member.name}: ₹${membership.initialLoanAmount || 0} initial loan`);
      });
      
      console.log(`   Total Initial Loan Amounts: ₹${totalInitialLoans}`);
      console.log('');
    });

    if (groups.length === 0) {
      console.log('❌ No groups found in database');
      console.log('\n💡 You may need to create test data first');
    } else {
      console.log('✅ Groups found. Choose one for testing periodic records.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAvailableGroups();
