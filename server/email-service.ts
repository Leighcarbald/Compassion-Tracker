import nodemailer from 'nodemailer';
import { randomBytes } from 'crypto';

// Store password reset tokens in memory (in production, use Redis or database)
const resetTokens = new Map<string, { userId: number; expires: Date }>();

export function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export function storeResetToken(token: string, userId: number): void {
  const expires = new Date();
  expires.setHours(expires.getHours() + 1); // Token expires in 1 hour
  resetTokens.set(token, { userId, expires });
}

export function validateResetToken(token: string): number | null {
  const tokenData = resetTokens.get(token);
  if (!tokenData || tokenData.expires < new Date()) {
    if (tokenData) resetTokens.delete(token); // Clean up expired token
    return null;
  }
  return tokenData.userId;
}

export function removeResetToken(token: string): void {
  resetTokens.delete(token);
}

export async function sendPasswordResetEmail(
  userEmail: string, 
  username: string, 
  resetToken: string
): Promise<boolean> {
  try {
    // Create transporter for Google Workspace
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_FROM, // Your Google Workspace email
        pass: process.env.EMAIL_APP_PASSWORD, // App-specific password
      },
    });

    const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/reset-password?token=${resetToken}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: 'Compassion Tracker - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello <strong>${username}</strong>,</p>
          <p>You requested a password reset for your Compassion Tracker account.</p>
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            This is an automated message from Compassion Tracker. Please do not reply to this email.
          </p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}