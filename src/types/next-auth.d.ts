import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      plan: string;
      /** True while the account still uses the temporary seed password. */
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    plan?: string;
    mustChangePassword?: boolean;
  }
}
