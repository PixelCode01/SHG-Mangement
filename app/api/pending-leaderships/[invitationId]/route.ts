import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { authMiddleware } from '@/app/lib/auth';
import { z } from 'zod';

const updateInvitationStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ invitationId: string }> }) {
  const authResult = await authMiddleware(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { session } = authResult;
  const { invitationId } = await params;

  if (!session.user.memberId) {
    return NextResponse.json({ error: 'User is not associated with a member profile. Only users with member profiles can respond to leadership invitations.' }, { status: 403 });
  }

  if (!invitationId) {
    return NextResponse.json({ error: 'Invitation ID is required.' }, { status: 400 });
  }

  try {
    const validationResult = updateInvitationStatusSchema.safeParse(await request.json());
    if (!validationResult.success) {
      return NextResponse.json({ error: 'Invalid request body', details: validationResult.error.format() }, { status: 400 });
    }

    const { status: newStatus } = validationResult.data;

    const updatedInvitation = await prisma.$transaction(async (tx) => {
      const invitation = await tx.pendingLeadership.findUnique({
        where: { id: invitationId },
        include: { group: true }, // Include group to get groupId for leader update
      });

      if (!invitation) {
        throw new Error('Invitation not found.'); // This will be caught and returned as 404
      }

      if (invitation.memberId !== session.user.memberId) {
        throw new Error('Forbidden. You are not the recipient of this invitation.'); // Caught as 403
      }

      if (invitation.status !== 'PENDING') {
        throw new Error(`Invitation is no longer PENDING. Current status: ${invitation.status}`); // Caught as 400
      }

      const result = await tx.pendingLeadership.update({
        where: { id: invitationId },
        data: { status: newStatus },
      });

      if (newStatus === 'ACCEPTED') {
        // First, find the current group leader to demote them
        const currentGroup = await tx.group.findUnique({
          where: { id: invitation.groupId },
          select: { leaderId: true }
        });

        // If there's a current leader who is different from the new leader, demote them
        if (currentGroup?.leaderId && currentGroup.leaderId !== invitation.memberId) {
          const currentLeaderUser = await tx.user.findFirst({
            where: { memberId: currentGroup.leaderId }
          });

          // Demote the current leader back to MEMBER (unless they're an ADMIN)
          if (currentLeaderUser && currentLeaderUser.role === 'GROUP_LEADER') {
            await tx.user.update({
              where: { id: currentLeaderUser.id },
              data: { role: 'MEMBER' }
            });
          }
        }

        // Update the group's leaderId to the new leader
        await tx.group.update({
          where: { id: invitation.groupId },
          data: { leaderId: invitation.memberId },
        });

        // Promote the new leader to GROUP_LEADER role
        const newLeaderUser = await tx.user.findFirst({
            where: { memberId: invitation.memberId }
        });
        if (newLeaderUser && newLeaderUser.role !== 'GROUP_LEADER' && newLeaderUser.role !== 'ADMIN') {
            // Only upgrade if they are currently a MEMBER. Admins should remain Admins.
            await tx.user.update({
                where: { id: newLeaderUser.id },
                data: { role: 'GROUP_LEADER' }
            });
        }

        // Mark other PENDING invitations for the same group (if any) as SUPERSEDED
        await tx.pendingLeadership.updateMany({
            where: {
                groupId: invitation.groupId,
                id: { not: invitationId }, // Exclude the current invitation
                status: 'PENDING'
            },
            data: { status: 'SUPERSEDED' }
        });
      }
      return result;
    });

    return NextResponse.json(updatedInvitation);

  } catch (error) {
    console.error('Error updating leadership invitation:', error);
    const typedError = error as Error;
    if (typedError.message.startsWith('Invitation not found')) {
      return NextResponse.json({ error: typedError.message }, { status: 404 });
    }
    if (typedError.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: typedError.message }, { status: 403 });
    }
    if (typedError.message.includes('no longer PENDING')) {
        return NextResponse.json({ error: typedError.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to update leadership invitation' }, { status: 500 });
  }
}
