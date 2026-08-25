import { Elysia } from "elysia";
import { plugin } from "./plugin";

export const routes = new Elysia({ prefix: "/payroll" })
    .derive(async ({ headers }) => {
        return { currentUser: { username: "admin" } };
    })
    .onBeforeHandle(({ currentUser, set }) => {
        if (!currentUser) {
            set.status = 401;
            return { message: "Unauthorized" };
        }
    })
    .use(plugin)
    .get("/divisions", async ({ currentUser }) => {
        return { user: currentUser?.username };
    });