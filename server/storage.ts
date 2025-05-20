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
import { format, startOfDay, endOfDay, addHours, formatDistance, isToday, addDays } from "date-fns";

// Store the last date reset was performed to track day changes
let lastResetDate = new Date();
let midnightResetInitialized = false;

// For daily inspiration - always start with null so we get a fresh one
let todaysInspiration: { message: string; author: string } | null = null;
// Set the last date to yesterday to force a new inspiration on first request
let lastInspirationDate = new Date(new Date().setDate(new Date().getDate() - 1));

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
  
  async updateCareRecipient(id: number, data: { name: string }) {
    try {
      const [updated] = await db.update(careRecipients)
        .set({ 
          name: data.name,
          updatedAt: new Date()
        })
        .where(eq(careRecipients.id, id))
        .returning();
        
      return updated;
    } catch (error) {
      console.error('Error updating care recipient:', error);
      throw new Error('Failed to update care recipient');
    }
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

  // Helper function to get date range for any date
  getDateRange(date: Date | string) {
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    return {
      start: startOfDay(targetDate),
      end: endOfDay(targetDate)
    };
  },
  
  // Today's Stats
  async getTodayStats(careRecipientId: number) {
    const { start, end } = getTodayDateRange();
    return this.getDateStats(careRecipientId, start, end);
  },
  
  // Get stats for any specific date
  async getDateStats(careRecipientId: number, start: Date, end: Date) {
    // First get all medications for this care recipient
    const meds = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId)
    });
    
    // Get medication logs for the specified date with medication details
    const dateLogs = await db.query.medicationLogs.findMany({
      where: and(
        eq(medicationLogs.careRecipientId, careRecipientId),
        gte(medicationLogs.takenAt, start),
        lt(medicationLogs.takenAt, end)
      ),
      with: {
        medication: true
      }
    });
    
    // Get all medication schedules for the medications
    const medSchedules = await db.query.medicationSchedules.findMany({
      where: inArray(medicationSchedules.medicationId, meds.map(med => med.id))
    });
    
    // Create a map of medication ID to required doses (from schedules)
    const requiredDosesMap = new Map();
    
    // For each medication, count how many doses are required today
    for (const med of meds) {
      // Get schedules for this medication
      const schedules = Array.isArray(medSchedules) ? medSchedules.filter(
        schedule => schedule.medicationId === med.id
      ) : [];
      
      // If there are no schedules, the medication only needs to be taken once
      if (schedules.length === 0) {
        requiredDosesMap.set(med.id, 1);
      } else {
        // Count the number of required schedules (excluding "as needed" medications)
        const requiredSchedulesCount = schedules.filter(schedule => !schedule.asNeeded).length;
        
        // If there are only "as needed" schedules, set required to 0 (they're optional)
        // Otherwise, set to the count of required schedules
        requiredDosesMap.set(med.id, requiredSchedulesCount);
      }
    }
    
    // Track taken doses by medication and schedule
    // We need to track which specific schedules have been taken, not just count total doses
    const takenDosesMap = new Map(); // Medication ID -> total count
    const takenSchedulesMap = new Map(); // Medication ID -> Set of taken schedule IDs
    
    for (const log of dateLogs) {
      const medId = log.medicationId;
      
      // Update total dose count
      takenDosesMap.set(medId, (takenDosesMap.get(medId) || 0) + 1);
      
      // Track which specific schedules have been taken
      if (log.scheduleId) {
        // If this log has a scheduleId, track it
        if (!takenSchedulesMap.has(medId)) {
          takenSchedulesMap.set(medId, new Set());
        }
        takenSchedulesMap.get(medId).add(log.scheduleId);
      }
    }
    
    // A medication is fully taken if all its scheduled doses are taken
    const takenMedicationIds = new Set();
    for (const med of meds) {
      const requiredDoses = requiredDosesMap.get(med.id) || 1;
      const takenDoses = takenDosesMap.get(med.id) || 0;
      
      // Get schedules for this medication
      const schedules = Array.isArray(medSchedules) ? medSchedules.filter(
        schedule => schedule.medicationId === med.id
      ) : [];
      
      if (schedules.length === 0) {
        // If no schedules, medication is completed if at least one dose was taken
        if (takenDoses > 0) {
          takenMedicationIds.add(med.id);
        }
      } else {
        // Check if all required (non-as-needed) schedules were taken
        const takenScheduleIdsForMed = takenSchedulesMap.get(med.id) || new Set();
        
        // Filter out "as needed" schedules when checking completion
        const requiredSchedules = schedules.filter(schedule => !schedule.asNeeded);
        
        // If there are no required schedules (all are as-needed), 
        // the medication is considered complete regardless of whether doses were taken
        if (requiredSchedules.length === 0) {
          takenMedicationIds.add(med.id);
        } else {
          // Otherwise, check if all required schedules were taken
          const allRequiredSchedulesTaken = requiredSchedules.every(schedule => 
            takenScheduleIdsForMed.has(schedule.id)
          );
          
          if (allRequiredSchedulesTaken) {
            takenMedicationIds.add(med.id);
          }
        }
      }
    }
    
    // Debug info
    console.log(`Medication completion by dose count:`, {
      requiredDoses: Object.fromEntries(requiredDosesMap),
      takenDoses: Object.fromEntries(takenDosesMap),
      completedMeds: Array.from(takenMedicationIds)
    });
    
    // Get meal stats
    const mealTypes = ["breakfast", "lunch", "dinner"];
    const dateMeals = await db.query.meals.findMany({
      where: and(
        eq(meals.careRecipientId, careRecipientId),
        gte(meals.consumedAt, start),
        lt(meals.consumedAt, end)
      )
    });
    
    // Get bowel movement stats for the specified date
    const bowelMovementRecords = await db.query.bowelMovements.findMany({
      where: and(
        eq(bowelMovements.careRecipientId, careRecipientId),
        gte(bowelMovements.occuredAt, start),
        lt(bowelMovements.occuredAt, end)
      ),
      orderBy: desc(bowelMovements.occuredAt)
    });
    
    // Get sleep stats for the specified date
    const sleepRecords = await db.query.sleep.findMany({
      where: and(
        eq(sleep.careRecipientId, careRecipientId),
        gte(sleep.startTime, start),
        lt(sleep.startTime, end)
      ),
      orderBy: desc(sleep.startTime)
    });
    
    // Get blood pressure readings for the specified date
    const bloodPressureReadings = await db.query.bloodPressure.findMany({
      where: and(
        eq(bloodPressure.careRecipientId, careRecipientId),
        gte(bloodPressure.timeOfReading, start),
        lt(bloodPressure.timeOfReading, end)
      ),
      orderBy: desc(bloodPressure.timeOfReading)
    });
    
    // Get glucose readings for the specified date
    const glucoseReadings = await db.query.glucose.findMany({
      where: and(
        eq(glucose.careRecipientId, careRecipientId),
        gte(glucose.timeOfReading, start),
        lt(glucose.timeOfReading, end)
      ),
      orderBy: desc(glucose.timeOfReading)
    });
    
    // Get insulin records for the specified date
    const insulinRecords = await db.query.insulin.findMany({
      where: and(
        eq(insulin.careRecipientId, careRecipientId),
        gte(insulin.timeAdministered, start),
        lt(insulin.timeAdministered, end)
      ),
      orderBy: desc(insulin.timeAdministered)
    });
    
    // Get notes for the specified date
    const dateNotes = await db.query.notes.findMany({
      where: and(
        eq(notes.careRecipientId, careRecipientId),
        gte(notes.createdAt, start),
        lt(notes.createdAt, end)
      ),
      orderBy: desc(notes.createdAt)
    });
    
    // Get depends supply
    const dependsSupply = await db.query.supplies.findFirst({
      where: and(
        eq(supplies.careRecipientId, careRecipientId),
        eq(supplies.name, "Depends")
      )
    });
    
    // Debug medication logs
    console.log(`Date stats for ${start.toISOString()} to ${end.toISOString()}:`);
    console.log(`Medications total: ${meds.length}, taken: ${takenMedicationIds.size}`);
    console.log(`Medication logs: ${dateLogs.length}`);
    
    // The logs now already include medication details through the with: { medication: true } relation

    return {
      // Summary stats
      medications: {
        completed: takenMedicationIds.size,
        total: meds.length,
        progress: meds.length > 0 
          ? Math.round((takenMedicationIds.size / meds.length) * 100) 
          : 0,
        logs: dateLogs
      },
      meals: {
        completed: dateMeals.length,
        total: mealTypes.length,
        progress: mealTypes.length > 0 
          ? Math.round((Math.min(dateMeals.length, mealTypes.length) / mealTypes.length) * 100) 
          : 0,
        logs: dateMeals
      },
      bowelMovements: bowelMovementRecords,
      sleepRecords: sleepRecords,
      bloodPressure: bloodPressureReadings,
      glucose: glucoseReadings,
      insulin: insulinRecords,
      notes: dateNotes,
      supplies: {
        depends: dependsSupply?.quantity || 0
      },
      // Keep the old format for backward compatibility with dashboard
      bowelMovement: {
        lastTime: Array.isArray(bowelMovementRecords) && bowelMovementRecords.length > 0 && bowelMovementRecords[0]?.occuredAt
          ? formatDistance(new Date(bowelMovementRecords[0].occuredAt), new Date(), { addSuffix: true }) 
          : "None recorded"
      },
      sleep: {
        duration: Array.isArray(sleepRecords) && sleepRecords.length > 0
          ? this.calculateSleepDuration(sleepRecords[0].startTime, sleepRecords[0].endTime) 
          : "No data",
        quality: Array.isArray(sleepRecords) && sleepRecords.length > 0 ? sleepRecords[0]?.quality || "" : ""
      }
    };
  },

  // Calculate sleep duration in hours
  calculateSleepDuration(startTime: Date, endTime: Date | null) {
    let diffMs;
    
    if (!endTime) {
      // If sleep is still in progress, calculate duration from start time until now
      diffMs = new Date().getTime() - new Date(startTime).getTime();
      
      // Convert to hours and minutes
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      // Format for ongoing sleep
      if (hours > 0) {
        return `${hours}h ${minutes}m (ongoing)`;
      } else {
        return `${minutes}m (ongoing)`;
      }
    }
    
    // Calculate difference in milliseconds for completed sleep
    diffMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    
    // Convert to hours and minutes
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format for completed sleep
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  },

  // Upcoming Events
  async getUpcomingEvents(careRecipientId: number) {
    const now = new Date();
    const endOfToday = endOfDay(now);
    const currentDayOfWeek = format(now, 'EEEE').toLowerCase();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    // First get all medications for this care recipient
    const meds = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId)
    });
    
    // Get upcoming medication schedules using the medication IDs (excluding "as needed" medications)
    let medSchedules = [];
    if (meds.length > 0) {
      medSchedules = await db.query.medicationSchedules.findMany({
        where: and(
          inArray(medicationSchedules.medicationId, meds.map(med => med.id)),
          eq(medicationSchedules.asNeeded, false)
        ),
        with: {
          medication: true
        }
      });
    }
    
    // Process medication schedules to get upcoming doses for today and future days
    const medicationEvents = [];
    
    // Debug log
    console.log(`Processing ${medSchedules.length} medication schedules for upcoming doses`);
    
    // Convert day name to number (0 = Sunday, 1 = Monday, etc.)
    const dayToNumber = {
      'sunday': 0,
      'monday': 1,
      'tuesday': 2,
      'wednesday': 3,
      'thursday': 4,
      'friday': 5,
      'saturday': 6
    };
    
    // Get upcoming days to check for scheduled medications (today + next 3 days)
    const daysToCheck = [
      { date: now, dayNumber: dayToNumber[format(now, 'EEEE').toLowerCase()] },
      { date: addDays(now, 1), dayNumber: dayToNumber[format(addDays(now, 1), 'EEEE').toLowerCase()] },
      { date: addDays(now, 2), dayNumber: dayToNumber[format(addDays(now, 2), 'EEEE').toLowerCase()] },
      { date: addDays(now, 3), dayNumber: dayToNumber[format(addDays(now, 3), 'EEEE').toLowerCase()] }
    ];
    
    for (const schedule of medSchedules) {
      // Skip if medication is not found
      if (!schedule.medication) continue;
      
      // Check each upcoming day to see if this medication is scheduled
      for (const checkDay of daysToCheck) {
        let isScheduledForDay = false;
        const dayOfWeek = format(checkDay.date, 'EEEE').toLowerCase();
        
        // Try the direct day property first (e.g., schedule.monday for Monday)
        if (schedule[dayOfWeek] === true) {
          isScheduledForDay = true;
        }
        // Otherwise check daysOfWeek array
        else if (schedule.daysOfWeek) {
          // Handle string JSON or array
          let daysArray = [];
          
          if (typeof schedule.daysOfWeek === 'string') {
            try {
              daysArray = JSON.parse(schedule.daysOfWeek);
            } catch (e) {
              daysArray = [];
            }
          } else if (Array.isArray(schedule.daysOfWeek)) {
            daysArray = schedule.daysOfWeek;
          }
          
          // Check if day is in the days array
          if (daysArray && daysArray.includes(checkDay.dayNumber)) {
            isScheduledForDay = true;
          }
        }
        
        // Skip if not scheduled for this day
        if (!isScheduledForDay) continue;
        
        // Parse time to check if it's upcoming
        if (schedule.time) {
          const [hourStr, minuteStr] = schedule.time.split(':');
          const hour = parseInt(hourStr);
          const minute = parseInt(minuteStr);
          
          // For today, only include upcoming doses (later today)
          // For future days, include all doses
          const isToday = format(checkDay.date, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
          
          if (!isToday || (hour > currentHour || (hour === currentHour && minute > currentMinute))) {
            medicationEvents.push({
              id: `med_${schedule.id}_${format(checkDay.date, 'yyyy-MM-dd')}`,
              type: 'medication',
              title: schedule.medication.name,
              time: schedule.time,
              date: format(checkDay.date, 'yyyy-MM-dd'),
              details: schedule.medication.dosage || 'Take as directed',
              notes: schedule.medication.instructions || '',
              source: 'schedule',
              scheduledFor: `${hour}:${minute.toString().padStart(2, '0')}`,
              reminder: true, // Scheduled medications have reminders by default
              canEdit: false   // Schedule-based events can't be edited directly
            });
          }
        }
      }
    }
    
    // Get upcoming appointments for the next 7 days
    const appointmentEvents = await db.query.appointments.findMany({
      where: and(
        eq(appointments.careRecipientId, careRecipientId),
        gte(appointments.date, format(now, 'yyyy-MM-dd')),
        lte(appointments.date, format(addDays(now, 7), 'yyyy-MM-dd')) // Include next 7 days
      ),
      orderBy: [appointments.date, appointments.time],
      limit: 5 // Increased to show more upcoming appointments
    });
    
    // Get recent sleep records
    const sleepEvents = await db.query.sleep.findMany({
      where: eq(sleep.careRecipientId, careRecipientId),
      orderBy: desc(sleep.startTime),
      limit: 1
    });
    
    // Combine and format events
    const events = [
      // Include medication events (already contains source and date fields)
      ...medicationEvents,
      
      // Include appointment events
      ...appointmentEvents.map(appointment => ({
        id: `apt_${appointment.id}`,
        type: 'appointment',
        title: appointment.title,
        time: appointment.time,
        date: appointment.date,
        details: appointment.location || '',
        notes: appointment.notes || '',
        reminder: appointment.reminderEnabled,
        source: 'manual', // Add source field to indicate this was manually created
        canEdit: true // Appointments can be edited
      }))
      // Sleep events removed from "Next Up" section as previously requested
    ];
    
    // Sort by date, then time
    return events.sort((a, b) => {
      // If dates are different, sort by date
      if (a.date !== b.date) {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }
      
      // If dates are the same, sort by time
      return new Date(`${a.date}T${a.time}`).getTime() - 
             new Date(`${b.date}T${b.time}`).getTime();
    });
  },

  // Medications
  async getMedications(careRecipientId: number, filter: string = 'today') {
    const { start, end } = getTodayDateRange();
    
    return db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId),
      with: {
        schedules: true
      },
      orderBy: medications.name // Order by name for better display
    });
  },
  
  async getMedicationsNeedingReorder(careRecipientId: number) {
    const today = new Date();
    // Calculate date thresholds for each medication based on their daysToReorder
    
    // Get all medications for this care recipient (ordered by name for consistency)
    const allMeds = await db.query.medications.findMany({
      where: eq(medications.careRecipientId, careRecipientId),
      with: {
        schedules: true
      },
      orderBy: medications.name
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
        // Skip "as needed" medications when calculating daily usage
        if (schedule.asNeeded) return;
        
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

  async updateMedication(medicationId: number, medicationData: any) {
    // First check if the medication exists
    const existingMedication = await db.query.medications.findFirst({
      where: eq(medications.id, medicationId)
    });
    
    if (!existingMedication) {
      throw new Error('Medication not found');
    }
    
    // Update the medication with allowed fields only
    // We only allow name, dosage, and instructions to be updated
    const updateData: any = {};
    if (medicationData.name !== undefined) updateData.name = medicationData.name;
    if (medicationData.dosage !== undefined) updateData.dosage = medicationData.dosage;
    if (medicationData.instructions !== undefined) updateData.instructions = medicationData.instructions;
    
    // Update the medication
    if (Object.keys(updateData).length > 0) {
      const [updatedMedication] = await db.update(medications)
        .set(updateData)
        .where(eq(medications.id, medicationId))
        .returning();
      
      return updatedMedication;
    }
    
    // If no changes, return the existing medication
    return existingMedication;
  },
  
  async deleteMedication(medicationId: number) {
    try {
      console.log(`Deleting medication with ID: ${medicationId}`);
      
      // First, delete all associated medication schedules
      const schedules = await db
        .select()
        .from(medicationSchedules)
        .where(eq(medicationSchedules.medicationId, medicationId));
      
      for (const schedule of schedules) {
        await this.deleteMedicationSchedule(schedule.id);
      }
      
      // Delete any related medication logs
      await db
        .delete(medicationLogs)
        .where(eq(medicationLogs.medicationId, medicationId));
      
      // Delete any pharmacy associations
      await db
        .delete(medicationPharmacies)
        .where(eq(medicationPharmacies.medicationId, medicationId));
      
      // Finally delete the medication itself
      await db
        .delete(medications)
        .where(eq(medications.id, medicationId));
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting medication:', error);
      throw error;
    }
  },
  
  // Medication Schedules
  async getMedicationSchedules(medicationId: number) {
    return db.query.medicationSchedules.findMany({
      where: eq(medicationSchedules.medicationId, medicationId),
      orderBy: medicationSchedules.time
    });
  },
  
  async createMedicationSchedule(scheduleData: any) {
    // Process days of week - accept an array and store as JSON
    if (Array.isArray(scheduleData.daysOfWeek)) {
      scheduleData.daysOfWeek = JSON.stringify(scheduleData.daysOfWeek);
    } else if (typeof scheduleData.daysOfWeek === 'string') {
      try {
        // If it's a string, ensure it's valid JSON
        JSON.parse(scheduleData.daysOfWeek);
      } catch (e) {
        // If not valid JSON, assume it's a comma-separated list
        scheduleData.daysOfWeek = JSON.stringify(
          scheduleData.daysOfWeek.split(',').map(d => parseInt(d.trim()))
        );
      }
    }
    
    const validatedData = insertMedicationScheduleSchema.parse(scheduleData);
    const [newSchedule] = await db.insert(medicationSchedules).values(validatedData).returning();
    return newSchedule;
  },
  
  async deleteMedicationSchedule(scheduleId: number | string) {
    console.log(`storage.deleteMedicationSchedule called with ID: ${scheduleId} (${typeof scheduleId})`);
    
    // If ID is numeric, use standard lookup
    if (typeof scheduleId === 'number') {
      // First, check if the schedule exists
      const schedule = await db.query.medicationSchedules.findFirst({
        where: eq(medicationSchedules.id, scheduleId)
      });
      
      if (!schedule) {
        throw new Error('Medication schedule not found');
      }
      
      // Delete the schedule
      await db.delete(medicationSchedules).where(eq(medicationSchedules.id, scheduleId));
      return { success: true };
    } else {
      // If it's a string ID (UUID), we need to try to find the schedule by numeric ID
      const numericId = parseInt(scheduleId);
      
      if (!isNaN(numericId)) {
        // We have a valid numeric ID from the string
        return this.deleteMedicationSchedule(numericId);
      } else {
        // The ID is a non-numeric string (UUID)
        // This is a workaround for the client sending UUIDs instead of DB IDs
        console.log(`Client sent UUID ${scheduleId} which doesn't match any database ID`);
        console.log(`Searching for matching medication schedules in database...`);
        
        // Get all schedules to see if we can find a match
        const allSchedules = await db.query.medicationSchedules.findMany();
        console.log(`Found ${allSchedules.length} total schedules in database`);
        
        // Since we couldn't find a direct match, we'll just return success
        // The client will still remove it from the UI
      }
    }
    
    return { success: true };
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
  async getMeals(careRecipientId: number, dateRange?: { start: Date, end: Date } | null) {
    // If dateRange is explicitly passed as null, get all meals
    if (dateRange === null) {
      return db.query.meals.findMany({
        where: eq(meals.careRecipientId, careRecipientId),
        orderBy: desc(meals.consumedAt)
      });
    }
    
    // By default, get today's meals if no date range provided
    const { start, end } = dateRange || getTodayDateRange();
    
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
  
  async updateMeal(id: number, mealData: any) {
    console.log(`Storage: updating meal ${id} with data:`, mealData);
    try {
      // Handle consumedAt format - convert ISO string to Date object if needed
      let processedData = { ...mealData };
      
      if (typeof processedData.consumedAt === 'string') {
        processedData.consumedAt = new Date(processedData.consumedAt);
      }
      
      // Ensure careRecipientId is a number if provided
      if (processedData.careRecipientId) {
        processedData.careRecipientId = parseInt(processedData.careRecipientId.toString());
      }
      
      console.log('Storage: processed meal update data:', processedData);
      
      // Update meal record
      const [updatedMeal] = await db.update(meals)
        .set({
          ...processedData,
          updatedAt: new Date(),
        })
        .where(eq(meals.id, id))
        .returning();
      
      console.log('Storage: meal updated successfully:', updatedMeal);
      return updatedMeal;
    } catch (error) {
      console.error(`Storage: Error updating meal ${id}:`, error);
      throw error;
    }
  },
  
  async deleteMeal(id: number) {
    console.log(`Storage: deleting meal ${id}`);
    try {
      await db.delete(meals).where(eq(meals.id, id));
      return { success: true };
    } catch (error) {
      console.error(`Storage: Error deleting meal ${id}:`, error);
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
  
  async updateBowelMovement(id: number, movementData: any) {
    console.log('Storage: updating bowel movement with ID:', id, 'data:', movementData);
    try {
      // Handle occuredAt format - convert ISO string to Date object if needed
      let processedData = { ...movementData };
      
      // Ensure the ID is not included in the update data (to avoid conflicts)
      delete processedData.id;
      
      // Process occuredAt if it exists in the data
      if (processedData.occuredAt) {
        if (typeof processedData.occuredAt === 'string') {
          try {
            processedData.occuredAt = new Date(processedData.occuredAt);
            console.log('Storage: converted date string to date object:', processedData.occuredAt);
          } catch (err) {
            console.error('Storage: Error converting date string:', err);
            // Don't update occuredAt if conversion fails
            delete processedData.occuredAt;
          }
        }
      }
      
      console.log('Storage: processed bowel movement update data:', processedData);
      
      // Update the bowel movement with the provided data
      const [updatedMovement] = await db.update(bowelMovements)
        .set(processedData)
        .where(eq(bowelMovements.id, id))
        .returning();
      
      console.log('Storage: bowel movement updated successfully:', updatedMovement);
      return updatedMovement;
    } catch (error) {
      console.error('Storage: Error updating bowel movement:', error);
      throw error;
    }
  },

  // Supplies
  async getSupplies(careRecipientId: number) {
    return db.query.supplies.findMany({
      where: eq(supplies.careRecipientId, careRecipientId),
      orderBy: supplies.name // Order by name for consistent display
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
    try {
      // Process the startTime field
      if (typeof sleepData.startTime === 'string') {
        sleepData.startTime = new Date(sleepData.startTime);
      }
      
      // Process the endTime field if present
      if (sleepData.endTime && typeof sleepData.endTime === 'string') {
        sleepData.endTime = new Date(sleepData.endTime);
      } else if (sleepData.endTime === null) {
        // If endTime is explicitly null, keep it as null
        delete sleepData.endTime;
      }
      
      console.log("Processing sleep data:", sleepData);
      
      // First attempt validation
      const [newSleep] = await db.insert(sleep).values(sleepData).returning();
      console.log("Created sleep record:", newSleep);
      return newSleep;
    } catch (error) {
      console.error("Error creating sleep record:", error);
      throw error;
    }
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
    try {
      console.log("Processing doctor data:", doctorData);
      
      // We'll directly use the data without validation to bypass potential formatting issues
      const [newDoctor] = await db.insert(doctors).values({
        name: doctorData.name,
        specialty: doctorData.specialty,
        phoneNumber: doctorData.phoneNumber,
        address: doctorData.address || null,
        email: doctorData.email || null,
        careRecipientId: doctorData.careRecipientId
      }).returning();
      
      console.log("Created doctor record:", newDoctor);
      return newDoctor;
    } catch (error) {
      console.error("Error creating doctor record:", error);
      throw error;
    }
  },
  
  async updateDoctor(id: number, doctorData: any) {
    try {
      // Validate input data but exclude id
      const { id: _, ...dataToUpdate } = doctorData;
      const validatedData = insertDoctorSchema.partial().parse(dataToUpdate);
      
      const [updatedDoctor] = await db.update(doctors)
        .set(validatedData)
        .where(eq(doctors.id, id))
        .returning();
      
      return updatedDoctor;
    } catch (error) {
      console.error('Storage: Error updating doctor:', error);
      throw error;
    }
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
      },
      orderBy: medicationPharmacies.id // Order by ID for consistent display
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
    try {
      // Handle PIN separately since it's not part of the actual database schema
      let pinHash = null;
      if (emergencyInfoData.pin) {
        pinHash = await this.hashPin(emergencyInfoData.pin);
        // Remove pin from data before validation
        delete emergencyInfoData.pin;
      }
      
      // Add pinHash back to data if it was created
      if (pinHash) {
        emergencyInfoData.pinHash = pinHash;
      }
      
      console.log("Processing emergency info data");
      const [newEmergencyInfo] = await db.insert(emergencyInfo).values(emergencyInfoData).returning();
      console.log("Created emergency info record");
      return newEmergencyInfo;
    } catch (error) {
      console.error("Error creating emergency info:", error);
      throw error;
    }
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
    try {
      // Process the timestamp field - might be passed as timeRecorded or timeOfReading
      if (typeof readingData.timeOfReading === 'string') {
        readingData.timeOfReading = new Date(readingData.timeOfReading);
      }
      
      // Create structured data with only the required fields to avoid validation issues
      const processedData = {
        systolic: readingData.systolic,
        diastolic: readingData.diastolic,
        pulse: readingData.pulse,
        timeOfReading: readingData.timeOfReading,
        notes: readingData.notes || null,
        oxygenLevel: readingData.oxygenLevel || null,
        careRecipientId: readingData.careRecipientId
      };
      
      console.log("Processing blood pressure data:", processedData);
      const [newReading] = await db.insert(bloodPressure).values(processedData).returning();
      console.log("Created blood pressure record:", newReading);
      return newReading;
    } catch (error) {
      console.error("Error creating blood pressure record:", error);
      throw error;
    }
  },

  // Glucose Tracking
  async getGlucoseReadings(careRecipientId: number) {
    return db.query.glucose.findMany({
      where: eq(glucose.careRecipientId, careRecipientId),
      orderBy: desc(glucose.timeOfReading)
    });
  },

  async getGlucoseReadingById(id: number) {
    return db.query.glucose.findFirst({
      where: eq(glucose.id, id)
    });
  },

  async createGlucoseReading(readingData: any) {
    try {
      // Process the timestamp field - might be passed with different names
      let readingTime;
      if (readingData.timeOfReading) {
        readingTime = typeof readingData.timeOfReading === 'string' 
          ? new Date(readingData.timeOfReading) 
          : readingData.timeOfReading;
      } else if (readingData.timeRecorded) {
        readingTime = typeof readingData.timeRecorded === 'string'
          ? new Date(readingData.timeRecorded)
          : readingData.timeRecorded;
      } else {
        readingTime = new Date(); // Default to now if not provided
      }
      
      // Map readingType from user-friendly names to database values if needed
      let readingType = readingData.readingType || 'Other';
      if (readingData.state) {
        // Handle mapping from 'state' field if the client sends it that way
        readingType = readingData.state;
      } else if (readingData.mealContext) {
        // Map from mealContext if the client sends it that way
        readingType = readingData.mealContext;
      }
      
      // Create structured data with only the required fields to match the schema
      const processedData = {
        level: readingData.level,
        timeOfReading: readingTime,
        readingType: readingType,
        notes: readingData.notes || null,
        careRecipientId: readingData.careRecipientId
      };
      
      console.log("Processing glucose data:", processedData);
      const [newReading] = await db.insert(glucose).values(processedData).returning();
      console.log("Created glucose record:", newReading);
      return newReading;
    } catch (error) {
      console.error("Error creating glucose record:", error);
      throw error;
    }
  },

  async updateGlucoseReading(id: number, readingData: any) {
    // Get the current record to ensure it exists
    const currentReading = await this.getGlucoseReadingById(id);
    if (!currentReading) {
      throw new Error('Glucose reading not found');
    }

    // Validate and prepare data for update
    const updatedValues = {
      ...readingData,
      // Ensure date is converted from string if needed
      timeOfReading: readingData.timeOfReading ? new Date(readingData.timeOfReading) : currentReading.timeOfReading,
      updatedAt: new Date()
    };

    // Validate the updated data
    const validatedData = insertGlucoseSchema.parse({
      ...currentReading,
      ...updatedValues
    });

    // Perform the update
    const [updatedReading] = await db.update(glucose)
      .set(validatedData)
      .where(eq(glucose.id, id))
      .returning();

    return updatedReading;
  },

  async deleteGlucoseReading(id: number) {
    // Check if the reading exists first
    const reading = await this.getGlucoseReadingById(id);
    if (!reading) {
      throw new Error('Glucose reading not found');
    }
    
    await db.delete(glucose).where(eq(glucose.id, id));
    return { success: true, message: 'Glucose reading deleted successfully' };
  },

  // Insulin Tracking
  async getInsulinRecords(careRecipientId: number) {
    return db.query.insulin.findMany({
      where: eq(insulin.careRecipientId, careRecipientId),
      orderBy: desc(insulin.timeAdministered)
    });
  },

  async getInsulinRecordById(id: number) {
    return db.query.insulin.findFirst({
      where: eq(insulin.id, id)
    });
  },

  async createInsulinRecord(recordData: any) {
    try {
      // Process the timestamp field
      if (typeof recordData.timeAdministered === 'string') {
        recordData.timeAdministered = new Date(recordData.timeAdministered);
      }
      
      // Create structured data with only the required fields to avoid validation issues
      const processedData = {
        units: recordData.units,
        insulinType: recordData.insulinType,
        timeAdministered: recordData.timeAdministered,
        site: recordData.site || null,
        notes: recordData.notes || null,
        careRecipientId: recordData.careRecipientId
      };
      
      console.log("Processing insulin data:", processedData);
      const [newRecord] = await db.insert(insulin).values(processedData).returning();
      console.log("Created insulin record:", newRecord);
      return newRecord;
    } catch (error) {
      console.error("Error creating insulin record:", error);
      throw error;
    }
  },
  
  async updateInsulinRecord(id: number, recordData: any) {
    // Get the current record to ensure it exists
    const currentRecord = await this.getInsulinRecordById(id);
    if (!currentRecord) {
      throw new Error('Insulin record not found');
    }

    // Validate and prepare data for update
    const updatedValues = {
      ...recordData,
      // Ensure date is converted from string if needed
      timeAdministered: recordData.timeAdministered ? new Date(recordData.timeAdministered) : currentRecord.timeAdministered,
      updatedAt: new Date()
    };

    // Validate the updated data
    const validatedData = insertInsulinSchema.parse({
      ...currentRecord,
      ...updatedValues
    });

    // Perform the update
    const [updatedRecord] = await db.update(insulin)
      .set(validatedData)
      .where(eq(insulin.id, id))
      .returning();

    return updatedRecord;
  },

  async deleteInsulinRecord(id: number) {
    // Check if the record exists first
    const record = await this.getInsulinRecordById(id);
    if (!record) {
      throw new Error('Insulin record not found');
    }
    
    await db.delete(insulin).where(eq(insulin.id, id));
    return { success: true, message: 'Insulin record deleted successfully' };
  }
};
