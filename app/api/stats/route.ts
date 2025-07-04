import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { authMiddleware } from '@/app/lib/auth';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check authentication first
    const authResult = await authMiddleware(request);
    
    // If the result is a NextResponse, it means auth failed
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    
    // User is authenticated, proceed with fetching stats
    const totalGroups = await prisma.group.count();
    const totalMembers = await prisma.member.count();
    // Add more stats as needed, e.g., total loan amounts, total savings
    // const totalLoanAmount = await prisma.loan.aggregate({ _sum: { amount: true } });
    // const totalSavings = await prisma.periodicRecord.aggregate({ _sum: { cashBalance: true } }); // This might need refinement based on how savings are tracked

    return NextResponse.json({
      totalGroups,
      totalMembers,
      // totalLoanAmount: totalLoanAmount._sum.amount || 0,
      // totalSavings: totalSavings._sum.cashBalance || 0, // Example
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
