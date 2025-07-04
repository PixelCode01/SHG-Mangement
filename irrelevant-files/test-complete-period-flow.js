const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'shg_management';

async function testCompletePeriodFlow() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);

    const groupsCollection = db.collection('Group');
    const periodsCollection = db.collection('Period');
    const contributionsCollection = db.collection('Contribution');
    const periodicRecordsCollection = db.collection('PeriodicRecord');

    try {
        console.log('=== Testing Complete Period Closure and New Period Creation Flow ===\n');

        // Get the test group
        const group = await groupsCollection.findOne({ name: 'fds' });
        if (!group) {
            console.log('❌ Test group "fds" not found');
            return;
        }
        console.log(`📊 Testing with group: ${group.name} (ID: ${group._id})`);

        // Check current periods
        const currentPeriods = await periodsCollection.find({ groupId: group._id }).sort({ periodNumber: 1 }).toArray();
        console.log(`\n📅 Current Periods: ${currentPeriods.length}`);
        
        for (const period of currentPeriods) {
            const statusEmoji = period.status === 'open' ? '🔓' : '🔒';
            console.log(`   ${statusEmoji} Period #${period.periodNumber} [${period.status.toUpperCase()}]`);
            console.log(`      - Meeting Date: ${new Date(period.meetingDate).toLocaleDateString()}`);
            console.log(`      - Total Collection: ₹${period.totalCollectionThisPeriod?.toFixed(2) || '0.00'}`);
            console.log(`      - Created: ${new Date(period.createdAt).toLocaleString()}`);
        }

        // Find the current open period
        const openPeriod = currentPeriods.find(p => p.status === 'open');
        if (!openPeriod) {
            console.log('\n❌ No open period found to test with');
            return;
        }

        console.log(`\n🎯 Testing with open period #${openPeriod.periodNumber}`);

        // Check contributions for the open period
        const contributions = await contributionsCollection.find({ 
            groupId: group._id, 
            periodId: openPeriod._id 
        }).toArray();
        
        console.log(`\n💰 Current contributions in period #${openPeriod.periodNumber}: ${contributions.length}`);
        
        // If no contributions, add some test contributions
        if (contributions.length === 0) {
            console.log('   ➕ Adding test contributions for testing...');
            
            const members = group.members || [];
            for (let i = 0; i < Math.min(3, members.length); i++) {
                const member = members[i];
                await contributionsCollection.insertOne({
                    groupId: group._id,
                    periodId: openPeriod._id,
                    memberId: member._id,
                    memberName: member.name,
                    amount: 500,
                    status: 'paid',
                    isLateFine: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            
            // Update period total
            await periodsCollection.updateOne(
                { _id: openPeriod._id },
                { 
                    $set: { 
                        totalCollectionThisPeriod: 1500,
                        updatedAt: new Date()
                    }
                }
            );
            
            console.log('   ✅ Added 3 test contributions (₹500 each, total ₹1500)');
        } else {
            const totalContributions = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
            console.log(`   💵 Total contributions: ₹${totalContributions}`);
        }

        // Now test the closure process
        console.log(`\n🔄 Testing Period Closure Process for period #${openPeriod.periodNumber}...`);

        // Simulate the API call to close the period
        console.log('   1. Simulating period closure...');
        
        // First, check if this is a real period (has contributions or totalCollectionThisPeriod > 0 or === null)
        const updatedPeriod = await periodsCollection.findOne({ _id: openPeriod._id });
        const isAutoCreated = updatedPeriod.totalCollectionThisPeriod === null;
        
        console.log(`   📊 Period #${openPeriod.periodNumber} analysis:`);
        console.log(`      - Total Collection: ${updatedPeriod.totalCollectionThisPeriod}`);
        console.log(`      - Is Auto-Created: ${isAutoCreated}`);
        console.log(`      - Should create new period after closure: ${!isAutoCreated}`);

        // Close the period
        await periodsCollection.updateOne(
            { _id: openPeriod._id },
            { 
                $set: { 
                    status: 'closed',
                    closedAt: new Date(),
                    updatedAt: new Date()
                }
            }
        );

        console.log('   ✅ Period marked as closed');

        // Create periodic record
        const periodicRecord = {
            groupId: group._id,
            periodId: openPeriod._id,
            periodNumber: openPeriod.periodNumber,
            meetingDate: updatedPeriod.meetingDate,
            totalCollection: updatedPeriod.totalCollectionThisPeriod || 0,
            contributions: contributions,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        await periodicRecordsCollection.insertOne(periodicRecord);
        console.log('   ✅ Periodic record created');

        // If this was a real period (not auto-created), create a new period
        if (!isAutoCreated) {
            console.log('   2. Creating new period (since closed period was real)...');
            
            const nextPeriodNumber = openPeriod.periodNumber + 1;
            const nextMeetingDate = new Date(updatedPeriod.meetingDate);
            nextMeetingDate.setDate(nextMeetingDate.getDate() + 7); // Add 7 days
            
            const newPeriod = {
                groupId: group._id,
                periodNumber: nextPeriodNumber,
                meetingDate: nextMeetingDate,
                status: 'open',
                totalCollectionThisPeriod: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            };

            const result = await periodsCollection.insertOne(newPeriod);
            console.log(`   ✅ New period #${nextPeriodNumber} created with ID: ${result.insertedId}`);
            
            // Create initial contribution records for all members
            const members = group.members || [];
            const newContributions = members.map(member => ({
                groupId: group._id,
                periodId: result.insertedId,
                memberId: member._id,
                memberName: member.name,
                amount: 0,
                status: 'pending',
                isLateFine: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }));

            if (newContributions.length > 0) {
                await contributionsCollection.insertMany(newContributions);
                console.log(`   ✅ Created ${newContributions.length} initial contribution records`);
            }
        } else {
            console.log('   2. ⏭️  Skipping new period creation (closed period was auto-created)');
        }

        // Verify final state
        console.log('\n🔍 Final Verification:');
        const finalPeriods = await periodsCollection.find({ groupId: group._id }).sort({ periodNumber: 1 }).toArray();
        console.log(`   📅 Total periods now: ${finalPeriods.length}`);
        
        for (const period of finalPeriods) {
            const statusEmoji = period.status === 'open' ? '🔓' : '🔒';
            console.log(`   ${statusEmoji} Period #${period.periodNumber} [${period.status.toUpperCase()}]`);
            console.log(`      - Meeting Date: ${new Date(period.meetingDate).toLocaleDateString()}`);
            console.log(`      - Total Collection: ₹${period.totalCollectionThisPeriod?.toFixed(2) || '0.00'}`);
        }

        const openPeriods = finalPeriods.filter(p => p.status === 'open');
        console.log(`\n✅ Open periods: ${openPeriods.length}`);
        
        if (openPeriods.length === 1) {
            const newOpenPeriod = openPeriods[0];
            const newContributions = await contributionsCollection.find({ 
                groupId: group._id, 
                periodId: newOpenPeriod._id 
            }).toArray();
            
            console.log(`   🎯 New open period #${newOpenPeriod.periodNumber} has ${newContributions.length} contribution records`);
            console.log('   ✅ System is ready to track contributions for the new period');
        }

        // Check periodic records
        const allRecords = await periodicRecordsCollection.find({ groupId: group._id }).sort({ periodNumber: 1 }).toArray();
        console.log(`\n📝 Periodic records: ${allRecords.length}`);
        for (const record of allRecords) {
            console.log(`   📊 Record for period #${record.periodNumber}: ₹${record.totalCollection} collected`);
        }

        console.log('\n🎉 Complete period closure and new period creation flow test completed!');

    } catch (error) {
        console.error('❌ Error during test:', error);
    } finally {
        await client.close();
    }
}

testCompletePeriodFlow().catch(console.error);
