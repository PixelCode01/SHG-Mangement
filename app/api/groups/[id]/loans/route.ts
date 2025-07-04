import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/app/lib/prisma';

// Validation schema for creating a Loan
const loanSchema = z.object({
  memberId: z.string(), 
  loanType: z.enum(["PERSONAL", "EDUCATION", "SOCIAL", "MORTGAGE", "GRANTOR", "OTHER"]), 
  originalAmount: z.number().positive(),
  interestRate: z.number().min(0), 
  dateIssued: z.string().datetime(), 
  status: z.enum(["ACTIVE", "PAID", "DEFAULTED"]).default("ACTIVE"), 
  grantorInfo: z.string().optional().nullable(),
});

// Define the inferred type
type LoanInputType = z.infer<typeof loanSchema>;

// POST /api/groups/{groupId}/loans
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  console.log('🔄 [LOAN API] POST request received for groupId:', groupId);
  
  if (!groupId) {
    console.error('❌ [LOAN API] Group ID is missing');
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Validate group existence
    console.log('🔍 [LOAN API] Validating group existence...');
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true }, // Only need ID for validation
    });
    if (!group) {
      console.error('❌ [LOAN API] Group not found:', groupId);
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }
    console.log('✅ [LOAN API] Group found');

    const body = await request.json();
    console.log('📋 [LOAN API] Request body:', body);
    
    const validation = loanSchema.safeParse(body);
    console.log('🔍 [LOAN API] Validation result:', {
      success: validation.success,
      error: validation.success ? null : validation.error.format()
    });

    if (!validation.success) {
      console.error('❌ [LOAN API] Validation failed:', validation.error.format());
      return NextResponse.json({ error: 'Invalid input data', details: validation.error.format() }, { status: 400 }); // Use .format()
    }

    // Use the explicitly defined type
    const loanData: LoanInputType = validation.data;
    console.log('📋 [LOAN API] Validated loan data:', loanData);

    // Validate member existence (within the group is ideal, but requires membership check)
    console.log('🔍 [LOAN API] Validating member existence...');
    const member = await prisma.member.findUnique({
      where: { id: loanData.memberId }, // loanData.memberId is now typed as string
      select: { id: true },
    });
    if (!member) {
      console.error('❌ [LOAN API] Member not found:', loanData.memberId);
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }
    console.log('✅ [LOAN API] Member found');
    // Optional: Add check to ensure member belongs to the group `groupId`

    console.log('💾 [LOAN API] Creating loan in database...');
    const newLoan = await prisma.loan.create({
      data: {
        groupId: groupId,
        memberId: loanData.memberId,
        loanType: loanData.loanType,
        originalAmount: loanData.originalAmount,
        interestRate: loanData.interestRate,
        dateIssued: new Date(loanData.dateIssued),
        status: loanData.status,
        currentBalance: loanData.originalAmount,
        ...(loanData.grantorInfo !== undefined && { grantorInfo: loanData.grantorInfo }),
      },
    });
    console.log('✅ [LOAN API] Loan created successfully:', newLoan.id);

    return NextResponse.json(newLoan, { status: 201 });
  } catch (error) {
    console.error("💥 [LOAN API] Failed to create loan:", error);
    console.error("💥 [LOAN API] Error type:", typeof error);
    console.error("💥 [LOAN API] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({ error: 'Failed to create loan' }, { status: 500 });
  }
}

// GET /api/groups/{groupId}/loans
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    // Optional: Add filtering by status, memberId etc. via query params later
    const loans = await prisma.loan.findMany({
      where: { groupId: groupId },
      include: {
        member: { // Include member name for display
          select: { name: true }
        }
      },
      orderBy: {
        dateIssued: 'desc', // Show most recent loans first
      },
    });

    return NextResponse.json(loans);
  } catch (error) {
    console.error("Failed to fetch loans:", error);
    return NextResponse.json({ error: 'Failed to fetch loans' }, { status: 500 });
  }
}
