// /app/api/groups/[id]/bank-transactions/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma'; // Corrected import path
import { z } from 'zod';

const bankTransactionSchema = z.object({
  transactionDate: z.string().datetime({ message: "Invalid date format" }),
  particulars: z.string().min(1, { message: "Particulars are required" }),
  amount: z.number(), // Positive for deposit, negative for withdrawal
  remainingBalance: z.number(),
});

// POST /api/groups/{groupId}/bank-transactions
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    const body = await request.json();
    const validation = bankTransactionSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid input data', details: validation.error.errors }, { status: 400 });
    }

    const { transactionDate, ...data } = validation.data;

    const newTransaction = await prisma.bankTransaction.create({
      data: {
        ...data,
        transactionDate: new Date(transactionDate),
        groupId: groupId,
      },
    });

    return NextResponse.json(newTransaction, { status: 201 });
  } catch (error) {
    console.error("Failed to create bank transaction:", error);
    return NextResponse.json({ error: 'Failed to create bank transaction' }, { status: 500 });
  }
}

// GET /api/groups/{groupId}/bank-transactions
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  if (!groupId) {
    return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
  }

  try {
    const transactions = await prisma.bankTransaction.findMany({
      where: { groupId: groupId },
      orderBy: { transactionDate: 'desc' },
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Failed to fetch bank transactions:", error);
    return NextResponse.json({ error: 'Failed to fetch bank transactions' }, { status: 500 });
  }
}
