import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Fingerprint, User, LogIn, UserPlus, Mail, Lock, BadgeInfo, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";

// Form validation schemas
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, "Password must contain at least one special character"),
});

const biometricLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;
type BiometricLoginFormValues = z.infer<typeof biometricLoginSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [webAuthnSupported, setWebAuthnSupported] = useState<boolean | null>(null);
  
  const { 
    user, 
    loginMutation, 
    registerMutation, 
    biometricStatus, 
    loginWithBiometricMutation,
    biometricUsername,
    setBiometricUsername,
    registerBiometricMutation
  } = useAuth();

  // Check if WebAuthn is supported
  useEffect(() => {
    async function checkWebAuthnSupport() {
      const supported = await browserSupportsWebAuthn();
      setWebAuthnSupported(supported);
    }
    checkWebAuthnSupport();
  }, []);

  // Login form setup
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // Register form setup
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      username: "",
      password: "",
    },
  });

  // Biometric login form setup
  const biometricLoginForm = useForm<BiometricLoginFormValues>({
    resolver: zodResolver(biometricLoginSchema),
    defaultValues: {
      username: biometricUsername || "",
    },
  });

  // Update biometric login form when biometricUsername changes
  useEffect(() => {
    if (biometricUsername) {
      biometricLoginForm.setValue("username", biometricUsername);
    }
  }, [biometricUsername, biometricLoginForm]);

  // Handle form submissions
  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
    
    // Store the username for potential biometric login
    setBiometricUsername(data.username);
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };

  const onBiometricLoginSubmit = (data: BiometricLoginFormValues) => {
    setBiometricUsername(data.username);
    loginWithBiometricMutation.mutate({ username: data.username });
  };

  // If user is already logged in, redirect to home
  if (user) {
    return <Redirect to="/" />;
  }

  // Show biometric button only if it's available on this device
  const showBiometricOption = webAuthnSupported;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Left side - Auth form */}
      <div className="w-full md:w-1/2 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold">Welcome to CaregiverAssist</CardTitle>
            <CardDescription>
              Sign in to manage your caregiving tasks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" className="flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </TabsTrigger>
                <TabsTrigger value="register" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  <span>Register</span>
                </TabsTrigger>
              </TabsList>

              {/* Login Form */}
              <TabsContent value="login" className="space-y-4">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input 
                                placeholder="Enter your username" 
                                className="pl-10" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="password" 
                                placeholder="Enter your password" 
                                className="pl-10" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? (
                        <>
                          <span className="mr-2">Signing in</span>
                          <Fingerprint className="h-4 w-4 animate-pulse" />
                        </>
                      ) : (
                        "Sign in"
                      )}
                    </Button>
                  </form>
                </Form>

                {/* Biometric Login Button & Form */}
                {showBiometricOption && (
                  <div className="pt-2">
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-white px-2 text-gray-500">Or</span>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <Form {...biometricLoginForm}>
                        <form onSubmit={biometricLoginForm.handleSubmit(onBiometricLoginSubmit)} className="space-y-4">
                          <FormField
                            control={biometricLoginForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Username for Biometric Login</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                      placeholder="Enter your username" 
                                      className="pl-10" 
                                      {...field} 
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button 
                            type="submit" 
                            variant="outline" 
                            className="w-full" 
                            disabled={loginWithBiometricMutation.isPending}
                          >
                            {loginWithBiometricMutation.isPending ? (
                              <>
                                <span className="mr-2">Verifying</span>
                                <Fingerprint className="h-4 w-4 animate-pulse" />
                              </>
                            ) : (
                              <>
                                <Fingerprint className="mr-2 h-4 w-4" />
                                Sign in with biometrics
                              </>
                            )}
                          </Button>
                        </form>
                      </Form>
                    </div>
                  </div>
                )}

                {/* WebAuthn Not Supported */}
                {webAuthnSupported === false && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Biometric login unavailable</AlertTitle>
                    <AlertDescription>
                      Your browser does not support biometric authentication. Please use username and password.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {/* Register Form */}
              <TabsContent value="register" className="space-y-4">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input 
                                placeholder="Enter your full name" 
                                className="pl-10" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="email" 
                                placeholder="Enter your email" 
                                className="pl-10" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <BadgeInfo className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input 
                                placeholder="Choose a username" 
                                className="pl-10" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                              <Input 
                                type="password" 
                                placeholder="Create a password" 
                                className="pl-10" 
                                {...field} 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <span className="mr-2">Creating account</span>
                          <Fingerprint className="h-4 w-4 animate-pulse" />
                        </>
                      ) : (
                        "Create account"
                      )}
                    </Button>
                  </form>
                </Form>

                {/* Show information about biometric setup */}
                {webAuthnSupported && (
                  <Alert className="mt-4">
                    <Fingerprint className="h-4 w-4" />
                    <AlertTitle>Biometric login available</AlertTitle>
                    <AlertDescription>
                      After creating your account, you can set up biometric authentication (fingerprint/Face ID) from your profile.
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>

              {/* Add register biometric option for logged in users */}
              {user && biometricStatus.data?.available && !biometricStatus.data?.registered && (
                <TabsContent value="setup-biometric" className="space-y-4">
                  <Alert className="mb-4">
                    <Fingerprint className="h-4 w-4" />
                    <AlertTitle>Set up biometric authentication</AlertTitle>
                    <AlertDescription>
                      Register your device's biometric authentication (fingerprint/Face ID) for faster login.
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    onClick={() => registerBiometricMutation.mutate()}
                    className="w-full"
                    disabled={registerBiometricMutation.isPending}
                  >
                    {registerBiometricMutation.isPending ? (
                      <>
                        <span className="mr-2">Setting up</span>
                        <Fingerprint className="h-4 w-4 animate-pulse" />
                      </>
                    ) : (
                      <>
                        <Fingerprint className="mr-2 h-4 w-4" />
                        Enable biometric login
                      </>
                    )}
                  </Button>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Right side - Hero section */}
      <div className="hidden md:block md:w-1/2 bg-gradient-to-br from-primary to-primary-dark p-12 text-white flex flex-col justify-center">
        <div className="max-w-md space-y-6">
          <h1 className="text-4xl font-bold leading-tight">
            Streamline your caregiving with Compassion Tracker
          </h1>
          <p className="text-lg">
            Manage medications, track appointments, monitor vital signs, and keep all your caregiving information organized in one secure place.
          </p>

          <div className="space-y-4 mt-8">
            <div className="flex items-start space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <Fingerprint className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Secure biometric login</h3>
                <p className="text-sm text-white/80">
                  Access your account quickly and securely with your device's fingerprint or Face ID.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <User className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Personalized care management</h3>
                <p className="text-sm text-white/80">
                  Track multiple care recipients with color coding and personalized profiles.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="bg-white/20 p-2 rounded-full">
                <LogIn className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold">Seamless access</h3>
                <p className="text-sm text-white/80">
                  Your data syncs across devices for easy access wherever you are.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}