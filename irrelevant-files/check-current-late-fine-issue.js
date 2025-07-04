const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb+srv://gioneemaxuser:wtav1iRmGVa4TRuD@cluster0.ghljqux.mongodb.net/shg_management?retryWrites=true&w=majority&appName=Cluster0';

async function checkLateFineIssue() {
    const client = new MongoClient(MONGODB_URI);
    
    try {
        await client.connect();
        console.log('Connected to MongoDB Atlas');
        
        const db = client.db('shg_management');
        const groupId = new ObjectId('684a9bed1a17ec4cb2831dce');
        
        // 1. Check group details
        console.log('\n=== GROUP DETAILS ===');
        const group = await db.collection('groups').findOne({ _id: groupId });
        if (!group) {
            console.log('Group not found!');
            return;
        }
        
        console.log('Group Name:', group.name);
        console.log('Collection Schedule:', group.collectionSchedule);
        console.log('Late Fine Enabled:', group.lateFineEnabled);
        console.log('Late Fine Rule:', JSON.stringify(group.lateFineRule, null, 2));
        
        // 2. Check if tier rules exist for TIER_BASED late fine
        if (group.lateFineRule && group.lateFineRule.type === 'TIER_BASED') {
            console.log('\n=== TIER RULES CHECK ===');
            const lateFineRules = await db.collection('late-fine-rules').find({
                groupId: groupId,
                type: 'TIER_BASED'
            }).toArray();
            
            console.log('Number of tier rules found:', lateFineRules.length);
            if (lateFineRules.length > 0) {
                console.log('Tier Rules:');
                lateFineRules.forEach((rule, index) => {
                    console.log(`  Rule ${index + 1}:`, JSON.stringify(rule.tierRules, null, 4));
                });
            } else {
                console.log('❌ NO TIER RULES FOUND - This is the problem!');
            }
        }
        
        // 3. Check current period and contributions
        console.log('\n=== CURRENT PERIOD ===');
        const currentPeriod = await db.collection('periods').findOne({
            groupId: groupId,
            status: 'ACTIVE'
        });
        
        if (currentPeriod) {
            console.log('Current Period:', currentPeriod.name);
            console.log('Period ID:', currentPeriod._id);
            console.log('Collection Date:', currentPeriod.collectionDate);
            console.log('Due Date:', currentPeriod.dueDate);
            
            // Calculate days overdue
            const today = new Date();
            const dueDate = new Date(currentPeriod.dueDate);
            const daysOverdue = Math.max(0, Math.ceil((today - dueDate) / (1000 * 60 * 60 * 24)));
            console.log('Days overdue:', daysOverdue);
            
            // 4. Check periodic records for late fines
            console.log('\n=== PERIODIC RECORDS (SAMPLE) ===');
            const periodicRecords = await db.collection('periodic-records').find({
                groupId: groupId,
                periodId: currentPeriod._id
            }).limit(5).toArray();
            
            console.log(`Found ${periodicRecords.length} periodic records`);
            periodicRecords.forEach((record, index) => {
                console.log(`  Record ${index + 1}:`);
                console.log(`    Member ID: ${record.memberId}`);
                console.log(`    Contribution: ₹${record.contribution || 0}`);
                console.log(`    Late Fine: ₹${record.lateFine || 0}`);
                console.log(`    Status: ${record.status || 'N/A'}`);
            });
        } else {
            console.log('No active period found');
        }
        
        // 5. Check members
        console.log('\n=== GROUP MEMBERS ===');
        const members = await db.collection('members').find({ groupId: groupId }).toArray();
        console.log(`Group has ${members.length} members`);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.close();
    }
}

checkLateFineIssue();
