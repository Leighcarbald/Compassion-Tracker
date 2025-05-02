import { Express, Request, Response } from "express";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

const rpName = "CareGiver App";
const rpID = process.env.RP_ID || "localhost";
const origin = process.env.ORIGIN || `https://${rpID}`;
const expectedOrigin = origin;

/**
 * Creates WebAuthn endpoints for biometric authentication
 */
export async function setupWebAuthn(app: Express) {
  // Get user's WebAuthn credentials
  async function getUserCredentials(userId: number) {
    try {
      const credentials = await db.query.webauthnCredentials.findMany({
        where: eq(schema.webauthnCredentials.userId, userId),
      });
      return credentials;
    } catch (error) {
      console.error("Error fetching user credentials:", error);
      return [];
    }
  }

  // Check if user already has WebAuthn credentials
  app.get("/api/webauthn/status", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const credentials = await getUserCredentials(userId);

      res.json({
        enabled: credentials.length > 0,
        credentials: credentials.map(cred => ({
          id: cred.id,
          created: cred.createdAt,
        })),
      });
    } catch (error) {
      console.error("Error checking WebAuthn status:", error);
      res.status(500).json({ message: "Error checking WebAuthn status" });
    }
  });

  // Start registration process
  app.get("/api/webauthn/register/start", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const userName = req.user.name || req.user.username;
      const userID = userId.toString();

      const userCredentials = await getUserCredentials(userId);

      // Generate registration options
      const options = await generateRegistrationOptions({
        rpName,
        rpID,
        userID,
        userName,
        attestationType: "none",
        excludeCredentials: userCredentials.map(cred => ({
          id: Buffer.from(cred.credentialId, "base64"),
          type: "public-key",
          transports: ["internal", "usb", "ble", "nfc"] as AuthenticatorTransportFuture[],
        })),
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "preferred",
          residentKey: "preferred",
        },
      });

      // Save the challenge in the session for later verification
      req.session.currentChallenge = options.challenge;
      req.session.currentRegistrationOptions = options as unknown as PublicKeyCredentialCreationOptionsJSON;

      res.json(options);
    } catch (error) {
      console.error("Error starting WebAuthn registration:", error);
      res.status(500).json({ message: "Error starting WebAuthn registration" });
    }
  });

  // Finish registration
  app.post("/api/webauthn/register/finish", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const userId = req.user.id;
      const expectedChallenge = req.session.currentChallenge;

      if (!expectedChallenge) {
        return res.status(400).json({ message: "Registration session expired" });
      }

      const credential: RegistrationResponseJSON = req.body;

      try {
        // Verify the registration response
        const verification = await verifyRegistrationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin,
          expectedRPID: rpID,
        });

        if (verification.verified && verification.registrationInfo) {
          const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

          // Create a new credential
          await db.insert(schema.webauthnCredentials).values({
            userId,
            credentialId: Buffer.from(credentialID).toString("base64"),
            publicKey: Buffer.from(credentialPublicKey).toString("base64"),
            counter,
            transports: credential.response.transports?.join(","),
          });

          // Clear session data
          req.session.currentChallenge = undefined;
          req.session.currentRegistrationOptions = undefined;

          return res.json({ verified: true });
        } else {
          return res.status(400).json({ message: "Registration verification failed" });
        }
      } catch (error) {
        console.error("Error in verification:", error);
        return res.status(400).json({ message: "Registration verification error", error: error.message });
      }
    } catch (error) {
      console.error("Error finishing WebAuthn registration:", error);
      res.status(500).json({ message: "Error finishing WebAuthn registration" });
    }
  });

  // Start authentication (login)
  app.get("/api/webauthn/login/start", async (req: Request, res: Response) => {
    try {
      const username = req.query.username as string;

      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }

      // Find the user
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get user's credentials
      const userCredentials = await getUserCredentials(user.id);

      if (userCredentials.length === 0) {
        return res.status(400).json({ message: "No WebAuthn credentials found for this user" });
      }

      // Generate authentication options
      const options = await generateAuthenticationOptions({
        rpID,
        allowCredentials: userCredentials.map(cred => ({
          id: Buffer.from(cred.credentialId, "base64"),
          type: "public-key",
          transports: cred.transports?.split(",") as AuthenticatorTransportFuture[],
        })),
        userVerification: "preferred",
      });

      // Save the challenge and user ID in the session
      req.session.currentChallenge = options.challenge;
      req.session.currentAuthenticationOptions = options as unknown as PublicKeyCredentialRequestOptionsJSON;

      // Store the username in the session temporarily
      req.session.temporaryUsername = username;

      res.json(options);
    } catch (error) {
      console.error("Error starting WebAuthn authentication:", error);
      res.status(500).json({ message: "Error starting WebAuthn authentication" });
    }
  });

  // Finish authentication
  app.post("/api/webauthn/login/finish", async (req: Request, res: Response) => {
    try {
      const expectedChallenge = req.session.currentChallenge;
      const username = req.session.temporaryUsername;

      if (!expectedChallenge || !username) {
        return res.status(400).json({ message: "Authentication session expired" });
      }

      // Find the user
      const user = await db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const credential: AuthenticationResponseJSON = req.body;

      // Get the credential from database
      const storedCredential = await db.query.webauthnCredentials.findFirst({
        where: eq(schema.webauthnCredentials.credentialId, credential.id),
      });

      if (!storedCredential) {
        return res.status(400).json({ message: "Credential not found" });
      }

      if (storedCredential.userId !== user.id) {
        return res.status(403).json({ message: "Credential does not belong to this user" });
      }

      try {
        // Verify the authentication response
        const verification = await verifyAuthenticationResponse({
          response: credential,
          expectedChallenge,
          expectedOrigin,
          expectedRPID: rpID,
          authenticator: {
            credentialID: Buffer.from(storedCredential.credentialId, "base64"),
            credentialPublicKey: Buffer.from(storedCredential.publicKey, "base64"),
            counter: storedCredential.counter,
          },
        });

        if (verification.verified) {
          // Update the counter
          await db
            .update(schema.webauthnCredentials)
            .set({ counter: verification.authenticationInfo.newCounter })
            .where(eq(schema.webauthnCredentials.id, storedCredential.id));

          // Log the user in
          req.login(user, (err) => {
            if (err) {
              console.error("Login error:", err);
              return res.status(500).json({ message: "Error during login" });
            }

            // Clear session data
            req.session.currentChallenge = undefined;
            req.session.currentAuthenticationOptions = undefined;
            req.session.temporaryUsername = undefined;

            return res.json({ verified: true, user });
          });
        } else {
          return res.status(400).json({ message: "Authentication verification failed" });
        }
      } catch (error) {
        console.error("Error in authentication verification:", error);
        return res.status(400).json({ message: "Authentication verification error", error: error.message });
      }
    } catch (error) {
      console.error("Error finishing WebAuthn authentication:", error);
      res.status(500).json({ message: "Error finishing WebAuthn authentication" });
    }
  });

  // Delete credential
  app.delete("/api/webauthn/credentials/:id", async (req: Request, res: Response) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const credentialId = parseInt(req.params.id);
      if (isNaN(credentialId)) {
        return res.status(400).json({ message: "Invalid credential ID" });
      }

      // Find the credential
      const credential = await db.query.webauthnCredentials.findFirst({
        where: eq(schema.webauthnCredentials.id, credentialId),
      });

      if (!credential) {
        return res.status(404).json({ message: "Credential not found" });
      }

      // Ensure the credential belongs to the authenticated user
      if (credential.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to delete this credential" });
      }

      // Delete the credential
      await db.delete(schema.webauthnCredentials).where(eq(schema.webauthnCredentials.id, credentialId));

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting WebAuthn credential:", error);
      res.status(500).json({ message: "Error deleting WebAuthn credential" });
    }
  });
}