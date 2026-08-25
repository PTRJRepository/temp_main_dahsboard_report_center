import { Elysia } from "elysia";

export const plugin = new Elysia()
    .get("/manual-adjustment/check", async ({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { error: "Unauthorized" };
        }
        return { ok: true, user: currentUser.username };
    });