import "dotenv/config";
import express from "express";
import session from "express-session";
import { RedisStore } from "connect-redis";
import redisClient from "./redis";
import authRouter from "./routes/auth";
import appsRouter from "./routes/apps";

declare module "express-session" {
  interface SessionData {
    userId: number;
    username: string;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || "supersecret";

redisClient.connect().catch((err) => {
  console.error("Failed to connect to Redis:", err);
  process.exit(1);
});

const redisStore = new RedisStore({
  client: redisClient,
  prefix: "singleton-server:",
});

app.use(
  session({
    name: "SESSION",
    store: redisStore,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      domain: ".cher1shrxd.me"
    },
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Session Server is running!");
});

app.use("/auth", authRouter);

app.use("/apps", appsRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
