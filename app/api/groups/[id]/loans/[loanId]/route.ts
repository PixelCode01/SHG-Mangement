import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';

// Validation schema for updating a Loan
// Allow updating status, grantorInfo, currentBalance, and interestRate for loan management
const updateLoanSchema = z.object({
  status: z.enum(["ACTIVE", "PAID", "DEFAULTED"]).optional(),
  grantorInfo: z.string().optional().nullable(),
  currentBalance: z.number().min(0).optional(), // Allow updating current balance
  interestRate: z.number().min(0).optional(), // Allow updating interest rate
  originalAmount: z.number().positive().optional(), // Allow updating original amount if needed
});

// GET /api/groups/{groupId}/loans/{loanId}
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; loanId: string }> }
) {
  const { id: groupId, loanId } = await params;
  if (!groupId || !loanId) {
    return NextResponse.json({ error: 'Group ID and Loan ID are required' }, { status: 400 });
  }

  try {
    const loan = await prisma.loan.findUnique({
      where: {
        id: loanId,
        groupId: groupId, // Ensure the loan belongs to the specified group
      },
      include: {
        member: { // Include member name
          select: { name: true }
        },
        payments: { // Include payment history
          orderBy: { paymentDate: 'asc' }
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    return NextResponse.json(loan);
  } catch (error) {
    console.error("Failed to fetch loan:", error);
    return NextResponse.json({ error: 'Failed to fetch loan' }, { status: 500 });
  }
}

// PUT /api/groups/{groupId}/loans/{loanId}
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; loanId: string }> }
) {
  const { id: groupId, loanId } = await params;
  if (!groupId || !loanId) {
    return NextResponse.json({ error: 'Group ID and Loan ID are required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validation = updateLoanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validation.error.errors }, { status: 400 });
    }

    // Create properly typed update data
    const updateData: Record<string, unknown> = {};
    
    if (validation.data.status !== undefined) {
      updateData.status = validation.data.status;
    }
    if (validation.data.grantorInfo !== undefined) {
      updateData.grantorInfo = validation.data.grantorInfo;
    }
    if (validation.data.currentBalance !== undefined) {
      updateData.currentBalance = validation.data.currentBalance;
    }
    if (validation.data.interestRate !== undefined) {
      updateData.interestRate = validation.data.interestRate;
    }
    if (validation.data.originalAmount !== undefined) {
      updateData.originalAmount = validation.data.originalAmount;
    }

    // Check if loan exists before attempting update
    const existingLoan = await prisma.loan.findUnique({
        where: { id: loanId, groupId: groupId },
        select: { id: true } // Only need id for existence check
    });

    if (!existingLoan) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const updatedLoan = await prisma.loan.update({
      where: {
        id: loanId,
      },
      data: updateData,
      include: { // Return updated loan with member and payments
        member: { select: { name: true } },
        payments: { orderBy: { paymentDate: 'asc' } },
      },
    });

    return NextResponse.json(updatedLoan);
  } catch (error) {
    console.error("Failed to update loan:", error);
    return NextResponse.json({ error: 'Failed to update loan' }, { status: 500 });
  }
}

// DELETE /api/groups/{groupId}/loans/{loanId}
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; loanId: string }> }
) {
  const { id: groupId, loanId } = await params;
  if (!groupId || !loanId) {
    return NextResponse.json({ error: 'Group ID and Loan ID are required' }, { status: 400 });
  }

  try {
    // Use transaction to delete the Loan and its associated LoanPayments
    await prisma.$transaction(async (tx) => {
      // Check if loan exists first
      const loan = await tx.loan.findUnique({
        where: { id: loanId, groupId: groupId },
        select: { id: true } // Only select id for existence check
      });

      if (!loan) {
        // Throw an error to abort the transaction and trigger the catch block
        throw new Error('LoanNotFound');
      }

      // 1. Delete associated LoanPayments
      await tx.loanPayment.deleteMany({
        where: { loanId: loanId },
      });

      // 2. Delete the Loan itself
      await tx.loan.delete({
        where: { id: loanId },
      });
    });

    return NextResponse.json({ message: 'Loan deleted successfully' }, { status: 200 });

  } catch (error) {
    const typedError = error as Error;
    console.error("Failed to delete loan:", typedError);
    if (typedError.message === 'LoanNotFound') {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Failed to delete loan' }, { status: 500 });
  }
}
