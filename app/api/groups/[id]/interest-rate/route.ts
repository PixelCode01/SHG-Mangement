import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, canEditGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[Interest Rate API] Starting request...');
    
    // Use authMiddleware for authentication
    const authResult = await authMiddleware(request);
    if ('json' in authResult) {
      console.log('[Interest Rate API] Authentication failed');
      return authResult;
    }
    
    const { session } = authResult;
    console.log('[Interest Rate API] Session:', session?.user?.id ? 'Found' : 'Not found');

    const { id: groupId } = await params;
    console.log('[Interest Rate API] Group ID:', groupId);
    
    // Check if user can edit this group
    const canEdit = await canEditGroup(session.user.id!, groupId);
    if (!canEdit) {
      console.log('[Interest Rate API] User cannot edit group');
      return NextResponse.json(
        { error: 'Only group leaders can update interest rates' },
        { status: 403 }
      );
    }
    
    const requestBody = await request.json();
    console.log('[Interest Rate API] Request body:', requestBody);
    const { interestRate } = requestBody;

    // Validate input
    if (typeof interestRate !== 'number' || interestRate < 0 || interestRate > 100) {
      return NextResponse.json(
        { error: 'Interest rate must be a number between 0 and 100' },
        { status: 400 }
      );
    }

    // Update the group's interest rate
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { interestRate }
    });

    console.log('[Interest Rate API] Successfully updated group:', updatedGroup.id);
    return NextResponse.json({
      message: 'Interest rate updated successfully',
      interestRate: updatedGroup.interestRate
    });

  } catch (error) {
    console.error('[Interest Rate API] Error updating interest rate:', error);
    return NextResponse.json(
      { error: 'Failed to update interest rate' },
      { status: 500 }
    );
  }
}
