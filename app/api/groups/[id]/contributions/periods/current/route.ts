import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';

const prisma = new PrismaClient();

// Helper function to calculate period end date based on collection frequency
function calculateEndDate(startDate: Date, periodType: string): Date {
  const start = new Date(startDate);
  switch (periodType) {
    case 'WEEKLY':
      start.setDate(start.getDate() + 7);
      break;
    case 'FORTNIGHTLY':
      start.setDate(start.getDate() + 14);
      break;
    case 'MONTHLY':
      start.setMonth(start.getMonth() + 1);
      break;
    case 'YEARLY':
      start.setFullYear(start.getFullYear() + 1);
      break;
    default:
      start.setMonth(start.getMonth() + 1); // Default to monthly
  }
  // Set to end of previous day to show proper period range
  start.setDate(start.getDate() - 1);
  return start;
}

// GET: Get current active period information
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const awaitedParams = await params;
    const groupId = awaitedParams.id;

    console.log(`🔍 [Current Period API] Looking for current period for group: ${groupId}`);

    // Get the current date to determine what period we should be in
    const today = new Date();
    const currentMonth = today.getMonth(); // 0-based: June=5, July=6, August=7
    const currentYear = today.getFullYear();
    
    console.log(`📅 [Current Period API] Today: ${today.toDateString()} (Month: ${currentMonth}, Year: ${currentYear})`);

    // First, try to find a period for the current month that's open
    let currentPeriod = await prisma.groupPeriodicRecord.findFirst({
      where: { 
        groupId,
        meetingDate: {
          gte: new Date(currentYear, currentMonth, 1), // Start of current month
          lt: new Date(currentYear, currentMonth + 1, 1) // Start of next month
        },
        OR: [
          { totalCollectionThisPeriod: null },
          { totalCollectionThisPeriod: 0 }
        ]
      },
      orderBy: [
        { meetingDate: 'desc' },
        { recordSequenceNumber: 'desc' }
      ],
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
        }
      }
    });

    console.log(`🔍 [Current Period API] Current month period found: ${currentPeriod ? 'YES' : 'NO'}`);
    if (currentPeriod) {
      console.log(`   - ID: ${currentPeriod.id}`);
      console.log(`   - Meeting Date: ${currentPeriod.meetingDate}`);
      console.log(`   - Sequence: ${currentPeriod.recordSequenceNumber}`);
      console.log(`   - Collection: ₹${currentPeriod.totalCollectionThisPeriod}`);
    }

    // If no current month period found, look for the most recent open period from any month
    if (!currentPeriod) {
      console.log(`📅 [Current Period API] No current month period found, looking for any open period...`);
      
      currentPeriod = await prisma.groupPeriodicRecord.findFirst({
        where: { 
          groupId,
          OR: [
            { totalCollectionThisPeriod: null },
            { totalCollectionThisPeriod: 0 }
          ]
        },
        orderBy: [
          { recordSequenceNumber: 'desc' },
          { meetingDate: 'desc' }
        ],
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
          }
        }
      });

      if (currentPeriod) {
        console.log(`✅ [Current Period API] Found open period from different month: ${currentPeriod.id}`);
        console.log(`   - Meeting Date: ${currentPeriod.meetingDate}`);
        console.log(`   - Sequence: ${currentPeriod.recordSequenceNumber}`);
      }
    }

    // If no open period found anywhere, we need to create one
    if (!currentPeriod) {
      console.log(`📅 [Current Period API] No open periods found, creating one for ${currentMonth}/${currentYear}...`);
      
      // Get the group to access collection frequency and period configuration
      const group = await prisma.group.findUnique({
        where: { id: groupId },
        select: { 
          collectionFrequency: true,
          dateOfStarting: true,
          currentPeriodMonth: true,
          currentPeriodYear: true
        }
      });

      if (!group) {
        return NextResponse.json({
          success: false,
          error: 'Group not found'
        }, { status: 404 });
      }

      // Get the latest period to determine what the next sequence should be
      const latestPeriod = await prisma.groupPeriodicRecord.findFirst({
        where: { groupId },
        orderBy: [
          { recordSequenceNumber: 'desc' },
          { meetingDate: 'desc' }
        ]
      });

      console.log(`📋 [Current Period API] Latest period: ${latestPeriod ? 'YES' : 'NO'}`);
      if (latestPeriod) {
        console.log(`   - Meeting Date: ${latestPeriod.meetingDate}`);
        console.log(`   - Sequence: ${latestPeriod.recordSequenceNumber}`);
      }

      // Use group's configured period if available, otherwise use current month
      let periodMonth = currentMonth;
      let periodYear = currentYear;
      
      if (group?.currentPeriodMonth && group?.currentPeriodYear) {
        periodMonth = group.currentPeriodMonth - 1; // Convert to 0-based month index
        periodYear = group.currentPeriodYear;
        console.log(`📅 [Current Period API] Using group's configured period: ${group.currentPeriodMonth}/${group.currentPeriodYear}`);
      } else {
        console.log(`📅 [Current Period API] Using current calendar month: ${currentMonth + 1}/${currentYear}`);
      }

      // Calculate the current period date (10th of determined month/year)
      const currentPeriodDate = new Date(periodYear, periodMonth, 10);
      
      console.log(`📅 [Current Period API] Creating period for: ${currentPeriodDate.toDateString()}`);
      
      // Create the new current period
      try {
        const nextSequence = (latestPeriod?.recordSequenceNumber || 0) + 1;
        
        console.log(`➕ [Current Period API] Creating new period, sequence: ${nextSequence}`);
        
        currentPeriod = await prisma.groupPeriodicRecord.create({
          data: {
            groupId,
            meetingDate: currentPeriodDate,
            recordSequenceNumber: nextSequence,
            totalCollectionThisPeriod: null, // Mark as open
            interestEarnedThisPeriod: null,
            lateFinesCollectedThisPeriod: null,
            newContributionsThisPeriod: null,
            totalGroupStandingAtEndOfPeriod: 0
          },
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
            }
          }
        });
        
        console.log(`✅ [Current Period API] Created new period: ${currentPeriod.id}`);
        
      } catch (error) {
        console.error(`❌ [Current Period API] Error creating period:`, error);
        return NextResponse.json({
          success: false,
          error: 'Failed to create current period'
        }, { status: 500 });
      }
    }

    if (!currentPeriod) {
      return NextResponse.json({
        success: true,
        period: null,
        message: 'No current period found and unable to create one.'
      });
    }

    // Get the group to access collection frequency
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { collectionFrequency: true }
    });

    // Determine if the period is closed 
    // A period is closed if it has been finalized (has closing data set)
    // We check for totalCollectionThisPeriod !== null, as null indicates an open period
    const isClosed = currentPeriod.totalCollectionThisPeriod !== null;

    const periodType = group?.collectionFrequency || 'MONTHLY';
    const endDate = calculateEndDate(currentPeriod.meetingDate, periodType);

    const result = {
      id: currentPeriod.id,
      startDate: currentPeriod.meetingDate,
      endDate: endDate,
      isClosed,
      periodNumber: currentPeriod.recordSequenceNumber || 1,
      periodType: periodType
    };

    console.log(`✅ [Current Period API] Returning period:`);
    console.log(`   - ID: ${result.id}`);
    console.log(`   - Start Date: ${result.startDate}`);
    console.log(`   - Period Number: ${result.periodNumber}`);
    console.log(`   - Is Closed: ${result.isClosed}`);
    console.log(`   - Period Type: ${result.periodType}`);
    
    const periodDate = new Date(result.startDate);
    const monthYear = periodDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    console.log(`   - Frontend Display: "${monthYear}"`);

    return NextResponse.json({
      success: true,
      period: result
    });
  } catch (error) {
    console.error('Error fetching current period:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current period' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
