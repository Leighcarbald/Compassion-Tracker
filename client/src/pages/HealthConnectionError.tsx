import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function HealthConnectionError() {
  const [location, setLocation] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Extract error message from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.substring(location.indexOf('?')));
    const message = params.get('message');
    setErrorMessage(message || 'Unknown error occurred while connecting to the health platform.');
  }, [location]);
  
  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-destructive" />
          </div>
          <CardTitle className="text-center text-2xl">Connection Failed</CardTitle>
          <CardDescription className="text-center">
            There was a problem connecting to your health platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error details</AlertTitle>
            <AlertDescription>
              {errorMessage}
            </AlertDescription>
          </Alert>
          <p className="text-center text-muted-foreground">
            Please try again or contact support if the problem persists.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center space-x-4">
          <Button variant="outline" onClick={() => setLocation('/health-platforms')}>
            Return to Health Platforms
          </Button>
          <Button onClick={() => window.history.back()}>
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}