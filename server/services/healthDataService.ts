import { db } from "../../db";
import { eq } from "drizzle-orm";
import { healthDeviceConnections, type HealthDeviceConnection, type Sleep, type BloodPressure, type Glucose, type Insulin } from "@shared/schema";
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import axios from 'axios';
import qs from 'qs';
import { jwtDecode } from 'jwt-decode';

// Google OAuth config
// These values would normally come from environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NODE_ENV === "production" 
  ? `${process.env.PUBLIC_URL}/api/oauth/google/callback`
  : "http://localhost:3000/api/oauth/google/callback";

// Apple Health config
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID;
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_PRIVATE_KEY = process.env.APPLE_PRIVATE_KEY;
const APPLE_REDIRECT_URI = process.env.NODE_ENV === "production"
  ? `${process.env.PUBLIC_URL}/api/oauth/apple/callback`
  : "http://localhost:3000/api/oauth/apple/callback";

// API constants
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_FITNESS_API_URL = "https://www.googleapis.com/fitness/v1/users/me";

const APPLE_AUTH_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_HEALTH_API_URL = "https://api.apple.com/healthkit/v1";

// Fitbit constants
const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
const FITBIT_AUTH_URL = "https://www.fitbit.com/oauth2/authorize";
const FITBIT_TOKEN_URL = "https://api.fitbit.com/oauth2/token";
const FITBIT_API_URL = "https://api.fitbit.com/1";
const FITBIT_REDIRECT_URI = process.env.NODE_ENV === "production"
  ? `${process.env.PUBLIC_URL}/api/oauth/fitbit/callback`
  : "http://localhost:3000/api/oauth/fitbit/callback";

// Health data providers
type HealthProvider = 'google' | 'apple' | 'fitbit' | 'samsung' | 'garmin';

// Health data types
type HealthDataType = 'sleep' | 'bloodPressure' | 'glucose' | 'heartRate' | 'activity';

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
      
    // Apple Health OAuth flow
    case 'apple':
      const appleScopes = [
        'name',
        'email',
        'healthkit'
      ].join(' ');
      
      const appleParams = new URLSearchParams({
        client_id: APPLE_CLIENT_ID || '',
        redirect_uri: APPLE_REDIRECT_URI,
        response_type: 'code',
        scope: appleScopes,
        response_mode: 'form_post',
        state: JSON.stringify({ careRecipientId, provider })
      });
      
      return `${APPLE_AUTH_URL}?${appleParams.toString()}`;
      
    case 'fitbit':
      const fitbitScopes = [
        'sleep', 
        'heartrate',
        'activity',
        'profile'
      ].join(' ');
      
      const fitbitParams = new URLSearchParams({
        client_id: FITBIT_CLIENT_ID || '',
        redirect_uri: FITBIT_REDIRECT_URI,
        response_type: 'code',
        scope: fitbitScopes,
        state: JSON.stringify({ careRecipientId, provider })
      });
      
      return `${FITBIT_AUTH_URL}?${fitbitParams.toString()}`;
      
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
      
    case 'apple':
      // For Apple Sign-In we need to make a POST request
      try {
        const response = await axios.post(APPLE_TOKEN_URL, qs.stringify({
          client_id: APPLE_CLIENT_ID || '',
          client_secret: generateAppleClientSecret(),
          grant_type: 'authorization_code',
          code,
          redirect_uri: APPLE_REDIRECT_URI
        }), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        const data = response.data;
        
        // Parse ID token to extract user info
        const idToken = data.id_token;
        let userId = '';
        
        if (idToken) {
          try {
            const decoded: any = jwtDecode(idToken);
            userId = decoded.sub || '';
          } catch (decodeError) {
            console.error('Failed to decode Apple ID token:', decodeError);
          }
        }
        
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          providerUserId: userId
        };
        
      } catch (error) {
        console.error('Apple token exchange error:', error);
        if (axios.isAxiosError(error) && error.response) {
          throw new Error(`Failed to exchange Apple code: ${error.response.data?.error || error.message}`);
        }
        throw new Error(`Failed to exchange Apple code: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    case 'fitbit':
      try {
        // Fitbit requires Basic auth with client_id:client_secret base64 encoded
        const authHeader = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64');
        
        const response = await axios.post(FITBIT_TOKEN_URL, qs.stringify({
          code,
          grant_type: 'authorization_code',
          redirect_uri: FITBIT_REDIRECT_URI
        }), {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        const data = response.data;
        
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresIn: data.expires_in,
          providerUserId: data.user_id
        };
      } catch (error) {
        console.error('Fitbit token exchange error:', error);
        if (axios.isAxiosError(error) && error.response) {
          throw new Error(`Failed to exchange Fitbit code: ${error.response.data?.errors?.[0]?.message || error.response.data?.error || error.message}`);
        }
        throw new Error(`Failed to exchange Fitbit code: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    default:
      throw new Error(`Provider ${provider} not yet implemented`);
  }
}

/**
 * Generate a client secret for Apple Auth
 * This is required for token requests to Apple
 */
function generateAppleClientSecret(): string {
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) {
    throw new Error('Apple authentication credentials not configured');
  }
  
  // In a real implementation, we would use JWT to sign a token with the private key
  // However, for this demo we're returning a placeholder
  // This should be implemented with proper JWT signing in production
  
  // Example implementation using jose package:
  // const now = Math.floor(Date.now() / 1000);
  // const token = jwt.sign({
  //   iss: APPLE_TEAM_ID,
  //   iat: now,
  //   exp: now + 15777000, // 6 months
  //   aud: 'https://appleid.apple.com',
  //   sub: APPLE_CLIENT_ID
  // }, APPLE_PRIVATE_KEY, {
  //   algorithm: 'ES256',
  //   header: {
  //     alg: 'ES256',
  //     kid: APPLE_KEY_ID
  //   }
  // });
  
  // Return a placeholder
  return 'apple_client_secret_would_be_generated_here';
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
      
    case 'fitbit':
      try {
        // Fitbit requires Basic auth with client_id:client_secret base64 encoded
        const authHeader = Buffer.from(`${FITBIT_CLIENT_ID}:${FITBIT_CLIENT_SECRET}`).toString('base64');
        
        const response = await axios.post(FITBIT_TOKEN_URL, qs.stringify({
          refresh_token: connection.refreshToken,
          grant_type: 'refresh_token'
        }), {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        const data = response.data;
        
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
      } catch (error) {
        console.error('Fitbit token refresh error:', error);
        if (axios.isAxiosError(error) && error.response) {
          throw new Error(`Failed to refresh Fitbit token: ${error.response.data?.errors?.[0]?.message || error.response.data?.error || error.message}`);
        }
        throw new Error(`Failed to refresh Fitbit token: ${error instanceof Error ? error.message : String(error)}`);
      }
      
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
 * Fetch blood pressure data from Google Fit
 */
export async function fetchGoogleFitBloodPressureData(
  connection: HealthDeviceConnection,
  dateRange: { startTime: Date, endTime: Date }
): Promise<Partial<BloodPressure>[]> {
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
  
  // Call Google Fit API to get blood pressure data
  // Blood pressure data in Google Fit is stored under two data types:
  // 1. com.google.blood_pressure - for systolic and diastolic values
  // 2. com.google.oxygen_saturation - for SpO2 values
  
  // First fetch blood pressure readings
  const bpResponse = await fetch(
    `${GOOGLE_FITNESS_API_URL}/dataSources/derived:com.google.blood_pressure:com.google.android.gms:merged/datasets/${startTimeNanos}-${endTimeNanos}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  if (!bpResponse.ok) {
    if (bpResponse.status === 401) {
      // Token might be invalid, try refreshing again
      const refreshResult = await refreshAccessToken(connection);
      accessToken = refreshResult.accessToken;
      
      // Retry request with new token
      const retryResponse = await fetch(
        `${GOOGLE_FITNESS_API_URL}/dataSources/derived:com.google.blood_pressure:com.google.android.gms:merged/datasets/${startTimeNanos}-${endTimeNanos}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (!retryResponse.ok) {
        const errorData = await retryResponse.json();
        throw new Error(`Failed to fetch blood pressure data: ${errorData.error?.message || retryResponse.statusText}`);
      }
      
      return await processBloodPressureData(retryResponse, connection);
    } else {
      const errorData = await bpResponse.json();
      throw new Error(`Failed to fetch blood pressure data: ${errorData.error?.message || bpResponse.statusText}`);
    }
  }
  
  return await processBloodPressureData(bpResponse, connection);
}

/**
 * Process blood pressure data from Google Fit API
 */
async function processBloodPressureData(
  response: Response, 
  connection: HealthDeviceConnection
): Promise<Partial<BloodPressure>[]> {
  const data = await response.json();
  const bpReadings: Partial<BloodPressure>[] = [];
  
  // Google Fit blood pressure data has a specific format with point arrays
  if (data.point && Array.isArray(data.point)) {
    for (const point of data.point) {
      const startTimeNanos = Number(point.startTimeNanos);
      const endTimeNanos = Number(point.endTimeNanos);
      const startTime = new Date(startTimeNanos / 1000000);
      
      // In Google Fit, blood pressure readings have systolic and diastolic values
      // They're stored as values[0].fpVal and values[1].fpVal
      if (point.value && point.value.length >= 2) {
        const systolic = Math.round(point.value[0]?.fpVal || 0);
        const diastolic = Math.round(point.value[1]?.fpVal || 0);
        
        if (systolic > 0 && diastolic > 0) {
          bpReadings.push({
            careRecipientId: connection.careRecipientId,
            systolic,
            diastolic,
            oxygenLevel: null,  // Google Fit stores SpO2 in a separate data stream
            pulse: null,        // Pulse is typically not included in the blood pressure reading
            notes: "Imported from Google Fit",
            timestamp: startTime
          });
        }
      }
    }
  }
  
  // Mark the connection as synced
  await db.update(healthDeviceConnections)
    .set({ 
      lastSynced: new Date(),
      updatedAt: new Date()
    })
    .where(eq(healthDeviceConnections.id, connection.id));
  
  return bpReadings;
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
 * Save imported blood pressure data to the database
 */
export async function importBloodPressureData(
  connection: HealthDeviceConnection,
  dateRange: { startTime: Date, endTime: Date }
): Promise<number> {
  try {
    let bpRecords: Partial<BloodPressure>[] = [];
    
    switch(connection.provider) {
      case 'google':
        bpRecords = await fetchGoogleFitBloodPressureData(connection, dateRange);
        break;
      // Handle other providers
      default:
        throw new Error(`Provider ${connection.provider} not yet implemented`);
    }
    
    // TODO: Insert blood pressure records into database
    // Will be implemented in the storage service
    
    return bpRecords.length;
  } catch (error) {
    console.error(`Failed to import blood pressure data: ${error instanceof Error ? error.message : error}`);
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
      result.errors.push(`Failed to sync sleep data for connection ID ${connection.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return result;
}

/**
 * Sync blood pressure data for all active connections
 */
export async function syncAllBloodPressureData(): Promise<{ 
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
  
  // Set date range to last 30 days (blood pressure readings are less frequent)
  const endTime = new Date();
  const startTime = new Date();
  startTime.setDate(startTime.getDate() - 30);
  
  for (const connection of connections) {
    try {
      const count = await importBloodPressureData(connection, { startTime, endTime });
      result.success += count;
    } catch (error) {
      result.failed++;
      result.errors.push(`Failed to sync blood pressure data for connection ID ${connection.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  return result;
}

/**
 * Sync all available health data types for all active connections
 */
export async function syncAllHealthData(): Promise<{
  sleep: { success: number; failed: number; errors: string[] };
  bloodPressure: { success: number; failed: number; errors: string[] };
}> {
  const sleepResult = await syncAllSleepData();
  const bloodPressureResult = await syncAllBloodPressureData();
  
  return {
    sleep: sleepResult,
    bloodPressure: bloodPressureResult
  };
}