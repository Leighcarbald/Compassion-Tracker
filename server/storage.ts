import { db } from "@db";
import { eq, and, lt, gte, desc, sql } from "drizzle-orm";
import {
  users,
  careRecipients,
  medications,
  medicationSchedules,
  medicationLogs,
  appointments,
  meals,
  bowelMovements,
  supplies,
  supplyUsages,
  sleep,
  notes,
  inspirationMessages,
  insertUserSchema,
  insertCareRecipientSchema,
  insertMedicationSchema,
  insertMedicationScheduleSchema,
  insertMedicationLogSchema,
  insertAppointmentSchema,
  insertMealSchema,
  insertBowelMovementSchema,
  insertSupplySchema,
  insertSupplyUsageSchema,
  insertSleepSchema,
  insertNoteSchema,
  insertInspirationMessageSchema
} from "@shared/schema";
import { format, startOfDay, endOfDay, addHours, formatDistance } from "date-fns";

// Helper function to get today's date range
const getTodayDateRange = () => {
  const today = new Date();
  return {
    start: startOfDay(today),
    end: endOfDay(today)
  };
};

export const storage = {
  // Users
  async createUser(userData: any) {
    const validatedData = insertUserSchema.parse(userData);
    const [newUser] = await db.insert(users).values(validatedData).returning();
    return newUser;
  },

  // Care Recipients
  async getCareRecipients() {
    return db.query.careRecipients.findMany({
      orderBy: desc(careRecipients.createdAt)
    });
  },

  async createCareRecipient(recipientData: any) {
    const validatedData = insertCareRecipientSchema.parse(recipientData);
    const [newRecipient] = await db.insert(careRecipients).values(validatedData).returning();
    return newRecipient;
  },

  // Today's Stats
  async getTodayStats(careRecipientId: number) {
    const { start, end } = getTodayDateRange();
    
    // Get medication stats
    const medicationCount = await db.query.medicationSchedules.findMany({
      where: eq(medicationSchedules.medicationId, sql`
        SELECT id FROM ${medications} 
        WHERE ${medications.careRecipientId} = ${careRecipientId}
      `),
      with: {
        medication: true
      }
    });
    
    const takenMedications = await db.query.medicationLogs.findMany({
      where: and(
        eq(medicationLogs.careRecipientId, careRecipientId),
        gte(medicationLogs.takenAt, start),
        lt(medicationLogs.takenAt, end)
      )
    });
    
    // Get meal stats
    const mealTypes = ["breakfast", "lunch", "dinner"];
    const todayMeals = await db.query.meals.findMany({
      where: and(
        eq(meals.careRecipientId, careRecipientId),
        gte(meals.consumedAt, start),
        lt(meals.consumedAt, end)
      )
    });
    
    // Get bowel movement stats
    const lastBowelMovement = await db.query.bowelMovements.findFirst({
      where: eq(bowelMovements.careRecipientId, careRecipientId),
      orderBy: desc(bowelMovements.occuredAt)
    });
    
    // Get depends supply
    const dependsSupply = await db.query.supplies.findFirst({
      where: and(
        eq(supplies.careRecipientId, careRecipientId),
        eq(supplies.name, "Depends")
      )
    });
    
    // Get sleep stats
    const lastSleep = await db.query.sleep.findFirst({
      where: eq(sleep.careRecipientId, careRecipientId),
      orderBy: desc(sleep.startTime)
    });
    
    return {
      medications: {
        completed: takenMedications.length,
        total: medicationCount.length,
        progress: medicationCount.length > 0 
          ? Math.round((takenMedications.length / medicationCount.length) * 100) 
          : 0
      },
      meals: {
        completed: todayMeals.length,
        total: mealTypes.length,
        progress: Math.round((todayMeals.length / mealTypes.length) * 100)
      },
      bowelMovement: {
        lastTime: lastBowelMovement 
          ? formatDistance(new Date(lastBowelMovement.occuredAt), new Date(), { addSuffix: true }) 
          : "None recorded"
      },
      supplies: {
        depends: dependsSupply?.quantity || 0
      },
      sleep: {
        duration: lastSleep && lastSleep.endTime 
          ? this.calculateSleepDuration(lastSleep.startTime, lastSleep.endTime) 
          : "No data",
        quality: lastSleep?.quality || ""
      }
    };
  },

  // Calculate sleep duration in hours
  calculateSleepDuration(startTime: Date, endTime: Date | null) {
    if (!endTime) return "In progress";
    
    // Calculate difference in milliseconds
    const diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    
    // Convert to hours
    const hours = diffMs / (1000 * 60 * 60);
    
    // Format as X.Y hrs
    return `${hours.toFixed(1)} hrs`;
  },

  // Upcoming Events
  async getUpcomingEvents(careRecipientId: number) {
    const now = new Date();
    const endOfToday = endOfDay(now);
    
    // Get upcoming medication schedules
    const medicationEvents = await db.query.medicationSchedules.findMany({
      where: eq(medicationSchedules.medicationId, sql`
        SELECT id FROM ${medications} 
        WHERE ${medications.careRecipientId} = ${careRecipientId}
      `),
      with: {
        medication: true
      },
      limit: 3
    });
    
    // Get upcoming appointments
    const appointmentEvents = await db.query.appointments.findMany({
      where: and(
        eq(appointments.careRecipientId, careRecipientId),
        gte(appointments.date, format(now, 'yyyy-MM-dd'))
      ),
      orderBy: appointments.date,
      limit: 3
    });
    
    // Combine and format events
    const events = [
      ...medicationEvents.map(schedule => ({
        id: `med_${schedule.id}`,
        type: 'medication',
        title: schedule.medication.name,
        time: schedule.time,
        details: `${schedule.quantity} ${schedule.withFood ? 'with food' : ''}`
      })),
      ...appointmentEvents.map(appointment => ({
        id: `apt_${appointment.id}`,
        type: 'appointment',
        title: appointment.title,
        time: appointment.time,
        details: appointment.location
      }))
    ];
    
    // Sort by time
    return events.sort((a, b) => {
      return new Date(`${format(now, 'yyyy-MM-dd')}T${a.time}`).getTime() - 
             new Date(`${format(now, 'yyyy-MM-dd')}T${b.time}`).getTime();
    }).slice(0, 3);
  },

  // Medications
  async getMedications(careRecipientId: number, filter: string = 'today') {
    const { start, end } = getTodayDateRange();
    
    return db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId),
      with: {
        schedules: true
      }
    });
  },

  async createMedication(medicationData: any) {
    const validatedData = insertMedicationSchema.parse(medicationData);
    const [newMedication] = await db.insert(medications).values(validatedData).returning();
    return newMedication;
  },

  // Medication Logs
  async getMedicationLogs(careRecipientId: number) {
    return db.query.medicationLogs.findMany({
      where: eq(medicationLogs.careRecipientId, careRecipientId),
      orderBy: desc(medicationLogs.takenAt),
      limit: 10
    });
  },

  async createMedicationLog(logData: any) {
    const validatedData = insertMedicationLogSchema.parse(logData);
    const [newLog] = await db.insert(medicationLogs).values(validatedData).returning();
    return newLog;
  },

  // Appointments
  async getAppointments(careRecipientId: number, date?: string) {
    if (date) {
      return db.query.appointments.findMany({
        where: and(
          eq(appointments.careRecipientId, careRecipientId),
          eq(appointments.date, date)
        ),
        orderBy: appointments.time
      });
    }
    
    return db.query.appointments.findMany({
      where: eq(appointments.careRecipientId, careRecipientId),
      orderBy: [appointments.date, appointments.time]
    });
  },

  async createAppointment(appointmentData: any) {
    const validatedData = insertAppointmentSchema.parse(appointmentData);
    const [newAppointment] = await db.insert(appointments).values(validatedData).returning();
    return newAppointment;
  },

  // Meals
  async getMeals(careRecipientId: number) {
    const { start, end } = getTodayDateRange();
    
    return db.query.meals.findMany({
      where: and(
        eq(meals.careRecipientId, careRecipientId),
        gte(meals.consumedAt, start),
        lt(meals.consumedAt, end)
      ),
      orderBy: desc(meals.consumedAt)
    });
  },

  async createMeal(mealData: any) {
    const validatedData = insertMealSchema.parse(mealData);
    const [newMeal] = await db.insert(meals).values(validatedData).returning();
    return newMeal;
  },

  // Bowel Movements
  async getBowelMovements(careRecipientId: number) {
    return db.query.bowelMovements.findMany({
      where: eq(bowelMovements.careRecipientId, careRecipientId),
      orderBy: desc(bowelMovements.occuredAt)
    });
  },

  async createBowelMovement(movementData: any) {
    const validatedData = insertBowelMovementSchema.parse(movementData);
    const [newMovement] = await db.insert(bowelMovements).values(validatedData).returning();
    return newMovement;
  },

  // Supplies
  async getSupplies(careRecipientId: number) {
    return db.query.supplies.findMany({
      where: eq(supplies.careRecipientId, careRecipientId)
    });
  },

  async createSupply(supplyData: any) {
    const validatedData = insertSupplySchema.parse(supplyData);
    const [newSupply] = await db.insert(supplies).values(validatedData).returning();
    return newSupply;
  },

  async createSupplyUsage(usageData: any) {
    const validatedData = insertSupplyUsageSchema.parse(usageData);
    
    // Update supply quantity
    await db.update(supplies)
      .set({ 
        quantity: sql`${supplies.quantity} - ${validatedData.quantity}`
      })
      .where(eq(supplies.id, validatedData.supplyId));
    
    // Record usage
    const [newUsage] = await db.insert(supplyUsages).values(validatedData).returning();
    return newUsage;
  },

  // Sleep
  async getSleepRecords(careRecipientId: number) {
    return db.query.sleep.findMany({
      where: eq(sleep.careRecipientId, careRecipientId),
      orderBy: desc(sleep.startTime)
    });
  },

  async createSleepRecord(sleepData: any) {
    const validatedData = insertSleepSchema.parse(sleepData);
    const [newSleep] = await db.insert(sleep).values(validatedData).returning();
    return newSleep;
  },

  // Notes
  async getNotes(careRecipientId: number) {
    return db.query.notes.findMany({
      where: eq(notes.careRecipientId, careRecipientId),
      orderBy: desc(notes.createdAt)
    });
  },

  async getRecentNotes(careRecipientId: number) {
    return db.query.notes.findMany({
      where: eq(notes.careRecipientId, careRecipientId),
      orderBy: desc(notes.createdAt),
      limit: 5
    });
  },

  async createNote(noteData: any) {
    const validatedData = insertNoteSchema.parse(noteData);
    const [newNote] = await db.insert(notes).values(validatedData).returning();
    return newNote;
  },

  // Inspiration
  async getDailyInspiration() {
    const allInspirationalMessages = await db.query.inspirationMessages.findMany({
      where: eq(inspirationMessages.active, true)
    });
    
    if (allInspirationalMessages.length === 0) {
      return {
        message: "Caregiving often calls us to lean into love we didn't know possible.",
        author: "Tia Walker"
      };
    }
    
    // Get a random message
    const randomIndex = Math.floor(Math.random() * allInspirationalMessages.length);
    return allInspirationalMessages[randomIndex];
  }
};
