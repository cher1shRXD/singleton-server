import { mysqlTable, serial, varchar, timestamp, int, longtext } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 256 }).notNull().unique(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  phone: varchar("phone", { length: 11 }).notNull().unique(),
  password: varchar("password", { length: 256 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  role: int("role").default(0),
});

export const apps = mysqlTable("apps", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  path: longtext("path").notNull(),
});