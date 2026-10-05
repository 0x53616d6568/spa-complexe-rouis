import { Router, type IRouter } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { and, eq, isNull } from "drizzle-orm";
import { customersTable, db } from "@workspace/db";
import { getSpaAccess } from "../modules/auth/authorization";
import { sendRouteError } from "../modules/shared/http-error";

const router: IRouter = Router();

router.get("/auth/me", async (request, response) => {
  const auth = getAuth(request);
  if (!auth.userId) {
    response.status(401).json({ error: "Sign in to view your access profile." });
    return;
  }

  try {
    const access = await getSpaAccess(auth.userId);
    response.json({ role: access.role, permissions: access.permissions });
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

router.post("/auth/link-customer", async (request, response) => {
  const auth = getAuth(request);
  if (!auth.userId) {
    response.status(401).json({ error: "Sign in to link your customer account." });
    return;
  }

  try {
    const user = await clerkClient.users.getUser(auth.userId);
    const primaryEmail = user.emailAddresses.find(
      (address) => address.id === user.primaryEmailAddressId,
    );
    if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
      response.status(403).json({ error: "A verified primary email is required." });
      return;
    }

    const normalizedEmail = primaryEmail.emailAddress.trim().toLowerCase();
    const [alreadyLinked] = await db
      .select({ email: customersTable.email })
      .from(customersTable)
      .where(eq(customersTable.clerkUserId, auth.userId))
      .limit(1);
    if (alreadyLinked) {
      response.json({ linked: alreadyLinked.email === normalizedEmail });
      return;
    }

    const [linked] = await db
      .update(customersTable)
      .set({ clerkUserId: auth.userId, updatedAt: new Date() })
      .where(
        and(
          eq(customersTable.email, normalizedEmail),
          isNull(customersTable.clerkUserId),
        ),
      )
      .returning({ id: customersTable.id });
    response.json({ linked: Boolean(linked) });
  } catch (error) {
    sendRouteError(request, response, error);
  }
});

export default router;
