import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@/app/lib/auth-config';

const prisma = new PrismaClient();

// POST: Create or update cash allocation
export async function POST(
  request: NextRequest,
  _params: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // const _groupId = params.id; // Not needed for this endpoint
    const body = await request.json();
    
    const {
      groupPeriodicRecordId,
      allocationType,
      amountToBankTransfer,
      amountToCashInHand,
      customAllocationNote,
      totalAllocated
    } = body;

    // Check if allocation already exists for this period
    const existingAllocation = await prisma.cashAllocation.findFirst({
      where: { groupPeriodicRecordId }
    });

    let allocation;
    
    if (existingAllocation && !existingAllocation.isTransactionClosed) {
      // Update existing allocation if not closed
      allocation = await prisma.cashAllocation.update({
        where: { id: existingAllocation.id },
        data: {
          allocationType,
          amountToBankTransfer: amountToBankTransfer || 0,
          amountToCashInHand: amountToCashInHand || 0,
          customAllocationNote,
          totalAllocated,
          lastModifiedAt: new Date(),
          lastModifiedBy: session.user.id,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new allocation
      allocation = await prisma.cashAllocation.create({
        data: {
          groupPeriodicRecordId,
          allocationType,
          amountToBankTransfer: amountToBankTransfer || 0,
          amountToCashInHand: amountToCashInHand || 0,
          customAllocationNote,
          totalAllocated,
          lastModifiedAt: new Date(),
          lastModifiedBy: session.user.id,
        }
      });
    }

    return NextResponse.json({ allocation });
  } catch (error) {
    console.error('Error creating/updating cash allocation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Close transaction
export async function PATCH(
  request: NextRequest,
  _params: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { allocationId, carryForwardAmount } = body;

    // Close the transaction
    const closedAllocation = await prisma.cashAllocation.update({
      where: { id: allocationId },
      data: {
        isTransactionClosed: true,
        transactionClosedAt: new Date(),
        transactionClosedBy: session.user.id,
        carryForwardAmount: carryForwardAmount || 0,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ allocation: closedAllocation });
  } catch (error) {
    console.error('Error closing transaction:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
