import { db } from "@db";
import { eq, and, lt, gte, lte, desc, sql, inArray } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
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
  doctors,
  pharmacies,
  medicationPharmacies,
  emergencyInfo,
  bloodPressure,
  glucose,
  insulin,
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
  insertInspirationMessageSchema,
  insertDoctorSchema,
  insertPharmacySchema,
  insertMedicationPharmacySchema,
  insertEmergencyInfoSchema,
  insertBloodPressureSchema,
  insertGlucoseSchema,
  insertInsulinSchema
} from "@shared/schema";
import { format, startOfDay, endOfDay, addHours, formatDistance, isToday } from "date-fns";

// Store the last date reset was performed to track day changes
let lastResetDate = new Date();
let midnightResetInitialized = false;

// For daily inspiration
let todaysInspiration: { message: string; author: string } | null = null;
let lastInspirationDate = new Date();

// Helper function to check if a date is from today
const isDateFromToday = (date: Date): boolean => {
  return isToday(new Date(date));
};

// Helper function to get today's date range and check for date changes
const getTodayDateRange = () => {
  const today = new Date();
  
  // Check if we need to reset daily stats (if the current day is different from last reset day)
  const todayStr = format(today, 'yyyy-MM-dd');
  const lastResetStr = format(lastResetDate, 'yyyy-MM-dd');
  
  if (todayStr !== lastResetStr) {
    console.log(`Daily stats reset triggered: Current date ${todayStr} differs from last reset date ${lastResetStr}`);
    lastResetDate = today; // Update the last reset date
    
    // The date has changed - this could be due to a server restart or midnight passing
    // We don't need to do anything special here as the stats are calculated fresh on each request
    // The getTodayDateRange function ensures we're always using today's date range
  }
  
  return {
    start: startOfDay(today),
    end: endOfDay(today)
  };
};

// Schedule midnight reset job - exported and called from routes.ts
export const scheduleMidnightReset = () => {
  if (midnightResetInitialized) {
    return; // Only initialize once
  }
  
  midnightResetInitialized = true;
  console.log('Midnight reset scheduler initialized');
  
  const runMidnightReset = () => {
    const now = new Date();
    const night = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1, // tomorrow
      0, // hour: 0 = midnight
      0, // minute
      5 // 5 seconds after midnight to make sure we're in the new day
    );
    
    const msUntilMidnight = night.getTime() - now.getTime();
    
    // Schedule the reset at midnight
    setTimeout(() => {
      console.log('Executing midnight reset for daily stats');
      // Reset the date so the next getTodayDateRange call will trigger a reset
      lastResetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      // Also reset the daily inspiration
      todaysInspiration = null;
      lastInspirationDate = new Date();
      console.log('Daily inspiration reset for a new day');
      
      // Schedule next day's reset
      setTimeout(runMidnightReset, 1000);
    }, msUntilMidnight);
    
    console.log(`Midnight reset scheduled to run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);
  };
  
  // Start the reset scheduling cycle
  runMidnightReset();
};

// Export the reset scheduler function to be called when server starts

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
  
  async deleteCareRecipient(id: number) {
    // Delete all related data first to maintain referential integrity
    // This is a cascading delete operation
    
    // Delete medication logs and schedules for all medications of this care recipient
    const recipientMedications = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, id)
    });
    
    for (const medication of recipientMedications) {
      // Delete medication logs
      await db.delete(medicationLogs)
        .where(eq(medicationLogs.medicationId, medication.id));
      
      // Delete medication schedules
      await db.delete(medicationSchedules)
        .where(eq(medicationSchedules.medicationId, medication.id));
        
      // Delete medication pharmacy relations
      await db.delete(medicationPharmacies)
        .where(eq(medicationPharmacies.medicationId, medication.id));
    }
    
    // Delete medications
    await db.delete(medications)
      .where(eq(medications.careRecipientId, id));
    
    // Delete appointments
    await db.delete(appointments)
      .where(eq(appointments.careRecipientId, id));
    
    // Delete meals
    await db.delete(meals)
      .where(eq(meals.careRecipientId, id));
    
    // Delete bowel movements
    await db.delete(bowelMovements)
      .where(eq(bowelMovements.careRecipientId, id));
    
    // Delete supplies and supply usages
    const recipientSupplies = await db.query.supplies.findMany({
      where: eq(supplies.careRecipientId, id)
    });
    
    for (const supply of recipientSupplies) {
      await db.delete(supplyUsages)
        .where(eq(supplyUsages.supplyId, supply.id));
    }
    
    await db.delete(supplies)
      .where(eq(supplies.careRecipientId, id));
    
    // Delete sleep records
    await db.delete(sleep)
      .where(eq(sleep.careRecipientId, id));
    
    // Delete notes
    await db.delete(notes)
      .where(eq(notes.careRecipientId, id));
    
    // Delete doctors
    await db.delete(doctors)
      .where(eq(doctors.careRecipientId, id));
    
    // Delete pharmacies
    await db.delete(pharmacies)
      .where(eq(pharmacies.careRecipientId, id));
    
    // Delete emergency info
    await db.delete(emergencyInfo)
      .where(eq(emergencyInfo.careRecipientId, id));
    
    // Delete blood pressure readings
    await db.delete(bloodPressure)
      .where(eq(bloodPressure.careRecipientId, id));
    
    // Delete glucose readings
    await db.delete(glucose)
      .where(eq(glucose.careRecipientId, id));
    
    // Delete insulin records
    await db.delete(insulin)
      .where(eq(insulin.careRecipientId, id));
    
    // Finally delete the care recipient
    await db.delete(careRecipients)
      .where(eq(careRecipients.id, id));
    
    return { success: true, message: "Care recipient and all associated data deleted successfully" };
  },

  // Today's Stats
  async getTodayStats(careRecipientId: number) {
    const { start, end } = getTodayDateRange();
    
    // First get all medications for this care recipient
    const meds = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId)
    });
    
    // Get medication logs for today
    const todayLogs = await db.query.medicationLogs.findMany({
      where: and(
        eq(medicationLogs.careRecipientId, careRecipientId),
        gte(medicationLogs.takenAt, start),
        lt(medicationLogs.takenAt, end)
      )
    });
    
    // Count unique medications that have been taken today
    // Use a Set to track unique medication IDs
    const takenMedicationIds = new Set(todayLogs.map(log => log.medicationId));
    
    // Get meal stats
    const mealTypes = ["breakfast", "lunch", "dinner"];
    const todayMeals = await db.query.meals.findMany({
      where: and(
        eq(meals.careRecipientId, careRecipientId),
        gte(meals.consumedAt, start),
        lt(meals.consumedAt, end)
      )
    });
    
    // Get bowel movement stats for today
    const lastBowelMovement = await db.query.bowelMovements.findFirst({
      where: and(
        eq(bowelMovements.careRecipientId, careRecipientId),
        gte(bowelMovements.occuredAt, start),
        lt(bowelMovements.occuredAt, end)
      ),
      orderBy: desc(bowelMovements.occuredAt)
    });
    
    // Get depends supply
    const dependsSupply = await db.query.supplies.findFirst({
      where: and(
        eq(supplies.careRecipientId, careRecipientId),
        eq(supplies.name, "Depends")
      )
    });
    
    // Get sleep stats for today
    const lastSleep = await db.query.sleep.findFirst({
      where: and(
        eq(sleep.careRecipientId, careRecipientId),
        gte(sleep.startTime, start),
        lt(sleep.startTime, end)
      ),
      orderBy: desc(sleep.startTime)
    });
    
    return {
      medications: {
        completed: takenMedicationIds.size,
        total: meds.length,
        progress: meds.length > 0 
          ? Math.round((takenMedicationIds.size / meds.length) * 100) 
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
    
    // First get all medications for this care recipient
    const meds = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId)
    });
    
    // Get upcoming medication schedules using the medication IDs
    const medicationEvents = await db.query.medicationSchedules.findMany({
      where: meds.length > 0 ? inArray(medicationSchedules.medicationId, meds.map(med => med.id)) : undefined,
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
    
    // Get recent sleep records
    const sleepEvents = await db.query.sleep.findMany({
      where: eq(sleep.careRecipientId, careRecipientId),
      orderBy: desc(sleep.startTime),
      limit: 1
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
      // Sleep events removed from "Next Up" section as requested
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
  
  async getMedicationsNeedingReorder(careRecipientId: number) {
    const today = new Date();
    // Calculate date thresholds for each medication based on their daysToReorder
    
    // Get all medications for this care recipient
    const allMeds = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId),
      with: {
        schedules: true
      }
    });
    
    // Filter medications that need reordering based on:
    // 1. Quantity is at or below threshold
    // 2. Scheduled to be taken within daysToReorder days
    return allMeds.filter(med => {
      // Check if quantity is at or below threshold
      const quantityLow = (med.currentQuantity !== null && 
                            med.currentQuantity <= (med.reorderThreshold || 5));
      
      // If we have a low quantity, this medication needs reordering
      if (quantityLow) {
        return true;
      }
      
      // Otherwise, use the daysToReorder setting
      // Check if we would go below threshold within daysToReorder days
      const daysToReorder = med.daysToReorder || 7; // Default to 7 days if not set
      const schedules = med.schedules || [];
      
      // Skip medications with no schedules
      if (schedules.length === 0) {
        return false;
      }
      
      // Calculate daily usage based on schedules
      let estimatedDailyUsage = 0;
      
      schedules.forEach(schedule => {
        // Extract quantity number from string (e.g., "2 tablets" -> 2)
        const quantityMatch = (schedule.quantity || "1").match(/^(\d+)/);
        const qty = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        
        // Count active days in the week
        const daysOfWeek = schedule.daysOfWeek as number[];
        const activeDays = Array.isArray(daysOfWeek) ? daysOfWeek.length : 7;
        
        // Calculate average daily usage from this schedule
        estimatedDailyUsage += (qty * activeDays) / 7;
      });
      
      // If we have no usage, this medication doesn't need reordering yet
      if (estimatedDailyUsage === 0) {
        return false;
      }
      
      // Calculate how many days until we hit the threshold
      const currentQuantity = med.currentQuantity || 0;
      const reorderThreshold = med.reorderThreshold || 5;
      const daysUntilThreshold = Math.floor((currentQuantity - reorderThreshold) / estimatedDailyUsage);
      
      // If we'll hit threshold within daysToReorder, we need to reorder
      return daysUntilThreshold <= daysToReorder;
    });
  },
  
  async updateMedicationInventory(medicationId: number, inventoryData: {
    currentQuantity?: number,
    reorderThreshold?: number,
    daysToReorder?: number,
    originalQuantity?: number,
    refillsRemaining?: number,
    lastRefillDate?: Date | string
  }) {
    // Create an update object with only the provided fields
    const updateData: any = {};
    
    if (inventoryData.currentQuantity !== undefined) {
      updateData.currentQuantity = inventoryData.currentQuantity;
    }
    
    if (inventoryData.reorderThreshold !== undefined) {
      updateData.reorderThreshold = inventoryData.reorderThreshold;
    }
    
    if (inventoryData.daysToReorder !== undefined) {
      // Ensure daysToReorder is within the 1-30 days range
      updateData.daysToReorder = Math.max(1, Math.min(30, inventoryData.daysToReorder));
    }
    
    if (inventoryData.originalQuantity !== undefined) {
      updateData.originalQuantity = inventoryData.originalQuantity;
    }
    
    if (inventoryData.refillsRemaining !== undefined) {
      updateData.refillsRemaining = inventoryData.refillsRemaining;
    }
    
    if (inventoryData.lastRefillDate !== undefined) {
      updateData.lastRefillDate = inventoryData.lastRefillDate;
    }
    
    updateData.updatedAt = new Date();
    
    // Update the medication record
    const [updatedMedication] = await db.update(medications)
      .set(updateData)
      .where(eq(medications.id, medicationId))
      .returning();
    
    return updatedMedication;
  },
  
  async refillMedication(medicationId: number, refillAmount: number, refillDate: Date = new Date()) {
    // Get the current medication data
    const medication = await db.query.medications.findFirst({
      where: eq(medications.id, medicationId)
    });
    
    if (!medication) {
      throw new Error('Medication not found');
    }
    
    // Calculate new values
    const newQuantity = (medication.currentQuantity || 0) + refillAmount;
    const newRefillsRemaining = Math.max(0, (medication.refillsRemaining || 0) - 1);
    
    // Update the medication with new inventory values
    const [updatedMedication] = await db.update(medications)
      .set({
        currentQuantity: newQuantity,
        refillsRemaining: newRefillsRemaining,
        lastRefillDate: refillDate,
        updatedAt: new Date()
      })
      .where(eq(medications.id, medicationId))
      .returning();
    
    return updatedMedication;
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
  
  async deleteMedicationLog(logId: number) {
    // Find the log first to ensure it exists
    const logToDelete = await db.query.medicationLogs.findFirst({
      where: eq(medicationLogs.id, logId)
    });
    
    if (!logToDelete) {
      throw new Error('Medication log not found');
    }
    
    // Delete the log
    await db.delete(medicationLogs).where(eq(medicationLogs.id, logId));
    
    return { success: true };
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
  
  async deleteAppointment(id: number) {
    await db.delete(appointments).where(eq(appointments.id, id));
    return { success: true };
  },
  
  async getMonthAppointments(careRecipientId: number, yearMonth: string) {
    try {
      if (!yearMonth.match(/^\d{4}-\d{2}$/)) {
        throw new Error('Year-Month must be in YYYY-MM format');
      }
      
      // Extract year and month
      const [year, month] = yearMonth.split('-').map(Number);
      
      // Create start and end dates for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);  // Last day of the specified month
      
      const startDateString = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
      const endDateString = endDate.toISOString().split('T')[0]; // YYYY-MM-DD
      
      return db.query.appointments.findMany({
        where: and(
          eq(appointments.careRecipientId, careRecipientId),
          gte(appointments.date, startDateString),
          lte(appointments.date, endDateString)
        ),
        orderBy: [appointments.date, appointments.time]
      });
    } catch (error) {
      console.error('Error fetching month appointments:', error);
      return [];
    }
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
    console.log('Storage: creating meal with data:', mealData);
    try {
      // Handle consumedAt format - convert ISO string to Date object if needed
      let processedData = { ...mealData };
      
      if (typeof processedData.consumedAt === 'string') {
        processedData.consumedAt = new Date(processedData.consumedAt);
      }
      
      // Ensure careRecipientId is a number
      processedData.careRecipientId = parseInt(processedData.careRecipientId.toString());
      
      console.log('Storage: processed meal data:', processedData);
      
      // Create meal record with proper Date object
      const [newMeal] = await db.insert(meals).values(processedData).returning();
      console.log('Storage: meal created successfully:', newMeal);
      return newMeal;
    } catch (error) {
      console.error('Storage: Error creating meal:', error);
      throw error;
    }
  },

  // Bowel Movements
  async getBowelMovements(careRecipientId: number) {
    return db.query.bowelMovements.findMany({
      where: eq(bowelMovements.careRecipientId, careRecipientId),
      orderBy: desc(bowelMovements.occuredAt)
    });
  },

  async createBowelMovement(movementData: any) {
    console.log('Storage: creating bowel movement with data:', movementData);
    try {
      // Handle occuredAt format - convert ISO string to Date object if needed
      let processedData = { ...movementData };
      
      // Ensure required fields are present
      if (!processedData.type) {
        processedData.type = "Regular";
      }
      
      if (!processedData.notes) {
        processedData.notes = "";
      }
      
      if (!processedData.occuredAt) {
        processedData.occuredAt = new Date();
      } else if (typeof processedData.occuredAt === 'string') {
        try {
          processedData.occuredAt = new Date(processedData.occuredAt);
          console.log('Storage: converted date string to date object:', processedData.occuredAt);
        } catch (err) {
          console.error('Storage: Error converting date string:', err);
          processedData.occuredAt = new Date();
        }
      }
      
      // Ensure careRecipientId is a number
      if (!processedData.careRecipientId) {
        throw new Error('Care recipient ID is required');
      }
      
      processedData.careRecipientId = parseInt(processedData.careRecipientId.toString());
      
      console.log('Storage: processed bowel movement data:', processedData);

      // Create bowel movement record with proper Date object
      const validatedData = insertBowelMovementSchema.parse(processedData);
      console.log('Storage: validated bowel movement data:', validatedData);
      
      const [newMovement] = await db.insert(bowelMovements).values(validatedData).returning();
      console.log('Storage: bowel movement created successfully:', newMovement);
      return newMovement;
    } catch (error) {
      console.error('Storage: Error creating bowel movement:', error);
      throw error;
    }
  },
  
  async deleteBowelMovement(id: number) {
    return db.delete(bowelMovements).where(eq(bowelMovements.id, id));
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
    // Check if we need to select a new daily inspiration
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const lastInspirationStr = format(lastInspirationDate, 'yyyy-MM-dd');
    
    // If we already have today's inspiration and it's from today, return it
    if (todaysInspiration && todayStr === lastInspirationStr) {
      return todaysInspiration;
    }
    
    // Otherwise, select a new inspiration for today
    const allInspirationalMessages = await db.query.inspirationMessages.findMany({
      where: eq(inspirationMessages.active, true)
    });
    
    if (allInspirationalMessages.length === 0) {
      // Default inspiration if none in database
      todaysInspiration = {
        message: "Caregiving often calls us to lean into love we didn't know possible.",
        author: "Tia Walker"
      };
    } else {
      // Get a random message for today
      const randomIndex = Math.floor(Math.random() * allInspirationalMessages.length);
      todaysInspiration = allInspirationalMessages[randomIndex];
    }
    
    // Update the last inspiration date
    lastInspirationDate = today;
    console.log(`New daily inspiration selected for ${todayStr}`);
    
    return todaysInspiration;
  },

  // Doctors
  async getDoctors(careRecipientId: number) {
    return db.query.doctors.findMany({
      where: eq(doctors.careRecipientId, careRecipientId),
      orderBy: doctors.name
    });
  },

  async createDoctor(doctorData: any) {
    const validatedData = insertDoctorSchema.parse(doctorData);
    const [newDoctor] = await db.insert(doctors).values(validatedData).returning();
    return newDoctor;
  },

  // Pharmacies
  async getPharmacies(careRecipientId: number) {
    return db.query.pharmacies.findMany({
      where: eq(pharmacies.careRecipientId, careRecipientId),
      orderBy: pharmacies.name
    });
  },

  async createPharmacy(pharmacyData: any) {
    const validatedData = insertPharmacySchema.parse(pharmacyData);
    const [newPharmacy] = await db.insert(pharmacies).values(validatedData).returning();
    return newPharmacy;
  },

  // Medication-Pharmacy Relations
  async getMedicationPharmacies(medicationId: number) {
    return db.query.medicationPharmacies.findMany({
      where: eq(medicationPharmacies.medicationId, medicationId),
      with: {
        pharmacy: true
      }
    });
  },

  async createMedicationPharmacy(relationData: any) {
    const validatedData = insertMedicationPharmacySchema.parse(relationData);
    const [newRelation] = await db.insert(medicationPharmacies).values(validatedData).returning();
    return newRelation;
  },

  // PIN management helpers
  async hashPin(pin: string) {
    const scryptAsync = promisify(scrypt);
    const salt = randomBytes(16).toString('hex');
    const buf = (await scryptAsync(pin, salt, 64)) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
  },

  async comparePin(suppliedPin: string, storedPinHash: string) {
    if (!storedPinHash) return false;
    
    const scryptAsync = promisify(scrypt);
    const [hashedPin, salt] = storedPinHash.split('.');
    const hashedPinBuf = Buffer.from(hashedPin, 'hex');
    const suppliedPinBuf = (await scryptAsync(suppliedPin, salt, 64)) as Buffer;
    return timingSafeEqual(hashedPinBuf, suppliedPinBuf);
  },

  // Emergency Info
  async getEmergencyInfo(careRecipientId: number) {
    return db.query.emergencyInfo.findFirst({
      where: eq(emergencyInfo.careRecipientId, careRecipientId)
    });
  },

  async getEmergencyInfoById(id: number) {
    return db.query.emergencyInfo.findFirst({
      where: eq(emergencyInfo.id, id)
    });
  },

  async createEmergencyInfo(emergencyInfoData: any) {
    const validatedData = insertEmergencyInfoSchema.parse(emergencyInfoData);
    
    // If pin is provided, hash it before saving
    if (validatedData.pin) {
      validatedData.pinHash = await this.hashPin(validatedData.pin);
      // Remove the plain text pin from data going to database
      delete validatedData.pin;
    }
    
    const [newEmergencyInfo] = await db.insert(emergencyInfo).values(validatedData).returning();
    return newEmergencyInfo;
  },

  async updateEmergencyInfo(id: number, emergencyInfoData: any) {
    // First check if record exists
    const existingRecord = await this.getEmergencyInfoById(id);
    if (!existingRecord) return null;

    // Remove id and careRecipientId from the update data if present
    const { id: _, careRecipientId: __, ...updateData } = emergencyInfoData;
    
    // If pin is provided, hash it before saving
    if (updateData.pin) {
      updateData.pinHash = await this.hashPin(updateData.pin);
      // Remove the plain text pin from data going to database
      delete updateData.pin;
    }
    
    // Update the record
    await db.update(emergencyInfo)
      .set(updateData)
      .where(eq(emergencyInfo.id, id));
    
    // Return the updated record
    return this.getEmergencyInfoById(id);
  },
  
  async verifyEmergencyInfoPin(id: number, pin: string) {
    console.log(`Verifying PIN for emergency info #${id}`);
    const info = await this.getEmergencyInfoById(id);
    
    if (!info) {
      console.log(`Emergency info #${id} not found`);
      return false;
    }
    
    if (!info.pinHash) {
      console.log(`Emergency info #${id} does not have a PIN set`);
      return false;
    }
    
    const isValid = await this.comparePin(pin, info.pinHash);
    console.log(`PIN verification result for emergency info #${id}: ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  },
  
  async setEmergencyInfoPin(id: number, pin: string) {
    console.log(`Storage: Setting PIN for emergency info #${id}, pin value type: ${typeof pin}, pin: ${pin}`);
    const pinHash = await this.hashPin(pin.toString());
    
    console.log(`PIN hashed successfully, updating emergency info #${id}`);
    try {
      await db.update(emergencyInfo)
        .set({ pinHash })
        .where(eq(emergencyInfo.id, id));
      
      console.log(`Emergency info #${id} updated with new PIN hash`);
      return this.getEmergencyInfoById(id);
    } catch (error) {
      console.error(`Error updating emergency info PIN:`, error);
      throw error;
    }
  },

  // Blood Pressure Tracking
  async getBloodPressureReadings(careRecipientId: number) {
    return db.query.bloodPressure.findMany({
      where: eq(bloodPressure.careRecipientId, careRecipientId),
      orderBy: desc(bloodPressure.timeOfReading)
    });
  },

  async createBloodPressureReading(readingData: any) {
    const validatedData = insertBloodPressureSchema.parse(readingData);
    const [newReading] = await db.insert(bloodPressure).values(validatedData).returning();
    return newReading;
  },

  // Glucose Tracking
  async getGlucoseReadings(careRecipientId: number) {
    return db.query.glucose.findMany({
      where: eq(glucose.careRecipientId, careRecipientId),
      orderBy: desc(glucose.timeOfReading)
    });
  },

  async createGlucoseReading(readingData: any) {
    const validatedData = insertGlucoseSchema.parse(readingData);
    const [newReading] = await db.insert(glucose).values(validatedData).returning();
    return newReading;
  },

  // Insulin Tracking
  async getInsulinRecords(careRecipientId: number) {
    return db.query.insulin.findMany({
      where: eq(insulin.careRecipientId, careRecipientId),
      orderBy: desc(insulin.timeAdministered)
    });
  },

  async createInsulinRecord(recordData: any) {
    const validatedData = insertInsulinSchema.parse(recordData);
    const [newRecord] = await db.insert(insulin).values(validatedData).returning();
    return newRecord;
  }
};
