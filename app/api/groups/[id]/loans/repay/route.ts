import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, canEditGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('🏦 API LOAN REPAY: Request received');
    
    // Use authMiddleware for authentication
    const authResult = await authMiddleware(request);
    if ('json' in authResult) {
      console.log('❌ API LOAN REPAY: Authentication failed');
      return authResult;
    }
    
    const { session } = authResult;
    const { id: groupId } = await params;
    
    console.log('🔐 API LOAN REPAY: Authentication successful:', {
      userId: session.user.id,
      groupId: groupId
    });
    
    // Check if user can edit this group
    const canEdit = await canEditGroup(session.user.id!, groupId);
    if (!canEdit) {
      console.log('❌ API LOAN REPAY: User lacks edit permissions');
      return NextResponse.json(
        { error: 'Only group leaders can process loan repayments' },
        { status: 403 }
      );
    }

    const requestBody = await request.json();
    console.log('📋 API LOAN REPAY: Request body received:', requestBody);
    
    const { loanId, memberId, amount } = requestBody;

    console.log('🔍 API LOAN REPAY: Input validation:', {
      loanId: loanId,
      memberId: memberId,
      amount: amount,
      amountType: typeof amount,
      hasLoanId: !!loanId,
      hasMemberId: !!memberId,
      isValidAmount: typeof amount === 'number' && amount > 0
    });

    // Validate input - accept either loanId or memberId
    if ((!loanId && !memberId) || typeof amount !== 'number' || amount <= 0) {
      console.log('❌ API LOAN REPAY: Input validation failed');
      return NextResponse.json(
        { error: 'Loan ID or Member ID and positive amount are required' },
        { status: 400 }
      );
    }

    // Get the loan - either by loanId or by memberId (find active loan)
    let loan;
    console.log('🔍 API LOAN REPAY: Starting loan lookup...');
    
    if (loanId) {
      console.log('🆔 API LOAN REPAY: Looking up loan by loanId:', loanId);
      loan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: {
          member: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });
      console.log('📊 API LOAN REPAY: Loan lookup by ID result:', loan ? {
        id: loan.id,
        memberName: loan.member?.name || 'Unknown',
        currentBalance: loan.currentBalance,
        status: loan.status
      } : 'NOT FOUND');
    } else if (memberId) {
      console.log('👤 API LOAN REPAY: Looking up active loan by memberId:', memberId);
      const searchCriteria = { 
        memberId: memberId,
        groupId: groupId,
        status: 'ACTIVE' as const,
        currentBalance: { gt: 0 }
      };
      console.log('🔍 API LOAN REPAY: Search criteria:', searchCriteria);
      
      loan = await prisma.loan.findFirst({
        where: searchCriteria,
        include: {
          member: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          dateIssued: 'desc' // Get the most recent active loan
        }
      });
      
      console.log('📊 API LOAN REPAY: Loan lookup by memberId result:', loan ? {
        id: loan.id,
        memberName: loan.member?.name || 'Unknown',
        currentBalance: loan.currentBalance,
        status: loan.status,
        dateIssued: loan.dateIssued
      } : 'NOT FOUND');
      
      // Also check total count of loans for this member in this group for debugging
      const totalLoansForMember = await prisma.loan.count({
        where: {
          memberId: memberId,
          groupId: groupId
        }
      });
      console.log('📈 API LOAN REPAY: Total loans for member in group:', totalLoansForMember);
    }

    if (!loan) {
      console.log('❌ API LOAN REPAY: No loan found in loans table, checking membership loan data...');
      
      // If no loan found in loans table, check if member has imported loan data in membership
      if (memberId) {
        const membership = await prisma.memberGroupMembership.findFirst({
          where: {
            member: { id: memberId },
            group: { id: groupId },
            currentLoanAmount: { gt: 0 } // Only if there's a loan amount
          },
          include: {
            member: {
              select: {
                id: true,
                name: true
              }
            }
          }
        });
        
        console.log('📊 API LOAN REPAY: Membership loan data:', membership ? {
          memberName: membership.member?.name,
          currentLoanAmount: membership.currentLoanAmount
        } : 'NOT FOUND');
        
        if (membership && membership.currentLoanAmount && membership.currentLoanAmount > 0) {
          console.log('✅ API LOAN REPAY: Found imported loan data in membership, processing repayment...');
          
          // Check if amount exceeds current balance
          if (amount > membership.currentLoanAmount) {
            console.log('❌ API LOAN REPAY: Amount exceeds membership loan balance:', {
              requestedAmount: amount,
              membershipLoanBalance: membership.currentLoanAmount
            });
            return NextResponse.json(
              { error: `Repayment amount (₹${amount}) exceeds current loan balance (₹${membership.currentLoanAmount})` },
              { status: 400 }
            );
          }
          
          // Process repayment by reducing membership loan amount
          const newLoanAmount = membership.currentLoanAmount - amount;
          const updatedMembership = await prisma.memberGroupMembership.update({
            where: { id: membership.id },
            data: { currentLoanAmount: newLoanAmount },
            include: {
              member: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          });
          
          console.log('✅ API LOAN REPAY: Membership loan repayment successful:', {
            memberName: updatedMembership.member?.name,
            previousAmount: membership.currentLoanAmount,
            repaymentAmount: amount,
            newAmount: newLoanAmount
          });
          
          return NextResponse.json({
            success: true,
            message: `Loan repayment of ₹${amount} processed successfully`,
            loan: {
              id: `membership-${membership.id}`,
              member: updatedMembership.member,
              previousBalance: membership.currentLoanAmount,
              repaymentAmount: amount,
              newBalance: newLoanAmount,
              type: 'imported-loan'
            }
          });
        }
      }
      
      if (loanId) {
        return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
      } else {
        return NextResponse.json({ error: 'No active loan found for this member' }, { status: 404 });
      }
    }

    console.log('✅ API LOAN REPAY: Loan found, proceeding with validation');

    // Check if loan belongs to the group
    if (loan.groupId !== groupId) {
      console.log('❌ API LOAN REPAY: Loan does not belong to this group');
      return NextResponse.json(
        { error: 'Loan does not belong to this group' },
        { status: 403 }
      );
    }

    // Check if amount exceeds current balance
    if (amount > loan.currentBalance) {
      console.log('❌ API LOAN REPAY: Amount exceeds current balance:', {
        requestedAmount: amount,
        currentBalance: loan.currentBalance
      });
      return NextResponse.json(
        { error: 'Repayment amount cannot exceed current loan balance' },
        { status: 400 }
      );
    }

    // Calculate new balance
    const newBalance = loan.currentBalance - amount;
    const newStatus = newBalance === 0 ? 'PAID' : 'ACTIVE';
    
    console.log('💰 API LOAN REPAY: Processing repayment:', {
      originalBalance: loan.currentBalance,
      repaymentAmount: amount,
      newBalance: newBalance,
      newStatus: newStatus
    });

    // Update the loan
    const updatedLoan = await prisma.loan.update({
      where: { id: loan.id },
      data: {
        currentBalance: newBalance,
        status: newStatus
      }
    });

    console.log('✅ API LOAN REPAY: Loan updated successfully');

    return NextResponse.json({
      message: 'Loan repayment processed successfully',
      loan: {
        id: updatedLoan.id,
        memberName: loan.member?.name || 'Unknown Member',
        repaymentAmount: amount,
        newBalance: newBalance,
        status: newStatus
      }
    });

  } catch (error) {
    console.error('❌ API LOAN REPAY: Unexpected error occurred:', {
      error: error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    });
    return NextResponse.json(
      { error: 'Failed to process loan repayment' },
      { status: 500 }
    );
  }
}
