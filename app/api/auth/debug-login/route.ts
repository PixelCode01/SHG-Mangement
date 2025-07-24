import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcrypt';
import { prisma } from '@/app/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { identifier, password } = await request.json();
    
    console.log('[DEBUG] Testing auth with:', { identifier, hasPassword: !!password });
    
    if (!identifier || !password) {
      return NextResponse.json({ 
        error: 'Missing credentials',
        success: false 
      }, { status: 400 });
    }

    // Determine if identifier is email or phone
    const isEmail = identifier.includes('@');
    const isPhone = /^\+?[\d\s\-\(\)]+$/.test(identifier);

    console.log('[DEBUG] Identifier type:', { isEmail, isPhone });

    let userFromDb: any = null;

    if (isEmail) {
      userFromDb = await prisma.user.findFirst({
        where: { email: identifier }
      });
    } else if (isPhone) {
      const normalizedPhone = identifier.replace(/[\s\-\(\)]/g, '');
      console.log('[DEBUG] Normalized phone:', normalizedPhone);
      userFromDb = await prisma.user.findFirst({
        where: { phone: normalizedPhone }
      });
    }

    console.log('[DEBUG] User found:', !!userFromDb);

    if (!userFromDb?.password) {
      return NextResponse.json({ 
        error: 'User not found or no password set',
        success: false,
        userFound: !!userFromDb,
        hasPassword: !!userFromDb?.password
      }, { status: 401 });
    }

    const passwordMatch = await compare(password, userFromDb.password);
    console.log('[DEBUG] Password match:', passwordMatch);

    if (!passwordMatch) {
      return NextResponse.json({ 
        error: 'Invalid password',
        success: false 
      }, { status: 401 });
    }

    return NextResponse.json({ 
      success: true,
      user: {
        id: userFromDb.id,
        name: userFromDb.name,
        email: userFromDb.email,
        phone: userFromDb.phone,
        role: userFromDb.role
      }
    });

  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return NextResponse.json({ 
      error: 'Server error',
      success: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
