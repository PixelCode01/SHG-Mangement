console.log('Starting simple test...');

const { PrismaClient } = require('@prisma/client');

async function test() {
  console.log('Creating Prisma client...');
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing connection...');
    const count = await prisma.group.count();
    console.log(`Total groups: ${count}`);
    
    console.log('Fetching first group...');
    const firstGroup = await prisma.group.findFirst({
      select: {
        id: true,
        name: true,
        cashInHand: true,
        balanceInBank: true,
        monthlyContribution: true,
        interestRate: true,
      }
    });
    
    console.log('First group:', firstGroup);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test().catch(console.error);
