import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authMiddleware } from '@/app/lib/auth';

// Schema for validating new member data
const createMemberSchema = z.object({
  name: z.string().min(1, 'Member name is required'),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable().or(z.literal('')),
  // Add other relevant fields as needed
});

export async function GET(req: NextRequest) {
  const session = await authMiddleware(req);

  // Check authentication first
  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const userId = session.session.user.id;
    
    let members;
    
    // For admin users, we show all members
    // For GROUP_LEADER users, we only show members of their group
    // For MEMBER users, we only show members of their group
    
    if (session.session.user.role === 'ADMIN') {
      // Admin sees all members
      members = await prisma.member.findMany({
        include: {
          memberships: {
            select: {
              group: {
                select: { id: true, name: true, groupId: true }
              },
              joinedAt: true // Include join date if needed
            }
          },
          ledGroups: {
            select: { id: true, name: true, groupId: true }
          }
        },
        orderBy: {
          name: 'asc'
        }
      });
    } else if (session.session.user.role === 'GROUP_LEADER') {
      const leaderMemberId = session.session.user.memberId;

      if (!leaderMemberId) {
        console.error("GROUP_LEADER session is missing memberId.");
        // If the leader has no memberId, they can't lead groups or be a member themselves.
        // Return empty or an appropriate error. For now, returning empty if no memberId.
        return NextResponse.json([], { status: 200 }); 
      }
      
      const memberIdsToFetch = new Set<string>();
      memberIdsToFetch.add(leaderMemberId); // Always include the leader's own memberId

      // Find groups led by this leader
      const groupsLed = await prisma.group.findMany({
        where: { leaderId: leaderMemberId },
        include: {
          memberships: { // Correct relation: Group -> MemberGroupMembership
            select: { memberId: true }, // Select only the memberId from the membership
          },
        },
      });

      // Collect all memberIds from the groups they lead
      groupsLed.forEach(group => {
        group.memberships.forEach(membership => {
          if (membership.memberId) {
            memberIdsToFetch.add(membership.memberId);
          }
        });
      });

      // IMPORTANT ADDITION: Also fetch any members that were created by this user
      // This ensures GROUP_LEADERs can see members they've created inline, even before 
      // adding them to any group
      const createdMembers = await prisma.member.findMany({
        where: {
          createdByUserId: userId, // Changed from createdBy to createdByUserId
        },
        select: { id: true },
      });

      createdMembers.forEach(member => {
        memberIdsToFetch.add(member.id);
      });

      // ADDITIONAL: For GROUP_LEADERs, also include any members that don't belong to any group yet
      // This helps with the case where members are imported but not yet assigned to groups
      const unassignedMembers = await prisma.member.findMany({
        where: {
          memberships: {
            none: {} // Members with no group memberships
          }
        },
        select: { id: true },
      });

      unassignedMembers.forEach(member => {
        memberIdsToFetch.add(member.id);
      });

      // If after all this, the set only contains the leader's own ID (and they lead no groups)
      // or is empty (which shouldn't happen if leaderMemberId was valid), 
      // the fetch below will correctly get just the leader or an empty list.

      members = await prisma.member.findMany({
        where: {
          id: { in: Array.from(memberIdsToFetch) },
        },
        include: {
          memberships: {
            select: {
              group: {
                select: { id: true, name: true, groupId: true }
              },
              joinedAt: true
            }
          },
          ledGroups: {
            select: { id: true, name: true, groupId: true }
          }
        },
        orderBy: { name: 'asc' },
      });
    } else if (session.session.user.role === 'MEMBER') {
      const currentMemberId = session.session.user.memberId;
      if (!currentMemberId) {
        return NextResponse.json({ message: 'Member profile not found.' }, { status: 403 });
      }

      // A regular member should see:
      // 1. Their own profile
      // 2. Members they've created (for import functionality)
      const memberIdsToFetch = new Set<string>();
      memberIdsToFetch.add(currentMemberId);

      // Add members created by this user
      const createdMembers = await prisma.member.findMany({
        where: {
          createdByUserId: userId,
        },
        select: { id: true },
      });

      createdMembers.forEach(member => {
        memberIdsToFetch.add(member.id);
      });

      const members = await prisma.member.findMany({
        where: {
          id: { in: Array.from(memberIdsToFetch) },
        },
        include: {
          memberships: {
            select: {
              group: {
                select: { id: true, name: true, groupId: true }
              },
              joinedAt: true
            }
          },
          ledGroups: {
            select: { id: true, name: true, groupId: true }
          }
        },
        orderBy: { name: 'asc' },
      });

      return NextResponse.json(members);
    } else {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
    
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await authMiddleware(request);

  if (session instanceof NextResponse) {
    return session;
  }

  try {
    const json = await request.json();
    const url = new URL(request.url);
    const allowDuplicates = url.searchParams.get('allowDuplicates') === 'true';
    
    // Validate input with Zod schema
    const validationResult = createMemberSchema.safeParse(json);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { message: 'Invalid member data', errors: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const data = validationResult.data;
    
    // Check if a member with the same name already exists (case-insensitive)
    // Skip this check if allowDuplicates is true
    if (!allowDuplicates) {
      const existingMemberByName = await prisma.member.findFirst({
        where: {
          name: {
            equals: data.name,
            mode: 'insensitive', // Case-insensitive comparison
          },
        },
      });
      
      if (existingMemberByName) {
        return NextResponse.json(
          { error: 'A member with this name already exists' },
          { status: 409 }
        );
      }
    }
    
    // Create the new member with the current user as creator
    const newMember = await prisma.member.create({
      data: {
        name: data.name,
        email: data.email || null, // Handle empty string case
        phone: data.phone || null,
        address: data.address || null,
        createdByUserId: session.session.user.id, // Changed from createdBy to createdByUserId
      },
    });
    
    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error('Error creating member:', error);
    return NextResponse.json(
      { message: 'Failed to create member' },
      { status: 500 }
    );
  }
}
