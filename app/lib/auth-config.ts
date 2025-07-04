import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcrypt";
import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/app/lib/prisma";
import { UserRole } from "@prisma/client";

// Define custom user type for NextAuth
declare module "next-auth" {
  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    role?: UserRole;
    memberId?: string | null;
    image?: string | null;
  }
  
  interface Session {
    user: User;
  }
}

// Define custom token type
declare module "next-auth" {
  interface JWT {
    id?: string;
    role?: UserRole;
    memberId?: string | null;
  }
}

const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET || "fallback-secret-for-dev",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
  trustHost: true,
  // Add useSecureCookies setting based on environment
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log('[NextAuth] Authorization attempt with identifier:', credentials?.identifier);
          
          if (!credentials?.identifier || !credentials?.password) {
            console.log('[NextAuth] Missing identifier or password');
            return null;
          }

          const identifier = credentials.identifier as string;
          const password = credentials.password as string;

          // Determine if identifier is email or phone
          const isEmail = identifier.includes('@');
          const isPhone = /^\+?[\d\s\-\(\)]+$/.test(identifier);

          let userFromDb = null;

          if (isEmail) {
            // Find the user by email
            console.log('[NextAuth] Searching for user with email:', identifier);
            userFromDb = await prisma.user.findFirst({
              where: {
                email: identifier,
              },
            });
          } else if (isPhone) {
            // Normalize phone number (remove spaces, dashes, parentheses)
            const normalizedPhone = identifier.replace(/[\s\-\(\)]/g, '');
            console.log('[NextAuth] Searching for user with phone:', normalizedPhone);
            userFromDb = await prisma.user.findFirst({
              where: {
                phone: normalizedPhone,
              },
            });
          } else {
            console.log('[NextAuth] Identifier is neither email nor phone format:', identifier);
            return null;
          }

          // If no user is found or no password is set
          if (!userFromDb?.password) {
            console.log('[NextAuth] User not found or no password set');
            return null;
          }

          console.log('[NextAuth] User found, comparing passwords');
          // Compare passwords - making sure types are correct
          const passwordMatch = await compare(
            password,
            userFromDb.password
          );

          // If password doesn't match
          if (!passwordMatch) {
            console.log('[NextAuth] Password does not match');
            return null;
          }

          console.log('[NextAuth] Authentication successful for user:', userFromDb.email || userFromDb.phone);
          // Return the user object
          return {
            id: userFromDb.id,
            name: userFromDb.name,
            email: userFromDb.email,
            image: userFromDb.image,
            role: userFromDb.role,
            memberId: userFromDb.memberId,
          };
        } catch (error) {
          console.error('[NextAuth] Error in authorize function:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Log sign-in attempts for debugging
      console.log('[NextAuth] SignIn callback:', { 
        user: user?.email || user?.id, 
        account: account?.provider 
      });
      if (!user) {
        console.log('[NextAuth] SignIn failed - no user object');
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.memberId = user.memberId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.memberId = token.memberId as string | null;

        // Refresh user data from database to ensure it's up to date
        // This is important for when roles change (e.g., accepting leadership)
        if (token.id) {
          try {
            const freshUserData = await prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true, memberId: true }
            });
            
            if (freshUserData) {
              // Update session with fresh data from database
              session.user.role = freshUserData.role;
              session.user.memberId = freshUserData.memberId;
              
              // Also update the token for future requests
              token.role = freshUserData.role;
              token.memberId = freshUserData.memberId;
            }
          } catch (error) {
            console.error('[NextAuth] Error refreshing user data:', error);
            // Continue with cached token data if database fetch fails
          }
        }
      }
      return session;
    },
  },
};

// Create and export the auth instance
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
