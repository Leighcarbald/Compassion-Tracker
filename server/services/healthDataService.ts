import { db } from "../../db";
import { eq } from "drizzle-orm";
import { healthDeviceConnections, type HealthDeviceConnection, type Sleep } from "@shared/schema";

// Google OAuth config
// These values would normally come from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NODE_ENV === "production" 
  ? `${process.env.PUBLIC_URL}/api/oauth/google/callback`
  : "http://localhost:3000/api/oauth/google/callback";

// API constants
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_FITNESS_API_URL = "https://www.googleapis.com/fitness/v1/users/me";

// Health data providers
type HealthProvider = 'google' | 'apple' | 'fitbit' | 'samsung' | 'garmin';

/**
 * Generate OAuth authorization URL for a specific health provider
 */
export function getAuthorizationUrl(provider: HealthProvider, careRecipientId: number): string {
  switch(provider) {
    case 'google':
      const scopes = [
        'https://www.googleapis.com/auth/fitness.sleep.read',
        'https://www.googleapis.com/auth/fitness.activity.read',
        'https://www.googleapis.com/auth/fitness.heart_rate.read'
      ].join(' ');
      
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID || '',
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: scopes,
        access_type: 'offline', // Get refresh token
        prompt: 'consent',
        state: JSON.stringify({ careRecipientId, provider })
      });
      
      return `${GOOGLE_AUTH_URL}?${params.toString()}`;
      
    // Implement other providers similarly
    case 'apple':
    case 'fitbit':
    case 'samsung':
    case 'garmin':
      throw new Error(`Provider ${provider} not yet implemented`);
      
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(provider: HealthProvider, code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  providerUserId?: string;
}> {
  switch(provider) {
    case 'google':
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID || '',
          client_secret: GOOGLE_CLIENT_SECRET || '',
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code'
        }).toString()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to exchange code: ${errorData.error_description || errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        // Google doesn't return user ID in token response, we'd need to make a separate call
      };
      
    // Implement other providers similarly
    default:
      throw new Error(`Provider ${provider} not yet implemented`);
  }
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(connection: HealthDeviceConnection): Promise<{
  accessToken: string;
  expiresIn?: number;
}> {
  if (!connection.refreshToken) {
    throw new Error('No refresh token available');
  }
  
  switch(connection.provider) {
    case 'google':
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          refresh_token: connection.refreshToken,
          client_id: GOOGLE_CLIENT_ID || '',
          client_secret: GOOGLE_CLIENT_SECRET || '',
          grant_type: 'refresh_token'
        }).toString()
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to refresh token: ${errorData.error_description || errorData.error || response.statusText}`);
      }
      
      const data = await response.json();
      
      // Update the database with the new token
      await db.update(healthDeviceConnections)
        .set({ 
          accessToken: data.access_token,
          tokenExpiry: new Date(Date.now() + (data.expires_in * 1000)),
          updatedAt: new Date()
        })
        .where(eq(healthDeviceConnections.id, connection.id));
      
      return {
        accessToken: data.access_token,
        expiresIn: data.expires_in
      };
      
    // Implement other providers similarly
    default:
      throw new Error(`Provider ${connection.provider} not yet implemented`);
  }
}

/**
 * Fetch sleep data from Google Fit
 */
export async function fetchGoogleFitSleepData(
  connection: HealthDeviceConnection,
  dateRange: { startTime: Date, endTime: Date }
): Promise<Partial<Sleep>[]> {
  // Check if token needs refresh
  const now = new Date();
  let accessToken = connection.accessToken;
  
  if (connection.tokenExpiry && connection.tokenExpiry < now && connection.refreshToken) {
    const refreshResult = await refreshAccessToken(connection);
    accessToken = refreshResult.accessToken;
  }
  
  // Convert dates to nanoseconds for Google Fit API
  const startTimeNanos = dateRange.startTime.getTime() * 1000000;
  const endTimeNanos = dateRange.endTime.getTime() * 1000000;
  
  // Call Google Fit API to get sleep data
  const response = await fetch(
    `${GOOGLE_FITNESS_API_URL}/dataSources/derived:com.google.sleep.segment:com.google.android.gms:merged/datasets/${startTimeNanos}-${endTimeNanos}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!response.ok) {
    if (response.status === 401) {
      // Token might be invalid, try refreshing again
      const refreshResult = await refreshAccessToken(connection);
      accessToken = refreshResult.accessToken;
      
      // Retry request with new token
      const retryResponse = await fetch(
        `${GOOGLE_FITNESS_API_URL}/dataSources/derived:com.google.sleep.segment:com.google.android.gms:merged/datasets/${startTimeNanos}-${endTimeNanos}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!retryResponse.ok) {
        const errorData = await retryResponse.json();
        throw new Error(`Failed to fetch sleep data: ${errorData.error?.message || retryResponse.statusText}`);
      }
      
      return await processSleepData(retryResponse, connection);
    } else {
      const errorData = await response.json();
      throw new Error(`Failed to fetch sleep data: ${errorData.error?.message || response.statusText}`);
    }
  }
  
  return await processSleepData(response, connection);
}

/**
 * Process sleep data from Google Fit API
 */
async function processSleepData(
  response: Response, 
  connection: HealthDeviceConnection
): Promise<Partial<Sleep>[]> {
  const data = await response.json();
  const sleepSessions: Partial<Sleep>[] = [];
  
  // Google Fit sleep data has a specific format with point arrays
  if (data.point && Array.isArray(data.point)) {
    let currentSession: Partial<Sleep> | null = null;
    
    for (const point of data.point) {
      // Google uses sleep stage values 1-5
      // 1 = Awake, 2 = Sleep, 3 = Out of bed, 4 = Light sleep, 5 = Deep sleep
      const sleepStageValue = point.value?.[0]?.intVal;
      const startTimeNanos = Number(point.startTimeNanos);
      const endTimeNanos = Number(point.endTimeNanos);
      
      // Convert nanoseconds to JavaScript Date
      const startTime = new Date(startTimeNanos / 1000000);
      const endTime = new Date(endTimeNanos / 1000000);
      
      // Skip awake and out of bed stages
      if (sleepStageValue === 1 || sleepStageValue === 3) {
        continue;
      }
      
      // Handle sleep stages
      if (!currentSession) {
        currentSession = {
          startTime: startTime,
          endTime: null,
          careRecipientId: connection.careRecipientId,
          notes: "Imported from Google Fit",
          quality: "good" // Default quality since Google doesn't provide this
        };
      } else {
        // Update end time if this is a continuing sleep session
        currentSession.endTime = endTime;
      }
    }
    
    if (currentSession) {
      sleepSessions.push(currentSession);
    }
  }
  
  // Mark the connection as synced
  await db.update(healthDeviceConnections)
    .set({ 
      lastSynced: new Date(),
      updatedAt: new Date()
    })
    .where(eq(healthDeviceConnections.id, connection.id));
  
  return sleepSessions;
}

/**
 * Save imported sleep data to the database
 */
export async function importSleepData(
  connection: HealthDeviceConnection,
  dateRange: { startTime: Date, endTime: Date }
): Promise<number> {
  try {
    let sleepRecords: Partial<Sleep>[] = [];
    
    switch(connection.provider) {
      case 'google':
        sleepRecords = await fetchGoogleFitSleepData(connection, dateRange);
        break;
      // Handle other providers
      default:
        throw new Error(`Provider ${connection.provider} not yet implemented`);
    }
    
    // TODO: Insert sleep records into database
    // Will be implemented in the storage service
    
    return sleepRecords.length;
  } catch (error) {
    console.error(`Failed to import sleep data: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}

/**
 * Sync sleep data for all active connections
 */
export async function syncAllSleepData(): Promise<{ 
  success: number;
  failed: number;
  errors: string[];
}> {
  const result = {
    success: 0,
    failed: 0,
    errors: [] as string[]
  };
  
  // Get all active connections
  const connections = await db
    .select()
    .from(healthDeviceConnections)
    .where(eq(healthDeviceConnections.syncEnabled, true));
  
  // Set date range to last 7 days
  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - 7);
  
  for (const connection of connections) {
    try {
      const count = await importSleepData(connection, { startTime, endTime });
      result.success += count;
    } catch (error) {
      result.failed++;
      result.errors.push(`Failed to sync connection ID ${connection.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return result;
}