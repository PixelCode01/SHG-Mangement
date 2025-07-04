const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickTest() {
  try {
    console.log('Testing database connection...');
    const userCount = await prisma.user.count();
    console.log(`✅ Database connected. User count: ${userCount}`);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

quickTest();
