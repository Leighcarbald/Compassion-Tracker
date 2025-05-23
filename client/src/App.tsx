import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import Medications from "@/pages/Medications";
import Calendar from "@/pages/Calendar";
import Notes from "@/pages/Notes";
import Doctors from "@/pages/Doctors";
import Pharmacies from "@/pages/Pharmacies";
import EmergencyInfo from "@/pages/EmergencyInfo";
import BloodPressure from "@/pages/BloodPressure";
import GlucoseInsulin from "@/pages/GlucoseInsulin";
import BowelMovements from "@/pages/BowelMovements";
import AuthPage from "@/pages/auth-page";
import ResetPasswordPage from "@/pages/reset-password";
import { useState, lazy, Suspense } from "react";
import { TabType } from "./lib/types";
import { PinAuthProvider } from "@/hooks/use-pin-auth";
import { CareRecipientProvider } from "@/hooks/use-care-recipient";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Loader2 } from "lucide-react";

// Lazily load the Meals and Sleep components since they may not be implemented yet
const Meals = lazy(() => import("@/pages/Meals"));
const Sleep = lazy(() => import("@/pages/Sleep"));

function Router() {
  const [activeTab, setActiveTab] = useState<TabType>("home");

  const renderHome = () => <Home activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderMedications = () => <Medications activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderCalendar = () => <Calendar activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderNotes = () => <Notes activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderDoctors = () => <Doctors activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderPharmacies = () => <Pharmacies activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderEmergencyInfo = () => <EmergencyInfo activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderBloodPressure = () => <BloodPressure activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderGlucoseInsulin = () => <GlucoseInsulin activeTab={activeTab} setActiveTab={setActiveTab} />;
  const renderBowelMovements = () => <BowelMovements activeTab={activeTab} setActiveTab={setActiveTab} />;

  
  const renderMeals = () => (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <Meals activeTab={activeTab} setActiveTab={setActiveTab} />
    </Suspense>
  );
  
  const renderSleep = () => (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <Sleep activeTab={activeTab} setActiveTab={setActiveTab} />
    </Suspense>
  );

  return (
    <div className="app-container">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/">
          <ProtectedRoute>
            {renderHome()}
          </ProtectedRoute>
        </Route>
        <Route path="/medications">
          <ProtectedRoute>
            {renderMedications()}
          </ProtectedRoute>
        </Route>
        <Route path="/calendar">
          <ProtectedRoute>
            {renderCalendar()}
          </ProtectedRoute>
        </Route>
        <Route path="/notes">
          <ProtectedRoute>
            {renderNotes()}
          </ProtectedRoute>
        </Route>
        <Route path="/doctors">
          <ProtectedRoute>
            {renderDoctors()}
          </ProtectedRoute>
        </Route>
        <Route path="/pharmacies">
          <ProtectedRoute>
            {renderPharmacies()}
          </ProtectedRoute>
        </Route>
        <Route path="/emergency-info">
          <ProtectedRoute>
            {renderEmergencyInfo()}
          </ProtectedRoute>
        </Route>
        <Route path="/blood-pressure">
          <ProtectedRoute>
            {renderBloodPressure()}
          </ProtectedRoute>
        </Route>
        <Route path="/glucose-insulin">
          <ProtectedRoute>
            {renderGlucoseInsulin()}
          </ProtectedRoute>
        </Route>
        <Route path="/bowel-movements">
          <ProtectedRoute>
            {renderBowelMovements()}
          </ProtectedRoute>
        </Route>
        <Route path="/meals">
          <ProtectedRoute>
            {renderMeals()}
          </ProtectedRoute>
        </Route>
        <Route path="/sleep">
          <ProtectedRoute>
            {renderSleep()}
          </ProtectedRoute>
        </Route>

        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PinAuthProvider>
          <CareRecipientProvider>
            <Router />
          </CareRecipientProvider>
        </PinAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
