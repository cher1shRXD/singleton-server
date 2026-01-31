import { createClient } from "redis";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

export default redisClient;
