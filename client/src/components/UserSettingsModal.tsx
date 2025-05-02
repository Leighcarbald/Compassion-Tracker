import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Fingerprint, Trash2, UserCog } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

interface UserSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserSettingsModal({ open, onOpenChange }: UserSettingsModalProps) {
  const { 
    user, 
    biometricStatus, 
    registerBiometricMutation,
    logoutMutation
  } = useAuth();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  // Check if biometrics are supported
  const biometricsSupported = biometricStatus.data?.available;
  const hasRegisteredBiometrics = biometricStatus.data?.registered && biometricStatus.data.credentials.length > 0;

  // Handle biometric credential registration
  const handleRegisterBiometric = () => {
    registerBiometricMutation.mutate();
  };

  // Delete biometric credential
  const handleDeleteCredential = async (credentialId: number) => {
    try {
      const response = await fetch(`/api/webauthn/credentials/${credentialId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete credential');
      }
      
      // Refresh biometric status
      biometricStatus.refetch();
      
      // Reset confirmation state
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting credential:', error);
    }
  };

  const handleLogout = () => {
    logoutMutation.mutate();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            User Settings
          </DialogTitle>
          <DialogDescription>
            Manage your account settings and security options.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User info section */}
          <div className="pb-2 border-b">
            <h3 className="text-sm font-medium">Account Information</h3>
            <div className="mt-2 space-y-1">
              <p className="text-sm">
                <span className="font-medium">Username:</span> {user?.username}
              </p>
              {user?.name && (
                <p className="text-sm">
                  <span className="font-medium">Name:</span> {user.name}
                </p>
              )}
              {user?.email && (
                <p className="text-sm">
                  <span className="font-medium">Email:</span> {user.email}
                </p>
              )}
            </div>
          </div>

          {/* Biometric authentication section */}
          <div className="pb-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              Biometric Authentication
            </h3>
            
            {/* Biometrics not supported message */}
            {biometricsSupported === false && (
              <Alert className="mt-2">
                <AlertTitle>Not Available</AlertTitle>
                <AlertDescription>
                  Biometric authentication is not supported on this device or browser.
                </AlertDescription>
              </Alert>
            )}
            
            {/* Biometrics supported but not set up */}
            {biometricsSupported && !hasRegisteredBiometrics && (
              <div className="mt-2">
                <Alert className="mb-2">
                  <AlertTitle>Not Configured</AlertTitle>
                  <AlertDescription>
                    Set up biometric authentication to sign in quickly using your fingerprint or Face ID.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  onClick={handleRegisterBiometric}
                  disabled={registerBiometricMutation.isPending}
                  className="w-full mt-2"
                >
                  {registerBiometricMutation.isPending ? (
                    <>
                      <span className="mr-2">Setting up</span>
                      <Fingerprint className="h-4 w-4 animate-pulse" />
                    </>
                  ) : (
                    <>
                      <Fingerprint className="mr-2 h-4 w-4" />
                      Set up biometric login
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Registered biometric credentials */}
            {hasRegisteredBiometrics && biometricStatus.data?.credentials.length > 0 && (
              <div className="mt-2">
                <p className="text-sm text-muted-foreground mb-2">
                  You have {biometricStatus.data.credentials.length} registered {biometricStatus.data.credentials.length === 1 ? 'device' : 'devices'} for biometric login.
                </p>
                
                <div className="space-y-2">
                  {biometricStatus.data.credentials.map(credential => (
                    <div key={credential.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="text-sm font-medium">Device {credential.id}</p>
                        <p className="text-xs text-muted-foreground">
                          Registered on {format(new Date(credential.created), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {showDeleteConfirm === credential.id ? (
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleDeleteCredential(credential.id)}
                          >
                            Confirm
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setShowDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setShowDeleteConfirm(credential.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                
                <Button 
                  onClick={handleRegisterBiometric}
                  disabled={registerBiometricMutation.isPending}
                  className="w-full mt-4"
                  variant="outline"
                >
                  {registerBiometricMutation.isPending ? (
                    <>
                      <span className="mr-2">Setting up</span>
                      <Fingerprint className="h-4 w-4 animate-pulse" />
                    </>
                  ) : (
                    <>
                      <Fingerprint className="mr-2 h-4 w-4" />
                      Register another device
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button variant="destructive" onClick={handleLogout}>
            Sign out
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}