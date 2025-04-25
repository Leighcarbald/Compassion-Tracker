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
    
    // First get all medications for this care recipient
    const meds = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId)
    });
    
    // Get medication stats using the medication IDs
    const medicationCount = await db.query.medicationSchedules.findMany({
      where: meds.length > 0 ? inArray(medicationSchedules.medicationId, meds.map(med => med.id)) : undefined,
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
    const info = await this.getEmergencyInfoById(id);
    if (!info || !info.pinHash) return false;
    
    return this.comparePin(pin, info.pinHash);
  },
  
  async setEmergencyInfoPin(id: number, pin: string) {
    const pinHash = await this.hashPin(pin);
    
    await db.update(emergencyInfo)
      .set({ pinHash })
      .where(eq(emergencyInfo.id, id));
    
    return this.getEmergencyInfoById(id);
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
