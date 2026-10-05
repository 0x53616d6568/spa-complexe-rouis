import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { clerkClient } from "@clerk/express";
import { logger } from "../lib/logger";

const accountSeeds = [
  {
    label: "customer",
    email: "customer@example.com",
    password: "StillroomCustomer123!",
    role: null,
  },
  {
    label: "admin",
    email: "admin@example.com",
    password: "StillroomAdmin123!",
    role: "admin",
  },
  {
    label: "staff-manager",
    email: "manager@example.com",
    password: "StillroomManager123!",
    role: "manager",
  },
] as const;

async function ensureSeedAccount(account: (typeof accountSeeds)[number]) {
  const matches = await clerkClient.users.getUserList({
    emailAddress: [account.email],
    limit: 2,
  });

  let user = matches.data[0];

  if (!user) {
    user = await clerkClient.users.createUser({
      emailAddress: [account.email],
      password: account.password,
      firstName: account.label,
      lastName: "Seed",
    });
    logger.info({ email: account.email }, "Created Clerk seed user");
  }

  const metadata = { ...(user.publicMetadata ?? {}) };
  if (account.role) {
    metadata.role = account.role;
  } else {
    delete metadata.role;
  }

  await clerkClient.users.updateUserMetadata(user.id, {
    publicMetadata: metadata,
  });

  logger.info(
    {
      email: account.email,
      role: account.role,
      password: account.password,
    },
    "Seed account ready",
  );

  return { email: account.email, role: account.role, password: account.password };
}

async function seedAccounts() {
  const created = await Promise.all(accountSeeds.map(ensureSeedAccount));
  logger.info(
    { accounts: created },
    "All seeded Clerk accounts are ready. Sign in with the email/password shown above.",
  );
}

seedAccounts().catch((error: unknown) => {
  logger.error({ error }, "Failed to seed Clerk accounts");
  process.exitCode = 1;
});
