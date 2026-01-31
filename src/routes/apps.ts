import { Router } from "express";
import { db } from "../db";
import { apps } from "../db/schema";
import { eq } from "drizzle-orm";

const appsRouter = Router();

const appsSelectFields = {
  id: apps.id,
  name: apps.name,
  path: apps.path,
};

appsRouter.get("/", async (req, res) => {
  const appsList = await db.select().from(apps);
  res.json(appsList);
});

appsRouter.post("/", async (req, res) => {
  try {
    const { name, path } = req.body;

    if (!name || !path) {
      return res
        .status(400)
        .json({ message: "App name and path are required" });
    }

    const [existingApp] = await db
      .select()
      .from(apps)
      .where(eq(apps.name, name))
      .limit(1);

    if (existingApp) {
      return res
        .status(409)
        .json({ message: "App with this name already exists" });
    }

    const result = await db.transaction(async (tx) => {
      const result = await tx.insert(apps).values({
        name,
        path,
      });

      const insertId = result[0].insertId;

      const [app] = await tx
        .select(appsSelectFields)
        .from(apps)
        .where(eq(apps.id, insertId))
        .limit(1);

      return app;
    });

    res.status(201).json({ id: result.id, name, path });
  } catch (error) {
    console.error("Error creating app:", error);
    res
      .status(500)
      .json({ message: "Failed to create app. Please try again." });
  }
});

appsRouter.delete("/:id", async (req, res) => {
  try {
    const appId = parseInt(req.params.id, 10);

    const isExistingApp = await db
      .select()
      .from(apps)
      .where(eq(apps.id, appId))
      .limit(1);

    if (isExistingApp.length === 0) {
      return res.status(404).json({ message: "App not found" });
    }

    await db
      .delete(apps)
      .where(eq(apps.id, appId))
      .execute();

    res.json({ message: "App deleted successfully" });
  } catch (error) {
    console.error("Error deleting app:", error);
    res
      .status(500)
      .json({ message: "Failed to delete app. Please try again." });
  }
});

export default appsRouter;
