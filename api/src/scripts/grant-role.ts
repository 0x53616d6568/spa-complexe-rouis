import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../../.env") });

import { clerkClient } from "@clerk/express";
import { logger } from "../lib/logger";

const [emailInput, roleInput] = process.argv.slice(2);
const email = emailInput?.trim().toLowerCase();

if (!email || !email.includes("@") || !["manager", "admin"].includes(roleInput ?? "")) {
  logger.error(
    "Usage: pnpm --filter @workspace/api-server run grant-role -- <account-email> <manager|admin>",
  );
  process.exitCode = 1;
} else {
  try {
    const matches = await clerkClient.users.getUserList({
      emailAddress: [email],
      limit: 2,
    });
    if (matches.data.length !== 1) {
      throw new Error(
        matches.data.length === 0
          ? "No Clerk account found for that email. The user must sign up first."
          : "More than one Clerk account matches that email; use a unique account email.",
      );
    }

    const user = matches.data[0];
    await clerkClient.users.updateUserMetadata(user.id, {
      publicMetadata: {
        ...user.publicMetadata,
        role: roleInput,
      },
    });
    logger.info(
      { userId: user.id, role: roleInput },
      "Clerk access role updated",
    );
  } catch (error) {
    logger.error({ error }, "Could not update the Clerk access role");
    process.exitCode = 1;
  }
}