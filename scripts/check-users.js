// Simple script to check users in the database
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database check...');
  
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected to database.');
    
    console.log('Fetching users...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });
    
    console.log('Users in database:');
    console.log(users);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
    console.log('Database connection closed.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => process.exit());
