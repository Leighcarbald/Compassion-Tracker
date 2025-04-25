import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
import rateLimit from "express-rate-limit";

declare global {
  namespace Express {
    interface User extends schema.User {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  // Set up rate limiters to prevent brute force attacks
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 login attempts per windowMs
    message: { message: "Too many login attempts, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 registration attempts per windowMs
    message: { message: "Too many registration attempts, please try again after an hour" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per windowMs
    message: { message: "Too many requests, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Apply the API rate limiter to all api routes
  app.use('/api', apiLimiter);
  
  const PostgresSessionStore = connectPg(session);
  const sessionStore = new PostgresSessionStore({ pool, createTableIfMissing: true });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "caregivers-app-secret-key",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    name: 'caregivers.sid', // Custom name to avoid fingerprinting
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true, // Prevents JavaScript access to cookie
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      sameSite: "lax", // Protects against CSRF
      path: '/', // Only sent to this path
      domain: process.env.NODE_ENV === 'production' ? process.env.DOMAIN : undefined // Only for our domain in production
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await db.query.users.findFirst({
          where: eq(schema.users.username, username)
        });
        
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, id)
      });
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // Password strength validation function
  function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
      return { valid: false, message: "Password must be at least 8 characters long" };
    }
    
    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: "Password must contain at least one uppercase letter" };
    }
    
    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: "Password must contain at least one lowercase letter" };
    }
    
    // Check for at least one number
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: "Password must contain at least one number" };
    }
    
    // Check for at least one special character
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return { valid: false, message: "Password must contain at least one special character" };
    }
    
    return { valid: true };
  }

  app.post("/api/register", registrationLimiter, async (req, res, next) => {
    try {
      const existingUser = await db.query.users.findFirst({
        where: eq(schema.users.username, req.body.username)
      });
      
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Validate password strength
      const passwordValidation = validatePasswordStrength(req.body.password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      const hashedPassword = await hashPassword(req.body.password);
      
      const [user] = await db.insert(schema.users).values({
        ...req.body,
        password: hashedPassword,
      }).returning();

      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", loginLimiter, (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    // Don't send the password back to the client
    const { password, ...userWithoutPassword } = req.user as schema.User;
    res.json(userWithoutPassword);
  });

  // Protected route middleware
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    // In production, require HTTPS
    if (process.env.NODE_ENV === 'production' && !req.secure) {
      return res.status(403).json({ 
        message: "HTTPS required for secure operations"
      });
    }

    if (req.isAuthenticated()) {
      return next();
    }
    
    res.status(401).json({ message: "Not authenticated" });
  };
  
  return { isAuthenticated };
}