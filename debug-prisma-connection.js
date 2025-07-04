#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing Prisma connection...');
    
    // Test basic connection
    const groupCount = await prisma.group.count();
    console.log(`Found ${groupCount} groups in database`);
    
    // Test if the new fields exist
    const sampleGroup = await prisma.group.findFirst({
      select: {
        id: true,
        name: true,
        groupSocialEnabled: true,
        groupSocialAmountPerFamilyMember: true,
        loanInsuranceEnabled: true,
        loanInsurancePercent: true
      }
    });
    
    console.log('Sample group data:', sampleGroup);
    
    // Test member schema
    const memberCount = await prisma.member.count();
    console.log(`Found ${memberCount} members in database`);
    
    const sampleMember = await prisma.member.findFirst({
      select: {
        id: true,
        name: true,
        familyMembersCount: true
      }
    });
    
    console.log('Sample member data:', sampleMember);
    
    console.log('✅ Database connection and schema test successful!');
    
  } catch (error) {
    console.error('❌ Database connection or schema error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection().catch(console.error);
