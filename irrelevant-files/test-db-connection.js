#!/usr/bin/env node

/**
 * Simple test to check database connection and find the issue
 */

const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  
  console.log('🔍 Testing MongoDB Atlas connection...');
  console.log(`Database URL: ${process.env.DATABASE_URL ? 'Found' : 'Missing'}`);
  
  try {
    // Simple test - try to find any group
    const groupCount = await prisma.group.count();
    console.log(`✅ Connection successful! Found ${groupCount} groups`);
    
    // Try to find "sa" group specifically
    const saGroup = await prisma.group.findFirst({
      where: { name: 'sa' },
      select: { 
        id: true, 
        name: true, 
        collectionFrequency: true,
        collectionDayOfMonth: true,
        monthlyContribution: true
      }
    });
    
    if (saGroup) {
      console.log(`✅ Found "sa" group: ${saGroup.id}`);
      console.log(`   Collection: ${saGroup.collectionFrequency} on ${saGroup.collectionDayOfMonth}th`);
      console.log(`   Monthly Contribution: ₹${saGroup.monthlyContribution}`);
    } else {
      console.log('❌ "sa" group not found');
    }
    
    // Check late fine rules
    const lateFineCount = await prisma.lateFineRule.count();
    console.log(`📊 Found ${lateFineCount} late fine rules total`);
    
    const tierCount = await prisma.lateFineRuleTier.count();
    console.log(`📊 Found ${tierCount} tier rules total`);
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('   Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
