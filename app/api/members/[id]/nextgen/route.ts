// /home/pixel/SHG/app/api/members/[id]/nextgen/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { z } from 'zod';
import { ContributionType } from '@prisma/client';

// Validation schema for creating a NextGenMember
const createNextGenMemberSchema = z.object({
  nextGenName: z.string().min(1, 'Name is required'),
  contribution: z.number().positive('Contribution must be positive').optional().nullable(),
  contributionType: z.nativeEnum(ContributionType).optional().nullable(),
});

// GET /api/members/{memberId}/nextgen
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: primaryMemberId } = await params;
  if (!primaryMemberId) {
    return NextResponse.json({ error: 'Primary Member ID is required' }, { status: 400 });
  }

  try {
    const nextGenMembers = await prisma.nextGenMember.findMany({
      where: {
        primaryMemberId: primaryMemberId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(nextGenMembers);
  } catch (error) {
    console.error("Failed to fetch NextGen members:", error);
    return NextResponse.json({ error: 'Failed to fetch NextGen members' }, { status: 500 });
  }
}

// POST /api/members/{memberId}/nextgen
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: primaryMemberId } = await params;
  if (!primaryMemberId) {
    return NextResponse.json({ error: 'Primary Member ID is required' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const validation = createNextGenMemberSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validation.error.errors }, { status: 400 });
    }

    const { nextGenName, contribution, contributionType } = validation.data;

    // Check if primary member exists
    const primaryMember = await prisma.member.findUnique({
      where: { id: primaryMemberId },
      select: { id: true }
    });

    if (!primaryMember) {
      return NextResponse.json({ error: 'Primary Member not found' }, { status: 404 });
    }

    const newNextGenMember = await prisma.nextGenMember.create({
      data: {
        nextGenName,
        contribution: contribution !== undefined ? contribution : null,
        contributionType: contributionType !== undefined ? contributionType : null,
        primaryMemberId: primaryMemberId,
      },
    });

    return NextResponse.json(newNextGenMember, { status: 201 });
  } catch (error) {
    console.error("Failed to create NextGen member:", error);
    if (error instanceof z.ZodError) {
        return NextResponse.json({ error: 'Invalid data format', details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create NextGen member' }, { status: 500 });
  }
}
