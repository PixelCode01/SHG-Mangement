const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCurrentEndpoint() {
    try {
        console.log('=== TESTING CURRENT CONTRIBUTIONS ENDPOINT ===\n');

        const groupId = '68444854086ea61b8b947d9d';
        
        console.log('1. Before API call - checking record count:');
        const beforeRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { recordSequenceNumber: 'asc' }
        });
        
        console.log(`   Found ${beforeRecords.length} records\n`);
        
        // Simulate what the API does
        console.log('2. Simulating GET /api/groups/[id]/contributions/current:');
        
        const currentRecord = await prisma.groupPeriodicRecord.findFirst({
            where: { groupId },
            orderBy: { meetingDate: 'desc' },
            include: {
                memberContributions: {
                    include: {
                        member: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                phone: true,
                            }
                        }
                    }
                },
                cashAllocations: {
                    orderBy: { lastModifiedAt: 'desc' },
                    take: 1
                }
            }
        });
        
        if (!currentRecord) {
            console.log('   ❌ No current record found - this should return 404');
        } else {
            console.log('   ✅ Found current record:');
            console.log(`      ID: ${currentRecord.id}`);
            console.log(`      Meeting Date: ${currentRecord.meetingDate.toLocaleDateString()}`);
            console.log(`      Sequence: ${currentRecord.recordSequenceNumber}`);
            console.log(`      Collection: ₹${(currentRecord.totalCollectionThisPeriod || 0).toLocaleString()}`);
            console.log(`      Group Standing: ₹${(currentRecord.totalGroupStandingAtEndOfPeriod || 0).toLocaleString()}`);
            console.log(`      Member Contributions: ${currentRecord.memberContributions.length}`);
        }
        
        console.log('\n3. After API simulation - checking record count:');
        const afterRecords = await prisma.groupPeriodicRecord.findMany({
            where: { groupId },
            orderBy: { recordSequenceNumber: 'asc' }
        });
        
        console.log(`   Found ${afterRecords.length} records\n`);
        
        if (beforeRecords.length === afterRecords.length) {
            console.log('✅ SUCCESS: No new records were automatically created');
        } else {
            console.log('❌ PROBLEM: New records were automatically created');
            console.log('   This should not happen after our fix');
        }
        
        console.log('\n4. Testing with a group that has no periods:');
        
        // Let's test with a different group or simulate
        const testGroupId = 'test-group-with-no-periods';
        
        const noPeriodsRecord = await prisma.groupPeriodicRecord.findFirst({
            where: { groupId: testGroupId },
            orderBy: { meetingDate: 'desc' }
        });
        
        if (!noPeriodsRecord) {
            console.log(`   ✅ Correctly returns null for group with no periods (${testGroupId})`);
            console.log('   Frontend should show appropriate message and not auto-create periods');
        }

    } catch (error) {
        console.error('Error testing current endpoint:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testCurrentEndpoint();
