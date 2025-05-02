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
import { useState, lazy, Suspense } from "react";
import { TabType } from "./lib/types";
import { PinAuthProvider } from "@/hooks/use-pin-auth";
import { CareRecipientProvider } from "@/hooks/use-care-recipient";
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
        <Route path="/" component={renderHome} />
        <Route path="/medications" component={renderMedications} />
        <Route path="/calendar" component={renderCalendar} />
        <Route path="/notes" component={renderNotes} />
        <Route path="/doctors" component={renderDoctors} />
        <Route path="/pharmacies" component={renderPharmacies} />
        <Route path="/emergency" component={renderEmergencyInfo} />
        <Route path="/blood-pressure" component={renderBloodPressure} />
        <Route path="/glucose-insulin" component={renderGlucoseInsulin} />
        <Route path="/bowel-movements" component={renderBowelMovements} />
        <Route path="/meals" component={renderMeals} />
        <Route path="/sleep" component={renderSleep} />

        <Route component={NotFound} />
      </Switch>
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PinAuthProvider>
        <CareRecipientProvider>
          <Router />
        </CareRecipientProvider>
      </PinAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
