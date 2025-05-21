// Define types used across the application

export type TabType = "home" | "medications" | "calendar" | "notes" | "doctors" | "pharmacies" | "emergency" | "blood-pressure" | "glucose-insulin" | "bowel-movements" | "meals" | "sleep";

export interface ToastData {
  title: string;
  description: string;
  type: "default" | "success" | "error" | "warning";
}

export interface EventData {
  id: string;
  type: "medication" | "meal" | "appointment" | "bowel" | "sleep";
  title: string;
  time: string;
  date: string;
  details?: string;
  notes?: string;
  source: "schedule" | "manual";
  canEdit?: boolean;
  reminder?: boolean;
  completed?: boolean;
  scheduledFor?: string;
}

export interface DailyStats {
  medications: {
    completed: number;
    total: number;
    progress: number;
    logs?: any[];
  };
  meals: {
    completed: number;
    total: number;
    progress: number;
    logs?: any[];
  };
  bowelMovement: {
    lastTime: string;
  };
  bowelMovements?: any[];
  supplies: {
    depends: number;
  };
  sleep: {
    duration: string;
    quality: string;
  };
  sleepRecords?: any[];
  bloodPressure?: Array<{
    systolic: number;
    diastolic: number;
    pulse: number;
    timeOfReading: string;
    oxygenLevel?: number;
  }>;
  glucose?: Array<{
    level: number;
    timeOfReading: string;
    whenTaken: string;
    readingType?: string;
  }>;
  insulin?: Array<{
    units: number;
    timeAdministered: string;
    insulinType?: string;
  }>;
  notes?: any[];
}
