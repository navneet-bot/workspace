import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/db";

// Ensure NEXTAUTH_URL exactly matches the deployment URL in production on Vercel
if (process.env.VERCEL_URL && !process.env.NEXTAUTH_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "your@email.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log("Authorize called");
        console.log("Email:", credentials?.email);

        try {
          if (!credentials?.email || !credentials?.password) {
            console.error("AUTH FAILED: Missing credentials");
            return null;
          }

          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.email },
                { jobjockeyId: credentials.email }
              ]
            }
          });

          console.log("User found:", !!user);

          if (!user) {
            console.error("AUTH FAILED: User not found");
            return null;
          }

          console.log("User email:", user.email);

          if (!user.password) {
            console.error("AUTH FAILED: User has no password set");
            return null;
          }

          // Compare password using bcrypt, with a plaintext fallback for legacy records.
          const isCorrectPassword = await bcrypt.compare(
            credentials.password,
            user.password
          );
          
          const passwordValid = isCorrectPassword || credentials.password === user.password;
          console.log("Password valid:", passwordValid);

          if (!passwordValid) {
            console.error("AUTH FAILED: Invalid password");
            return null;
          }

          return {
            id: user.id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            permissions: user.permissions || ""
          };
        } catch (error: any) {
          console.error("Authorize failed:", error);
          // Prevent leaking internal database errors to the frontend
          if (error?.message?.includes("No database host") || error?.message?.includes("DATABASE_URL")) {
             throw new Error("Authentication service is temporarily unavailable. Please check the backend configuration.");
          }
          throw error;
        }
      }
    })
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = token.role as string;
        (session.user as any).permissions = token.permissions as string;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};

