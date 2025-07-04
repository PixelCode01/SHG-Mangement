import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { authMiddleware } from '@/app/lib/auth';

export async function GET(request: NextRequest) {
  const authResult = await authMiddleware(request);
  if (authResult instanceof NextResponse) {
    return authResult; // Handles unauthorized or session errors
  }

  const { session } = authResult;

  try {
    // Handle both users with and without member profiles
    const whereClause: Record<string, unknown> = {
      status: 'PENDING',
    };

    if (session.user.memberId) {
      // User has a member profile, search by memberId
      whereClause.memberId = session.user.memberId;
    } else {
      // User doesn't have a member profile (e.g., GROUP_LEADER), 
      // they shouldn't have pending leadership invitations via memberId
      // Return empty array since leadership invitations are member-based
      return NextResponse.json([]);
    }

    const pendingInvitations = await prisma.pendingLeadership.findMany({
      where: whereClause,
      include: {
        group: {
          select: {
            id: true,
            groupId: true,
            name: true,
            dateOfStarting: true,
          },
        },
        initiatedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(pendingInvitations);
  } catch (error) {
    console.error('Error fetching pending leadership invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch pending leadership invitations' }, { status: 500 });
  }
}
