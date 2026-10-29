import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";
import { ac, roles } from "@/auth/permissions";
import { prisma } from "@/lib/prisma";

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) throw new Error("BETTER_AUTH_SECRET is required for Better Auth.");

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true, autoSignIn: true },
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
  plugins: [adminPlugin({ ac, roles, defaultRole: "receptionist", adminRoles: ["superadmin"] })],
  advanced: { database: { joins: true } },
});
