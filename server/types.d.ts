import 'express-session';
import { AuthenticatorTransportFuture, PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';

declare module 'express-session' {
  interface SessionData {
    // Authentication
    verifiedEmergencyInfos?: number[];
    
    // WebAuthn
    currentChallenge?: string;
    currentRegistrationOptions?: PublicKeyCredentialCreationOptionsJSON;
    currentAuthenticationOptions?: PublicKeyCredentialRequestOptionsJSON;
    temporaryUsername?: string;
  }
}