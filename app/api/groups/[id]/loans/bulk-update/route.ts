import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';

// Validation schema for bulk updating loans
const bulkUpdateLoanSchema = z.object({
  interestRate: z.number().min(0).optional(), // New interest rate to apply to all loans
  updateAllLoans: z.boolean().default(false), // Whether to update all active loans in the group
  specificUpdates: z.array(z.object({
    loanId: z.string(),
    currentBalance: z.number().min(0).optional(),
    interestRate: z.number().min(0).optional(),
    status: z.enum(["ACTIVE", "PAID", "DEFAULTED"]).optional(),
  })).optional(), // Specific updates for individual loans
});

// PUT /api/groups/{groupId}/loans/bulk-update
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Validate group existence
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = bulkUpdateLoanSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ 
        error: 'Invalid input data', 
        details: validation.error.format() 
      }, { status: 400 });
    }

    const { interestRate, updateAllLoans, specificUpdates } = validation.data;
    const results: Array<{
      type: string;
      count?: number;
      interestRate?: number;
      loanId?: string;
      memberName?: string;
      updates?: Record<string, unknown>;
    }> = [];

    // Use transaction for consistency
    await prisma.$transaction(async (tx) => {
      // Apply interest rate to all active loans if requested
      if (updateAllLoans && interestRate !== undefined) {
        const updatedLoans = await tx.loan.updateMany({
          where: {
            groupId: groupId,
            status: 'ACTIVE',
          },
          data: {
            interestRate: interestRate,
          },
        });
        
        results.push({
          type: 'bulk_interest_rate_update',
          count: updatedLoans.count,
          interestRate: interestRate,
        });
      }

      // Apply specific updates to individual loans
      if (specificUpdates && specificUpdates.length > 0) {
        for (const update of specificUpdates) {
          const { loanId, ...rawUpdateData } = update;
          
          // Verify loan belongs to the group
          const loan = await tx.loan.findUnique({
            where: { id: loanId },
            select: { id: true, groupId: true },
          });

          if (!loan || loan.groupId !== groupId) {
            throw new Error(`Loan ${loanId} not found or doesn't belong to group ${groupId}`);
          }

          // Create properly typed update data
          const updateData: Record<string, unknown> = {};
          if (rawUpdateData.status !== undefined) {
            updateData.status = rawUpdateData.status;
          }
          if (rawUpdateData.interestRate !== undefined) {
            updateData.interestRate = rawUpdateData.interestRate;
          }
          if (rawUpdateData.currentBalance !== undefined) {
            updateData.currentBalance = rawUpdateData.currentBalance;
          }

          const updatedLoan = await tx.loan.update({
            where: { id: loanId },
            data: updateData,
            include: {
              member: { select: { name: true } },
            },
          });

          results.push({
            type: 'individual_loan_update',
            loanId: loanId,
            memberName: updatedLoan.member.name,
            updates: updateData,
          });
        }
      }

      // Also update the group's interest rate if provided
      if (interestRate !== undefined) {
        await tx.group.update({
          where: { id: groupId },
          data: { interestRate: interestRate },
        });
        
        results.push({
          type: 'group_interest_rate_update',
          interestRate: interestRate,
        });
      }
    });

    return NextResponse.json({
      message: 'Bulk update completed successfully',
      results: results,
    });

  } catch (error) {
    console.error("Failed to bulk update loans:", error);
    return NextResponse.json({ 
      error: 'Failed to bulk update loans',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET /api/groups/{groupId}/loans/bulk-update
// Returns current loan summary for bulk operations
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    const loans = await prisma.loan.findMany({
      where: { groupId: groupId },
      include: {
        member: { select: { name: true } },
      },
      orderBy: [
        { status: 'asc' }, // Active loans first
        { member: { name: 'asc' } },
      ],
    });

    const summary = {
      totalLoans: loans.length,
      activeLoans: loans.filter(loan => loan.status === 'ACTIVE').length,
      totalOutstanding: loans
        .filter(loan => loan.status === 'ACTIVE')
        .reduce((sum, loan) => sum + loan.currentBalance, 0),
      averageInterestRate: loans.length > 0 
        ? loans.reduce((sum, loan) => sum + loan.interestRate, 0) / loans.length 
        : 0,
      loans: loans.map(loan => ({
        id: loan.id,
        memberName: loan.member.name,
        memberId: loan.memberId,
        originalAmount: loan.originalAmount,
        currentBalance: loan.currentBalance,
        interestRate: loan.interestRate,
        status: loan.status,
        loanType: loan.loanType,
      })),
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Failed to fetch loan summary:", error);
    return NextResponse.json({ error: 'Failed to fetch loan summary' }, { status: 500 });
  }
}
