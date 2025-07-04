const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkGroupMembersAPI() {
  try {
    console.log('=== CHECKING GROUP MEMBERS API DATA ===');
    
    // This mimics what the group members page API would return
    const group = await prisma.group.findUnique({
      where: { id: '68381a2c05cb588247af871e' },
      include: {
        memberships: {
          include: {
            member: {
              select: {
                id: true,
                name: true,
                initialLoanAmount: true,
                createdAt: true
              }
            }
          },
          orderBy: {
            member: {
              name: 'asc'
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
    console.log(`   Total memberships: ${group.memberships.length}`);
    
    // Find ACHAL KUMAR OJHA specifically
    const achalMemberships = group.memberships.filter(m => 
      m.member.name.includes('ACHAL KUMAR OJHA')
    );
    
    console.log(`\n🔍 ACHAL KUMAR OJHA memberships found: ${achalMemberships.length}`);
    
    achalMemberships.forEach((membership, index) => {
      console.log(`\n  ${index + 1}. Member ID: ${membership.member.id}`);
      console.log(`     Name: ${membership.member.name}`);
      console.log(`     Initial Loan: ${membership.member.initialLoanAmount || 0}`);
      console.log(`     Created: ${membership.member.createdAt}`);
    });

    // Also check ANUP KUMAR KESHRI who you said shows 2,470,000
    const anupMemberships = group.memberships.filter(m => 
      m.member.name.includes('ANUP KUMAR KESHRI')
    );
    
    console.log(`\n🔍 ANUP KUMAR KESHRI memberships found: ${anupMemberships.length}`);
    
    anupMemberships.forEach((membership, index) => {
      console.log(`\n  ${index + 1}. Member ID: ${membership.member.id}`);
      console.log(`     Name: ${membership.member.name}`);
      console.log(`     Initial Loan: ${membership.member.initialLoanAmount || 0}`);
      console.log(`     Created: ${membership.member.createdAt}`);
    });

    // Show first few members for reference
    console.log(`\n📋 First 5 members with their initial amounts:`);
    group.memberships.slice(0, 5).forEach((membership, index) => {
      console.log(`  ${index + 1}. ${membership.member.name}: Loan ₹${membership.member.initialLoanAmount || 0}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkGroupMembersAPI();
