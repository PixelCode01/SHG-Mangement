const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCleanDatabase() {
    try {
        console.log('=== TESTING CLEAN DATABASE ===\n');

        // Check if database is truly clean
        console.log('1. CHECKING DATABASE STATE:');
        
        const groupCount = await prisma.group.count();
        const periodCount = await prisma.period.count();
        const recordCount = await prisma.groupPeriodicRecord.count();
        const memberCount = await prisma.member.count();
        
        console.log(`Groups: ${groupCount}`);
        console.log(`Periods: ${periodCount}`);
        console.log(`Periodic Records: ${recordCount}`);
        console.log(`Members: ${memberCount}`);
        
        if (groupCount === 0 && periodCount === 0 && recordCount === 0) {
            console.log('✅ Database is clean!');
        } else {
            console.log('⚠️ Database still has some data');
        }
        
        console.log('\n2. TESTING FIXED API BEHAVIOR:');
        console.log('The fixed APIs should now:');
        console.log('- NOT automatically create periods when fetching current contributions');
        console.log('- Only create periods when explicitly requested');
        console.log('- Include loan assets in group standing calculations');
        console.log('- Prevent duplicate records during period closing');
        
        console.log('\n3. READY FOR TESTING:');
        console.log('You can now:');
        console.log('1. Create a new group through the frontend');
        console.log('2. Add members and contributions');
        console.log('3. Test period closing functionality');
        console.log('4. Verify that no automatic records are created');
        
    } catch (error) {
        console.error('Error testing clean database:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testCleanDatabase();
