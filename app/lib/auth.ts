import { auth } from "@/app/lib/auth-config";
import { NextRequest, NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";

// Auth middleware to protect API routes
 
export async function authMiddleware(_req: Request | NextRequest) {
  // Get the auth session
  const session = await auth();
  
  if (!session?.user) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 }
    );
  }

  return { session };
}

// Role-based auth middleware for API routes
export async function roleMiddleware(req: Request, allowedRoles: UserRole[]) {
  const authResult = await authMiddleware(req);
  
  // If the result is a NextResponse, it means auth failed
  if (authResult instanceof NextResponse) {
    return authResult;
  }
  
  const { session } = authResult;
  
  if (!session?.user?.role || !allowedRoles.includes(session.user.role as UserRole)) {
    return NextResponse.json(
      { message: "Forbidden - Insufficient permissions" },
      { status: 403 }
    );
  }

  return { session };
}

// Function to check if a user can access a specific group
export async function canAccessGroup(userId: string, groupId: string) {
  if (!userId || !groupId) return false;
  
  try {
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        member: {
          include: {
            memberships: {
              where: { groupId },
            },
            ledGroups: {
              where: { id: groupId },
            },
          },
        },
      },
    });

    // If no user found
    if (!user) return false;
    
    // Admin has access to all groups
    if (user.role === "ADMIN") return true;
    
    // Group leader has access to groups they lead through their member profile
    if (user.role === "GROUP_LEADER") {
      // Check if they lead this group
      if (user.member?.ledGroups && user.member.ledGroups.length > 0) return true;
      
      // Check if they are a member of this group
      if (user.member?.memberships && user.member.memberships.length > 0) return true;
    }
    
    // Regular member can only see groups they're a member of
    if (user.role === "MEMBER") {
      if (user.member?.memberships && user.member.memberships.length > 0) return true;
    }

    // Also check for pending leadership invitations
    if (user.member) {
      const pendingLeaderships = await prisma.pendingLeadership.findFirst({
        where: {
          groupId,
          memberId: user.member.id,
          status: 'PENDING',
        }
      });

      if (pendingLeaderships) return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking group access:", error);
    return false;
  }
}

// Function to check if a user can edit a specific group
export async function canEditGroup(userId: string, groupId: string) {
  if (!userId || !groupId) return false;
  
  try {
    // Get the user from the database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        member: {
          include: {
            ledGroups: {
              where: { id: groupId },
            },
          },
        },
      },
    });

    // If no user found
    if (!user) return false;
    
    // Admin can edit all groups
    if (user.role === "ADMIN") return true;
    
    // GROUP_LEADER can edit groups they lead
    if (user.role === "GROUP_LEADER" && user.member?.ledGroups && user.member.ledGroups.length > 0) return true;
    
    // Regular members cannot edit groups, even if they're part of them
    return false;
  } catch (error) {
    console.error("Error checking group edit permission:", error);
    return false;
  }
}

// Function to get all groups a user has access to
export async function getUserAccessibleGroups(userId: string) {
  if (!userId) return [];
  
  try {
    // Get the user's role and related data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        member: {
          include: {
            memberships: {
              include: {
                group: true,
              },
            },
            ledGroups: true,
          },
        },
      },
    });
    
    if (!user) return [];
    
    // Admin can see all groups
    if (user.role === "ADMIN") {
      return await prisma.group.findMany({
        include: {
          leader: { select: { id: true, name: true } },
          memberships: { select: { memberId: true } },
        }
      });
    }
    
    // GROUP_LEADER can see groups they lead and are members of
    if (user.role === "GROUP_LEADER") {
      // Handle case where GROUP_LEADER doesn't have a member record
      if (!user.member) {
        console.warn(`GROUP_LEADER user ${userId} has no associated member record`);
        return [];
      }
      
      const ledGroups = user.member.ledGroups || [];
      const memberGroups = user.member.memberships.map(m => m.group) || [];
      
      // Also include groups where they have pending leadership invitations
      let pendingLeadershipGroups: import("@prisma/client").Group[] = [];
      if (user.member.id) {
        const pendingLeaderships = await prisma.pendingLeadership.findMany({
          where: {
            memberId: user.member.id,
            status: 'PENDING',
          },
          include: {
            group: {
              include: {
                leader: { select: { id: true, name: true } },
                memberships: { select: { memberId: true } },
              }
            },
          }
        });
        pendingLeadershipGroups = pendingLeaderships.map(pl => pl.group);
      }
      
      const allAccessibleGroups = [
        ...ledGroups,
        ...memberGroups,
        ...pendingLeadershipGroups
      ];
      
      // Remove duplicates by ID
      const uniqueGroupMap = new Map();
      allAccessibleGroups.forEach(group => {
        uniqueGroupMap.set(group.id, group);
      });
      
      return Array.from(uniqueGroupMap.values());
    }
    
    // MEMBER can only see groups they're a member of
    if (user.role === "MEMBER" && user.member) {
      const memberGroups = user.member.memberships.map(membership => membership.group) || [];

      // Also include groups where they have pending leadership invitations
      let pendingLeadershipGroups: import("@prisma/client").Group[] = [];
      if (user.member.id) {
        const pendingLeaderships = await prisma.pendingLeadership.findMany({
          where: {
            memberId: user.member.id,
            status: 'PENDING',
          },
          include: {
            group: {
              include: {
                leader: { select: { id: true, name: true } },
                memberships: { select: { memberId: true } },
              }
            },
          }
        });
        pendingLeadershipGroups = pendingLeaderships.map(pl => pl.group);
      }

      const allAccessibleGroups = [
        ...memberGroups,
        ...pendingLeadershipGroups
      ];
      
      // Remove duplicates by ID
      const uniqueGroupMap = new Map();
      allAccessibleGroups.forEach(group => {
        uniqueGroupMap.set(group.id, group);
      });
      
      return Array.from(uniqueGroupMap.values());
    }
    
    return [];
  } catch (error) {
    console.error("Error getting user accessible groups:", error);
    return [];
  }
}

// Check if a user can view member IDs in a group (important for privacy)
export async function canViewMemberIds(userId: string, groupId: string) {
  // Only admins and group leaders can view sensitive member IDs
  const canEdit = await canEditGroup(userId, groupId);
  return canEdit; // For now, same permission as edit
}

// Set permissions for a user to manage a group
export async function setUserGroupPermission(userId: string, groupId: string, canEdit: boolean = false) {
  // Since we've removed the UserGroupManagement model, we need to handle permissions differently
  // For now, let's implement a simple check based on roles
  
  // Get the user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { member: true }
  });
  
  if (!user) {
    // Instead of throwing an error, log a warning and return false
    console.warn(`Warning: User ${userId} not found when setting group permissions. This might be due to a stale session.`);
    return false;
  }
  
  // For administrators, no need to set permissions as they have access to everything
  if (user.role === "ADMIN") {
    return true;
  }
  
  // For GROUP_LEADER, if they have a member profile, make them the leader of the group
  // This is a simplified approach - might not be suitable for all use cases
  if (user.role === "GROUP_LEADER" && user.member && canEdit) {
    try {
      await prisma.group.update({
        where: { id: groupId },
        data: { leaderId: user.member.id }
      });
      return true;
    } catch (error) {
      console.error("Error setting user as group leader:", error);
      return false;
    }
  }
  
  return false;
}

// Function to check if a member ID exists and is valid
export async function checkMemberIdValidity(memberId: string) {
  if (!memberId) return { valid: false, message: "Member ID cannot be empty" };
  
  try {
    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        users: true, // Check if member is already linked to a user
        memberships: {
          include: {
            group: true
          }
        }
      }
    });
    
    if (!member) {
      return { valid: false, message: "Invalid Member ID. This Member ID does not exist in our system." };
    }
    
    if (member.users && member.users.length > 0) {
      return { valid: false, message: "This Member ID is already linked to another user account." };
    }
    
    // Find the group name for better user feedback
    const groupName = member.memberships?.[0]?.group?.name || 'Unknown group';
    
    return { 
      valid: true, 
      message: `Valid Member ID for ${member.name || 'member'} in ${groupName}`, 
      member: {
        id: member.id,
        name: member.name,
        groupName
      } 
    };
  } catch (error) {
    console.error("Error checking member ID validity:", error);
    return { valid: false, message: "Error checking Member ID. Please try again later." };
  }
}