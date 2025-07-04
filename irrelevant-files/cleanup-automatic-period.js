const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupAutomaticPeriod() {
    try {
        // Delete the automatically created period
        const deleted = await prisma.groupPeriodicRecord.deleteMany({
            where: {
                groupId: '6843c8015e7efe4ba8191ca6',
                recordSequenceNumber: 1
            }
        });
        
        console.log('Deleted automatic period records:', deleted.count);
        
        // Verify no periods exist now
        const remainingPeriods = await prisma.groupPeriodicRecord.findMany({
            where: {
                groupId: '6843c8015e7efe4ba8191ca6'
            }
        });
        
        console.log('Remaining periods:', remainingPeriods.length);
        
    } catch (error) {
        console.error('Error cleaning up period:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanupAutomaticPeriod();
