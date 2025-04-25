// Define types used across the application

export type TabType = "home" | "medications" | "calendar" | "notes" | "doctors" | "pharmacies" | "emergency";

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
  details?: string;
  completed?: boolean;
}

export interface DailyStats {
  medications: {
    completed: number;
    total: number;
    progress: number;
  };
  meals: {
    completed: number;
    total: number;
    progress: number;
  };
  bowelMovement: {
    lastTime: string;
  };
  supplies: {
    depends: number;
  };
  sleep: {
    duration: string;
    quality: string;
  };
}
