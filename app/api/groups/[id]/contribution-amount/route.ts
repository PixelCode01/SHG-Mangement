import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, canEditGroup } from '@/app/lib/auth';
import { prisma } from '@/app/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Use authMiddleware for authentication
    const authResult = await authMiddleware(request);
    if ('json' in authResult) {
      return authResult;
    }
    
    const { session } = authResult;
    const { id: groupId } = await params;
    
    // Check if user can edit this group
    const canEdit = await canEditGroup(session.user.id!, groupId);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Only group leaders can update contribution amounts' },
        { status: 403 }
      );
    }

    const { monthlyContribution } = await request.json();

    // Validate input
    if (typeof monthlyContribution !== 'number' || monthlyContribution <= 0) {
      return NextResponse.json(
        { error: 'Contribution amount must be a positive number' },
        { status: 400 }
      );
    }

    // Update the group's monthly contribution
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: { monthlyContribution: monthlyContribution }
    });

    return NextResponse.json({
      message: 'Contribution amount updated successfully',
      contributionAmount: updatedGroup.monthlyContribution
    });

  } catch (error) {
    console.error('Error updating contribution amount:', error);
    return NextResponse.json(
      { error: 'Failed to update contribution amount' },
      { status: 500 }
    );
  }
}
