import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { EmergencyAuthProvider } from "@/hooks/use-emergency-auth";
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
import { useState } from "react";
import { TabType } from "./lib/types";

function Router() {
  const [activeTab, setActiveTab] = useState<TabType>("home");

  return (
    <div className="app-container">
      <Switch>
        <Route path="/">
          <Home activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/medications">
          <Medications activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/calendar">
          <Calendar activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/notes">
          <Notes activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/doctors">
          <Doctors activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/pharmacies">
          <Pharmacies activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/emergency">
          <EmergencyInfo activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/blood-pressure">
          <BloodPressure activeTab={activeTab} setActiveTab={setActiveTab} />
        </Route>
        <Route path="/glucose-insulin">
          <GlucoseInsulin activeTab={activeTab} setActiveTab={setActiveTab} />
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
      <EmergencyAuthProvider>
        <Router />
      </EmergencyAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
