const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findCurrentGroup() {
    try {
        console.log('=== FINDING THE CORRECT GROUP ===\n');
        
        // Get all groups
        const allGroups = await prisma.group.findMany({
            select: {
                id: true,
                name: true,
                memberCount: true,
                leaderId: true
            }
        });
        
        console.log(`Found ${allGroups.length} groups total:\n`);
        allGroups.forEach((group, index) => {
            console.log(`Group ${index + 1}:`);
            console.log(`  ID: ${group.id}`);
            console.log(`  Name: ${group.name || 'Unnamed'}`);
            console.log(`  Member Count: ${group.memberCount || 'N/A'}`);
            console.log('---');
        });
        
        // Get all periodic records to find which group has our records
        console.log('\nLooking for groups with periodic records:\n');
        
        const allRecords = await prisma.groupPeriodicRecord.findMany({
            select: {
                id: true,
                groupId: true,
                meetingDate: true,
                recordSequenceNumber: true,
                totalGroupStandingAtEndOfPeriod: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        
        console.log(`Found ${allRecords.length} recent periodic records:\n`);
        
        allRecords.forEach((record, index) => {
            console.log(`Record ${index + 1}:`);
            console.log(`  ID: ${record.id}`);
            console.log(`  Group ID: ${record.groupId}`);
            console.log(`  Meeting Date: ${record.meetingDate ? record.meetingDate.toLocaleDateString() : 'N/A'}`);
            console.log(`  Sequence: ${record.recordSequenceNumber || 'N/A'}`);
            console.log(`  Group Standing: ₹${(record.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`  Created: ${record.createdAt.toLocaleDateString()}`);
            console.log('---');
        });
        
        // Look for the specific records we've been working with
        const ourRecords = await prisma.groupPeriodicRecord.findMany({
            where: {
                totalGroupStandingAtEndOfPeriod: 8019145
            },
            include: {
                group: {
                    select: {
                        id: true,
                        name: true,
                        memberships: {
                            select: {
                                id: true,
                                currentLoanAmount: true
                            }
                        }
                    }
                }
            }
        });
        
        console.log(`\nFound ${ourRecords.length} records with group standing ₹8,019,145:\n`);
        
        ourRecords.forEach((record, index) => {
            console.log(`Our Record ${index + 1}:`);
            console.log(`  Record ID: ${record.id}`);
            console.log(`  Group ID: ${record.groupId}`);
            console.log(`  Group Name: ${record.group?.name || 'Unnamed'}`);
            console.log(`  Meeting Date: ${record.meetingDate ? record.meetingDate.toLocaleDateString() : 'N/A'}`);
            console.log(`  Members: ${record.group?.memberships?.length || 0}`);
            
            if (record.group?.memberships) {
                const totalLoanAssets = record.group.memberships.reduce((total, membership) => {
                    return total + (membership.currentLoanAmount || 0);
                }, 0);
                console.log(`  Total Loan Assets: ₹${totalLoanAssets.toLocaleString()}`);
            }
            console.log('---');
        });

    } catch (error) {
        console.error('Error finding current group:', error);
    } finally {
        await prisma.$disconnect();
    }
}

findCurrentGroup();
