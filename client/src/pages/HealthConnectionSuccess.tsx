import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default function HealthConnectionSuccess() {
  const [_, setLocation] = useLocation();
  
  // Auto-redirect after successful connection
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLocation('/health-platforms');
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [setLocation]);
  
  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader>
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-500" />
          </div>
          <CardTitle className="text-center text-2xl">Connection Successful!</CardTitle>
          <CardDescription className="text-center">
            Your health platform has been connected successfully.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground">
            You'll be redirected to the Health Platforms page automatically in a few seconds.
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button onClick={() => setLocation('/health-platforms')}>
            Return to Health Platforms
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}