import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import crypto from 'crypto';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

// Generate a random session secret if one isn't provided in environment
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  log('Generated random SESSION_SECRET for development use', 'security');
  log('For production, set a persistent SESSION_SECRET in your environment variables', 'security');
}

const app = express();

// Apply security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Needed for development
      connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections for development
      imgSrc: ["'self'", "data:", "blob:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
    },
  },
  // Disable for development as it can interfere with hot module reload
  crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
}));

app.use(express.json({ limit: '1mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.SESSION_SECRET)); // Use the same secret for cookies as sessions

// Configure rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: { message: 'Too many requests, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for PIN verification checks
  skip: (req) => req.path.includes('/check-verified')
});

// Apply to all API routes
app.use('/api', apiLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log the full error only in development
    if (app.get('env') === 'development') {
      console.error(`Error (${req.method} ${req.path}):`, err);
    } else {
      // In production, just log the error message without the stack trace
      console.error(`Error (${req.method} ${req.path}): ${message}`);
    }

    // Don't expose error details in production
    const response = {
      message,
      ...(app.get('env') === 'development' && { 
        stack: err.stack,
        details: err.details || err.errors || undefined
      })
    };

    res.status(status).json(response);
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Use the PORT environment variable if available, otherwise use 5000
  // This makes the app compatible with hosting platforms like Render
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  
  // Ensure we log the environment to help with debugging
  log(`Starting server in ${app.get('env')} mode`);
  
  // Log important environment variables (without values)
  log(`Environment variables available: ${Object.keys(process.env)
    .filter(key => !key.includes('KEY') && !key.includes('SECRET') && !key.includes('PASSWORD') && !key.includes('TOKEN'))
    .join(', ')}`);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
