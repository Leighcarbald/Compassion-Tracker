import { Express, Request, Response } from "express";
import { 
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type { 
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/types";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and } from "drizzle-orm";
import crypto from "crypto";

// For WebAuthn-specific data
interface WebAuthnData {
  userId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  createdAt: Date;
}

// Constants for WebAuthn
const RP_NAME = "CaregiverAssist";
const RP_ID = process.env.RPID || (process.env.NODE_ENV === "production" ? process.env.DOMAIN : "localhost");
// In production, ensure this matches the actual domain without protocol
// e.g., app.example.com not https://app.example.com
const EXPECTED_ORIGIN = process.env.NODE_ENV === "production" 
  ? `https://${process.env.DOMAIN}`
  : "http://localhost:5000";

/**
 * Creates WebAuthn endpoints for biometric authentication
 */
export async function setupWebAuthn(app: Express) {
  // Check WebAuthn status (if the user has registered credentials)
  app.get("/api/webauthn/status", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      // Check if this user has any WebAuthn credentials
      const credentials = await db.query.webauthnCredentials.findMany({
        where: eq(schema.webauthnCredentials.userId, req.user.id)
      });
      
      return res.status(200).json({
        registered: credentials.length > 0
      });
    } catch (error) {
      console.error("Error checking WebAuthn status:", error);
      return res.status(500).json({ message: "Failed to check WebAuthn status" });
    }
  });

  // Start WebAuthn registration
  app.get("/api/webauthn/register/start", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = req.user;
    
    try {
      // Get existing credentials for this user to prevent duplicates
      const existingCredentials = await db.query.webauthnCredentials.findMany({
        where: eq(schema.webauthnCredentials.userId, user.id)
      });
      
      // User ID as base64url-encoded version of user.id
      const userId = Buffer.from(String(user.id)).toString('base64url');
      
      // Generate a challenge
      const challenge = crypto.randomBytes(32).toString('base64url');
      
      // Store the challenge in the session
      req.session.currentChallenge = challenge;
      
      // Get the list of existing credential IDs
      const excludeCredentials = existingCredentials.map(cred => ({
        id: Buffer.from(cred.credentialId, 'base64url'),
        type: 'public-key',
        transports: ['internal', 'usb', 'ble', 'nfc'] as const,
      }));
      
      // Generate registration options
      const options = generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: userId,
        userName: user.username,
        userDisplayName: user.name || user.username,
        challenge,
        excludeCredentials,
        attestationType: 'none',
        authenticatorSelection: {
          // Prefer platform authenticators (like Touch ID or Face ID)
          authenticatorAttachment: 'platform',
          requireResidentKey: true,
          // Require biometric verification
          userVerification: 'required',
        },
      });
      
      // Save options to session for verification
      req.session.currentRegistrationOptions = options;
      
      return res.status(200).json({ options });
    } catch (error) {
      console.error("Error starting WebAuthn registration:", error);
      return res.status(500).json({ message: "Failed to start WebAuthn registration" });
    }
  });

  // Finish WebAuthn registration
  app.post("/api/webauthn/register/finish", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = req.user;
      const credential: RegistrationResponseJSON = req.body;
      
      // Get challenge from session
      const challenge = req.session.currentChallenge;
      const expectedOrigin = EXPECTED_ORIGIN;
      
      if (!challenge) {
        return res.status(400).json({ message: "Challenge not found. Please restart registration." });
      }
      
      // Verify the credential
      let verification: VerifiedRegistrationResponse;
      try {
        verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge: challenge,
          expectedOrigin,
          expectedRPID: RP_ID,
        });
      } catch (error) {
        console.error("WebAuthn verification error:", error);
        return res.status(400).json({ message: "Verification failed: " + (error as Error).message });
      }
      
      // Check verification
      if (!verification.verified) {
        return res.status(400).json({ message: "Registration verification failed" });
      }
      
      // Get the authenticator data
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo!;
      
      // Convert to strings for database storage
      const credentialIdString = Buffer.from(credentialID).toString('base64url');
      const publicKeyString = Buffer.from(credentialPublicKey).toString('base64url');
      
      // Store credential in the database
      await db.insert(schema.webauthnCredentials).values({
        userId: user.id,
        credentialId: credentialIdString,
        publicKey: publicKeyString,
        counter: counter,
        transports: credential.response.transports ? credential.response.transports.join(',') : null,
        createdAt: new Date(),
      });
      
      // Clear session data
      delete req.session.currentChallenge;
      delete req.session.currentRegistrationOptions;
      
      return res.status(200).json({ message: "Registration successful" });
    } catch (error) {
      console.error("Error finishing WebAuthn registration:", error);
      return res.status(500).json({ message: "Failed to complete WebAuthn registration" });
    }
  });

  // Start WebAuthn login
  app.get("/api/webauthn/login/start", async (req: Request, res: Response) => {
    try {
      // Generate a challenge
      const challenge = crypto.randomBytes(32).toString('base64url');
      
      // Store the challenge in the session
      req.session.currentChallenge = challenge;
      
      // Generate authentication options
      const options = generateAuthenticationOptions({
        rpID: RP_ID,
        challenge,
        userVerification: 'required', // Require biometric verification
      });
      
      // Save options to session for verification
      req.session.currentAuthenticationOptions = options;
      
      return res.status(200).json({ options });
    } catch (error) {
      console.error("Error starting WebAuthn login:", error);
      return res.status(500).json({ message: "Failed to start WebAuthn login" });
    }
  });

  // Finish WebAuthn login
  app.post("/api/webauthn/login/finish", async (req: Request, res: Response) => {
    try {
      const credential: AuthenticationResponseJSON = req.body;
      
      // Get credential ID from the response
      const credentialId = credential.id;
      
      // Look up the user by credential ID
      const userCredential = await db.query.webauthnCredentials.findFirst({
        where: eq(schema.webauthnCredentials.credentialId, credentialId)
      });
      
      if (!userCredential) {
        return res.status(400).json({ message: "Unknown credential" });
      }
      
      // Get the user
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, userCredential.userId)
      });
      
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
      
      // Get challenge from session
      const challenge = req.session.currentChallenge;
      const expectedOrigin = EXPECTED_ORIGIN;
      
      if (!challenge) {
        return res.status(400).json({ message: "Challenge not found. Please restart login." });
      }
      
      // Get public key from database
      const publicKey = Buffer.from(userCredential.publicKey, 'base64url');
      
      // Verify the credential
      let verification: VerifiedAuthenticationResponse;
      try {
        verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge: challenge,
          expectedOrigin,
          expectedRPID: RP_ID,
          authenticator: {
            credentialPublicKey: publicKey,
            credentialID: Buffer.from(userCredential.credentialId, 'base64url'),
            counter: userCredential.counter,
            transports: userCredential.transports ? userCredential.transports.split(',') as AuthenticatorTransport[] : undefined,
          }
        });
      } catch (error) {
        console.error("WebAuthn verification error:", error);
        return res.status(400).json({ message: "Verification failed: " + (error as Error).message });
      }
      
      // Check verification
      if (!verification.verified) {
        return res.status(400).json({ message: "Authentication verification failed" });
      }
      
      // Update the counter
      await db.update(schema.webauthnCredentials)
        .set({ counter: verification.authenticationInfo.newCounter })
        .where(and(
          eq(schema.webauthnCredentials.userId, userCredential.userId),
          eq(schema.webauthnCredentials.credentialId, userCredential.credentialId)
        ));
      
      // Clear session data
      delete req.session.currentChallenge;
      delete req.session.currentAuthenticationOptions;
      
      // Log the user in
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Failed to log in after successful verification" });
        }
        
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        return res.status(200).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Error finishing WebAuthn login:", error);
      return res.status(500).json({ message: "Failed to complete WebAuthn login" });
    }
  });

  // Delete WebAuthn credential
  app.delete("/api/webauthn/credentials/:id", async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    try {
      const user = req.user;
      const credentialId = req.params.id;
      
      // Delete the credential if it belongs to the user
      await db.delete(schema.webauthnCredentials)
        .where(and(
          eq(schema.webauthnCredentials.userId, user.id),
          eq(schema.webauthnCredentials.credentialId, credentialId)
        ));
      
      return res.status(200).json({ message: "Credential deleted" });
    } catch (error) {
      console.error("Error deleting WebAuthn credential:", error);
      return res.status(500).json({ message: "Failed to delete credential" });
    }
  });
}