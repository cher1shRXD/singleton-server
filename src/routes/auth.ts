import { Router } from "express";
import { db } from "../db";
import { users } from "../db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcrypt";

const authRouter = Router();

const userSelectFields = {
  id: users.id,
  username: users.username,
  email: users.email,
  phone: users.phone,
  createdAt: users.createdAt,
};

const validateRegisterInput = (
  username: string,
  email: string,
  phone: string,
  password: string,
) => {
  const errors: string[] = [];

  if (!username || username.trim().length < 3) {
    errors.push("Username must be at least 3 characters");
  }
  if (!email || !email.includes("@")) {
    errors.push("Valid email is required");
  }
  if (!phone || phone.length < 10) {
    errors.push("Valid phone number is required");
  }
  if (!password || password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  return errors;
};

const saveSession = (session: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    session.save((err: any) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const getUserIdFromRequest = async (req: any): Promise<number | null> => {
  // 먼저 세션에서 userId 확인
  if (req.session.userId) {
    return req.session.userId;
  }

  // authorization 헤더에서 세션 ID 추출
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  // Bearer 스키마를 사용하여 세션 ID 추출
  const sessionId = authHeader.replace(/^Bearer\s+/i, "");

  // 세션 스토어에서 세션 조회
  return new Promise((resolve) => {
    req.sessionStore.get(sessionId, (err: any, session: any) => {
      if (err || !session) {
        resolve(null);
      } else {
        resolve(session.userId || null);
      }
    });
  });
};

authRouter.post("/register", async (req, res) => {
  try {
    const { username, email, phone, password } = req.body;

    const validationErrors = validateRegisterInput(
      username,
      email,
      phone,
      password,
    );
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    const existingUsers = await db
      .select({
        username: users.username,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(
        or(
          eq(users.username, username),
          eq(users.email, email),
          eq(users.phone, phone),
        ),
      );

    if (existingUsers.length > 0) {
      const existing = existingUsers[0];
      if (existing.username === username) {
        return res.status(409).json({ message: "Username already taken" });
      }
      if (existing.email === email) {
        return res.status(409).json({ message: "Email already taken" });
      }
      if (existing.phone === phone) {
        return res.status(409).json({ message: "Phone number already taken" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await db.transaction(async (tx) => {
      const result = await tx.insert(users).values({
        username,
        email,
        phone,
        password: hashedPassword,
      });

      const insertId = result[0].insertId;

      const [user] = await tx
        .select(userSelectFields)
        .from(users)
        .where(eq(users.id, insertId))
        .limit(1);

      return user;
    });

    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    await saveSession(req.session);

    res.status(201).json({
      message: "Register successful",
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
      },
      cookie: req.sessionID,
    });
  } catch (error) {
    console.error("Register error:", error);

    if ((error as any).code === "ER_DUP_ENTRY") {
      return res
        .status(409)
        .json({ message: "User information already exists" });
    }

    res.status(500).json({ message: "Registration failed. Please try again." });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username and password are required" });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    req.session.userId = user.id;
    req.session.username = user.username;
    await saveSession(req.session);

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
      cookie: req.sessionID,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
});

authRouter.get("/profile", async (req, res) => {
  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const [user] = await db
      .select(userSelectFields)
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      req.session.destroy(() => {});
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (error) {
    console.error("Profile error:", error);
    res.status(500).json({ message: "Failed to load profile" });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionIdFromAuth = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : null;

    if (sessionIdFromAuth) {
      await new Promise<void>((resolve) => {
        req.sessionStore.destroy(sessionIdFromAuth, () => {
          resolve();
        });
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        req.session.destroy((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.clearCookie("SESSION");
    }

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed. Please try again." });
  }
});

authRouter.get("/check", async (req, res) => {
  try {
    const userId = await getUserIdFromRequest(req);
    const isAuthenticated = !!userId;
    
    let username = req.session.username || null;
    
    if (!username && userId) {
      const authHeader = req.headers.authorization;
      if (authHeader) {
        const sessionId = authHeader.replace(/^Bearer\s+/i, "");
        await new Promise<void>((resolve) => {
          req.sessionStore.get(sessionId, (err: any, session: any) => {
            if (!err && session) {
              username = session.username || null;
            }
            resolve();
          });
        });
      }
    }
    
    res.json({
      authenticated: isAuthenticated,
      userId: userId,
      username: username,
    });
  } catch (error) {
    console.error("Check error:", error);
    res.status(500).json({ message: "Authentication check failed" });
  }
});

export default authRouter;
