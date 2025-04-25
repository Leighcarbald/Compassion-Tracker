import 'express-session';

declare module 'express-session' {
  interface SessionData {
    // Add custom session properties here
    verifiedEmergencyInfos?: number[];
  }
}