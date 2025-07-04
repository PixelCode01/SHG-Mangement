// /app/api/groups/[id]/bank-transactions/[transactionId]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';

const bankTransactionUpdateSchema = z.object({
  transactionDate: z.string().datetime({ message: "Invalid date format" }).optional(),
  particulars: z.string().min(1, { message: "Particulars are required" }).optional(),
  amount: z.number().optional(),
  remainingBalance: z.number().optional(),
});

// GET /api/groups/{groupId}/bank-transactions/{transactionId}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id: groupId, transactionId } = await params;
  if (!groupId || !transactionId) {
    return NextResponse.json({ error: 'Group ID and Transaction ID are required' }, { status: 400 });
  }

  try {
    const transaction = await prisma.bankTransaction.findUnique({
      where: {
        id: transactionId,
        groupId: groupId,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Failed to fetch bank transaction:", error);
    return NextResponse.json({ error: 'Failed to fetch bank transaction' }, { status: 500 });
  }
}

// PUT /api/groups/{groupId}/bank-transactions/{transactionId}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id: groupId, transactionId } = await params;
  if (!groupId || !transactionId) {
    return NextResponse.json({ error: 'Group ID and Transaction ID are required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validation = bankTransactionUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validation.error.errors }, { status: 400 });
    }

    // Create properly typed update data with Date conversion
    const updateData: Record<string, unknown> = {};
    
    if (validation.data.transactionDate) {
      updateData.transactionDate = new Date(validation.data.transactionDate);
    }
    if (validation.data.particulars !== undefined) {
      updateData.particulars = validation.data.particulars;
    }
    if (validation.data.amount !== undefined) {
      updateData.amount = validation.data.amount;
    }
    if (validation.data.remainingBalance !== undefined) {
      updateData.remainingBalance = validation.data.remainingBalance;
    }

    const updatedTransaction = await prisma.bankTransaction.update({
      where: {
        id: transactionId,
        groupId: groupId, // Ensure the transaction belongs to the group
      },
      data: updateData,
    });

    return NextResponse.json(updatedTransaction);
  } catch (error) {
    const typedError = error as Error & { code?: string };
    console.error("Failed to update bank transaction:", typedError);
    if (typedError.code === 'P2025') { // Prisma error code for record not found for update
        return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to update bank transaction' }, { status: 500 });
  }
}

// DELETE /api/groups/{groupId}/bank-transactions/{transactionId}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id: groupId, transactionId } = await params;
  if (!groupId || !transactionId) {
    return NextResponse.json({ error: 'Group ID and Transaction ID are required' }, { status: 400 });
  }

  try {
    await prisma.bankTransaction.delete({
      where: {
        id: transactionId,
        groupId: groupId, // Ensure the transaction belongs to the group
      },
    });

    return NextResponse.json({ message: 'Bank transaction deleted successfully' }, { status: 200 });
  } catch (error) {
    const typedError = error as Error & { code?: string };
    console.error("Failed to delete bank transaction:", typedError);
    if (typedError.code === 'P2025') { // Prisma error code for record not found for delete
        return NextResponse.json({ error: 'Bank transaction not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete bank transaction' }, { status: 500 });
  }
}
