import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const { isAuthenticated } = setupAuth(app);
  
  // API prefix
  const apiPrefix = '/api';

  // Care Recipients
  app.get(`${apiPrefix}/care-recipients`, async (req, res) => {
    try {
      const careRecipients = await storage.getCareRecipients();
      res.json(careRecipients);
    } catch (error) {
      console.error('Error fetching care recipients:', error);
      res.status(500).json({ message: 'Error fetching care recipients' });
    }
  });

  app.post(`${apiPrefix}/care-recipients`, async (req, res) => {
    try {
      const newRecipient = await storage.createCareRecipient(req.body);
      res.status(201).json(newRecipient);
    } catch (error) {
      console.error('Error creating care recipient:', error);
      res.status(500).json({ message: 'Error creating care recipient' });
    }
  });

  // Today's Care Stats
  app.get(`${apiPrefix}/care-stats/today`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const stats = await storage.getTodayStats(parseInt(careRecipientId));
      res.json(stats);
    } catch (error) {
      console.error('Error fetching today stats:', error);
      res.status(500).json({ message: 'Error fetching today stats' });
    }
  });

  // Upcoming Events
  app.get(`${apiPrefix}/events/upcoming`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const events = await storage.getUpcomingEvents(parseInt(careRecipientId));
      res.json(events);
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
      res.status(500).json({ message: 'Error fetching upcoming events' });
    }
  });

  // Medications
  app.get(`${apiPrefix}/medications`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      const filter = req.query.filter as string || 'today';
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const medications = await storage.getMedications(parseInt(careRecipientId), filter);
      res.json(medications);
    } catch (error) {
      console.error('Error fetching medications:', error);
      res.status(500).json({ message: 'Error fetching medications' });
    }
  });

  app.post(`${apiPrefix}/medications`, async (req, res) => {
    try {
      const newMedication = await storage.createMedication(req.body);
      res.status(201).json(newMedication);
    } catch (error) {
      console.error('Error creating medication:', error);
      res.status(500).json({ message: 'Error creating medication' });
    }
  });
  
  // Update medication inventory
  app.patch(`${apiPrefix}/medications/:id/inventory`, async (req, res) => {
    try {
      const medicationId = parseInt(req.params.id);
      const { currentQuantity, reorderThreshold, daysToReorder, originalQuantity, refillsRemaining, lastRefillDate } = req.body;
      
      const updatedMedication = await storage.updateMedicationInventory(
        medicationId, 
        { currentQuantity, reorderThreshold, daysToReorder, originalQuantity, refillsRemaining, lastRefillDate }
      );
      
      res.json(updatedMedication);
    } catch (error) {
      console.error('Error updating medication inventory:', error);
      res.status(500).json({ message: 'Error updating medication inventory' });
    }
  });
  
  // Refill medication inventory
  app.post(`${apiPrefix}/medications/:id/refill`, async (req, res) => {
    try {
      const medicationId = parseInt(req.params.id);
      const { refillAmount, refillDate } = req.body;
      
      const updatedMedication = await storage.refillMedication(
        medicationId, 
        refillAmount, 
        refillDate || new Date()
      );
      
      res.json(updatedMedication);
    } catch (error) {
      console.error('Error refilling medication:', error);
      res.status(500).json({ message: 'Error refilling medication' });
    }
  });
  
  // Get medications that need to be reordered
  app.get(`${apiPrefix}/medications/reorder-alerts`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const medications = await storage.getMedicationsNeedingReorder(parseInt(careRecipientId));
      res.json(medications);
    } catch (error) {
      console.error('Error fetching medications needing reorder:', error);
      res.status(500).json({ message: 'Error fetching medications needing reorder' });
    }
  });

  // Medication Logs
  app.get(`${apiPrefix}/medication-logs`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const logs = await storage.getMedicationLogs(parseInt(careRecipientId));
      res.json(logs);
    } catch (error) {
      console.error('Error fetching medication logs:', error);
      res.status(500).json({ message: 'Error fetching medication logs' });
    }
  });

  app.post(`${apiPrefix}/medication-logs`, async (req, res) => {
    try {
      // Handle the date conversion - the takenAt comes as a string from the client
      const logData = { 
        ...req.body,
        // Convert string date to actual Date object
        takenAt: req.body.takenAt ? new Date(req.body.takenAt) : new Date()
      };
      
      const newLog = await storage.createMedicationLog(logData);
      res.status(201).json(newLog);
    } catch (error) {
      console.error('Error creating medication log:', error);
      res.status(500).json({ message: 'Error creating medication log' });
    }
  });
  
  app.delete(`${apiPrefix}/medication-logs/:id`, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      if (isNaN(logId)) {
        return res.status(400).json({ message: 'Invalid medication log ID' });
      }
      
      // Add a method to delete medication log in storage.ts
      await storage.deleteMedicationLog(logId);
      res.status(200).json({ message: 'Medication log deleted successfully' });
    } catch (error) {
      console.error('Error deleting medication log:', error);
      res.status(500).json({ message: 'Error deleting medication log' });
    }
  });

  // Appointments
  app.get(`${apiPrefix}/appointments`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      const date = req.query.date as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const appointments = await storage.getAppointments(parseInt(careRecipientId), date);
      res.json(appointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ message: 'Error fetching appointments' });
    }
  });

  app.post(`${apiPrefix}/appointments`, async (req, res) => {
    try {
      const newAppointment = await storage.createAppointment(req.body);
      res.status(201).json(newAppointment);
    } catch (error) {
      console.error('Error creating appointment:', error);
      res.status(500).json({ message: 'Error creating appointment' });
    }
  });

  // Meals
  app.get(`${apiPrefix}/meals`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const meals = await storage.getMeals(parseInt(careRecipientId));
      res.json(meals);
    } catch (error) {
      console.error('Error fetching meals:', error);
      res.status(500).json({ message: 'Error fetching meals' });
    }
  });

  app.post(`${apiPrefix}/meals`, async (req, res) => {
    try {
      console.log('Received meal creation request with body:', req.body);
      
      // Ensure careRecipientId is a number
      const mealData = { 
        ...req.body,
        careRecipientId: parseInt(req.body.careRecipientId.toString())
      };
      
      console.log('Processed meal data:', mealData);
      
      const newMeal = await storage.createMeal(mealData);
      console.log('Meal created successfully:', newMeal);
      
      res.status(201).json(newMeal);
    } catch (error) {
      console.error('Error creating meal:', error);
      if (error instanceof Error) {
        res.status(500).json({ 
          message: 'Error creating meal', 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        res.status(500).json({ message: 'Unknown error creating meal' });
      }
    }
  });

  // Bowel Movements
  app.get(`${apiPrefix}/bowel-movements`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const movements = await storage.getBowelMovements(parseInt(careRecipientId));
      res.json(movements);
    } catch (error) {
      console.error('Error fetching bowel movements:', error);
      res.status(500).json({ message: 'Error fetching bowel movements' });
    }
  });

  app.post(`${apiPrefix}/bowel-movements`, async (req, res) => {
    try {
      console.log('Received bowel movement creation request with body:', req.body);
      
      // Transform the data received from the form 
      let movementData: any = {
        careRecipientId: parseInt(req.body.careRecipientId.toString()),
        notes: req.body.notes || '',
        type: req.body.name || 'Regular' // The type is in the name field from the form
      };
      
      // Handle date and time fields for occuredAt
      if (req.body.occuredAt) {
        // If occuredAt is directly provided, use it
        movementData.occuredAt = new Date(req.body.occuredAt);
      } else if (req.body.date && req.body.time) {
        // Otherwise construct from date and time fields
        const dateTimeStr = `${req.body.date}T${req.body.time}:00`;
        movementData.occuredAt = new Date(dateTimeStr);
        console.log('Created occuredAt from date/time:', dateTimeStr, movementData.occuredAt);
      } else {
        // Default to current time if no time provided
        movementData.occuredAt = new Date();
      }
      
      console.log('Processed bowel movement data:', movementData);
      
      const newMovement = await storage.createBowelMovement(movementData);
      console.log('Bowel movement created successfully:', newMovement);
      
      res.status(201).json(newMovement);
    } catch (error) {
      console.error('Error creating bowel movement:', error);
      if (error instanceof Error) {
        res.status(500).json({ 
          message: 'Error creating bowel movement', 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        res.status(500).json({ message: 'Unknown error creating bowel movement' });
      }
    }
  });
  
  app.delete(`${apiPrefix}/bowel-movements/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      await storage.deleteBowelMovement(id);
      res.status(200).json({ message: 'Bowel movement deleted successfully' });
    } catch (error) {
      console.error('Error deleting bowel movement:', error);
      res.status(500).json({ message: 'Error deleting bowel movement' });
    }
  });

  // Supplies
  app.get(`${apiPrefix}/supplies`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const supplies = await storage.getSupplies(parseInt(careRecipientId));
      res.json(supplies);
    } catch (error) {
      console.error('Error fetching supplies:', error);
      res.status(500).json({ message: 'Error fetching supplies' });
    }
  });

  app.post(`${apiPrefix}/supplies`, async (req, res) => {
    try {
      const newSupply = await storage.createSupply(req.body);
      res.status(201).json(newSupply);
    } catch (error) {
      console.error('Error creating supply:', error);
      res.status(500).json({ message: 'Error creating supply' });
    }
  });

  app.post(`${apiPrefix}/supply-usage`, async (req, res) => {
    try {
      const newUsage = await storage.createSupplyUsage(req.body);
      res.status(201).json(newUsage);
    } catch (error) {
      console.error('Error recording supply usage:', error);
      res.status(500).json({ message: 'Error recording supply usage' });
    }
  });

  // Sleep
  app.get(`${apiPrefix}/sleep`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const sleepRecords = await storage.getSleepRecords(parseInt(careRecipientId));
      res.json(sleepRecords);
    } catch (error) {
      console.error('Error fetching sleep records:', error);
      res.status(500).json({ message: 'Error fetching sleep records' });
    }
  });

  app.post(`${apiPrefix}/sleep`, async (req, res) => {
    try {
      console.log('Received sleep record creation request with body:', req.body);
      
      // Transform the data received from the form 
      let sleepData: any = {
        careRecipientId: parseInt(req.body.careRecipientId.toString()),
        notes: req.body.notes || '',
        quality: req.body.quality || 'Normal' // Use the quality field directly
      };
      
      // Handle bedTime (startTime)
      if (req.body.startTime) {
        sleepData.startTime = new Date(req.body.startTime);
      } else {
        // Default to current time if no time provided
        sleepData.startTime = new Date();
      }
      
      // Handle wakeTime (endTime) if provided
      if (req.body.endTime) {
        sleepData.endTime = new Date(req.body.endTime);
      } else {
        sleepData.endTime = null;
      }
      
      console.log('Processed sleep record data:', sleepData);
      
      const newSleep = await storage.createSleepRecord(sleepData);
      console.log('Sleep record created successfully:', newSleep);
      
      res.status(201).json(newSleep);
    } catch (error) {
      console.error('Error creating sleep record:', error);
      if (error instanceof Error) {
        res.status(500).json({ 
          message: 'Error creating sleep record', 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        res.status(500).json({ message: 'Unknown error creating sleep record' });
      }
    }
  });

  // Notes
  app.get(`${apiPrefix}/notes`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const notes = await storage.getNotes(parseInt(careRecipientId));
      res.json(notes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      res.status(500).json({ message: 'Error fetching notes' });
    }
  });

  app.get(`${apiPrefix}/notes/recent`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const notes = await storage.getRecentNotes(parseInt(careRecipientId));
      res.json(notes);
    } catch (error) {
      console.error('Error fetching recent notes:', error);
      res.status(500).json({ message: 'Error fetching recent notes' });
    }
  });

  app.post(`${apiPrefix}/notes`, async (req, res) => {
    try {
      const newNote = await storage.createNote(req.body);
      res.status(201).json(newNote);
    } catch (error) {
      console.error('Error creating note:', error);
      res.status(500).json({ message: 'Error creating note' });
    }
  });

  // Inspiration
  app.get(`${apiPrefix}/inspiration/daily`, async (req, res) => {
    try {
      const inspiration = await storage.getDailyInspiration();
      res.json(inspiration);
    } catch (error) {
      console.error('Error fetching daily inspiration:', error);
      res.status(500).json({ message: 'Error fetching daily inspiration' });
    }
  });

  // Doctors
  app.get(`${apiPrefix}/doctors`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const doctors = await storage.getDoctors(parseInt(careRecipientId));
      res.json(doctors);
    } catch (error) {
      console.error('Error fetching doctors:', error);
      res.status(500).json({ message: 'Error fetching doctors' });
    }
  });

  app.post(`${apiPrefix}/doctors`, async (req, res) => {
    try {
      const newDoctor = await storage.createDoctor(req.body);
      res.status(201).json(newDoctor);
    } catch (error) {
      console.error('Error creating doctor:', error);
      res.status(500).json({ message: 'Error creating doctor' });
    }
  });

  // Pharmacies
  app.get(`${apiPrefix}/pharmacies`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const pharmacies = await storage.getPharmacies(parseInt(careRecipientId));
      res.json(pharmacies);
    } catch (error) {
      console.error('Error fetching pharmacies:', error);
      res.status(500).json({ message: 'Error fetching pharmacies' });
    }
  });

  app.post(`${apiPrefix}/pharmacies`, async (req, res) => {
    try {
      const newPharmacy = await storage.createPharmacy(req.body);
      res.status(201).json(newPharmacy);
    } catch (error) {
      console.error('Error creating pharmacy:', error);
      res.status(500).json({ message: 'Error creating pharmacy' });
    }
  });

  // Medication Pharmacy Relations
  app.get(`${apiPrefix}/medication-pharmacies`, async (req, res) => {
    try {
      const medicationId = req.query.medicationId as string;
      
      if (!medicationId) {
        return res.status(400).json({ message: 'Medication ID is required' });
      }
      
      const medicationPharmacies = await storage.getMedicationPharmacies(parseInt(medicationId));
      res.json(medicationPharmacies);
    } catch (error) {
      console.error('Error fetching medication pharmacies:', error);
      res.status(500).json({ message: 'Error fetching medication pharmacies' });
    }
  });

  app.post(`${apiPrefix}/medication-pharmacies`, async (req, res) => {
    try {
      const newMedicationPharmacy = await storage.createMedicationPharmacy(req.body);
      res.status(201).json(newMedicationPharmacy);
    } catch (error) {
      console.error('Error creating medication pharmacy relation:', error);
      res.status(500).json({ message: 'Error creating medication pharmacy relation' });
    }
  });

  // Users
  app.post(`${apiPrefix}/users`, async (req, res) => {
    try {
      const newUser = await storage.createUser(req.body);
      res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Error creating user' });
    }
  });

  // Emergency Info - Protected Routes
  app.get(`${apiPrefix}/emergency-info`, isAuthenticated, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const emergencyInfo = await storage.getEmergencyInfo(parseInt(careRecipientId));
      res.json(emergencyInfo);
    } catch (error) {
      console.error('Error fetching emergency info:', error);
      res.status(500).json({ message: 'Error fetching emergency info' });
    }
  });

  app.get(`${apiPrefix}/emergency-info/:id`, isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const emergencyInfo = await storage.getEmergencyInfoById(parseInt(id));
      
      if (!emergencyInfo) {
        return res.status(404).json({ message: 'Emergency info not found' });
      }
      
      res.json(emergencyInfo);
    } catch (error) {
      console.error('Error fetching emergency info by ID:', error);
      res.status(500).json({ message: 'Error fetching emergency info by ID' });
    }
  });

  app.post(`${apiPrefix}/emergency-info`, isAuthenticated, async (req, res) => {
    try {
      const newEmergencyInfo = await storage.createEmergencyInfo(req.body);
      res.status(201).json(newEmergencyInfo);
    } catch (error) {
      console.error('Error creating emergency info:', error);
      res.status(500).json({ message: 'Error creating emergency info' });
    }
  });

  app.patch(`${apiPrefix}/emergency-info/:id`, isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const updatedEmergencyInfo = await storage.updateEmergencyInfo(parseInt(id), req.body);
      
      if (!updatedEmergencyInfo) {
        return res.status(404).json({ message: 'Emergency info not found' });
      }
      
      res.json(updatedEmergencyInfo);
    } catch (error) {
      console.error('Error updating emergency info:', error);
      res.status(500).json({ message: 'Error updating emergency info' });
    }
  });
  
  // PIN Verification for Emergency Info
  app.post(`${apiPrefix}/emergency-info/:id/verify-pin`, isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({ message: 'PIN is required' });
      }
      
      const emergencyInfo = await storage.getEmergencyInfoById(parseInt(id));
      
      if (!emergencyInfo) {
        return res.status(404).json({ message: 'Emergency info not found' });
      }
      
      const isPinValid = await storage.verifyEmergencyInfoPin(parseInt(id), pin);
      
      if (!isPinValid) {
        return res.status(401).json({ message: 'Invalid PIN' });
      }
      
      res.status(200).json({ message: 'PIN verified successfully', verified: true });
    } catch (error) {
      console.error('Error verifying PIN:', error);
      res.status(500).json({ message: 'Error verifying PIN' });
    }
  });
  
  // Set PIN for Emergency Info
  app.post(`${apiPrefix}/emergency-info/:id/set-pin`, isAuthenticated, async (req, res) => {
    try {
      const id = req.params.id;
      const { pin } = req.body;
      
      if (!pin) {
        return res.status(400).json({ message: 'PIN is required' });
      }
      
      // Validate PIN format (4 digits)
      if (!/^\d{4}$/.test(pin)) {
        return res.status(400).json({ message: 'PIN must be a 4-digit number' });
      }
      
      const emergencyInfo = await storage.getEmergencyInfoById(parseInt(id));
      
      if (!emergencyInfo) {
        return res.status(404).json({ message: 'Emergency info not found' });
      }
      
      await storage.setEmergencyInfoPin(parseInt(id), pin);
      
      res.status(200).json({ message: 'PIN set successfully', success: true });
    } catch (error) {
      console.error('Error setting PIN:', error);
      res.status(500).json({ message: 'Error setting PIN' });
    }
  });

  // Blood Pressure Tracking
  app.get(`${apiPrefix}/blood-pressure`, isAuthenticated, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const readings = await storage.getBloodPressureReadings(parseInt(careRecipientId));
      res.json(readings);
    } catch (error) {
      console.error('Error fetching blood pressure readings:', error);
      res.status(500).json({ message: 'Error fetching blood pressure readings' });
    }
  });

  app.post(`${apiPrefix}/blood-pressure`, isAuthenticated, async (req, res) => {
    try {
      const newReading = await storage.createBloodPressureReading(req.body);
      res.status(201).json(newReading);
    } catch (error) {
      console.error('Error creating blood pressure reading:', error);
      res.status(500).json({ message: 'Error creating blood pressure reading' });
    }
  });

  // Glucose Tracking
  app.get(`${apiPrefix}/glucose`, isAuthenticated, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const readings = await storage.getGlucoseReadings(parseInt(careRecipientId));
      res.json(readings);
    } catch (error) {
      console.error('Error fetching glucose readings:', error);
      res.status(500).json({ message: 'Error fetching glucose readings' });
    }
  });

  app.post(`${apiPrefix}/glucose`, isAuthenticated, async (req, res) => {
    try {
      const newReading = await storage.createGlucoseReading(req.body);
      res.status(201).json(newReading);
    } catch (error) {
      console.error('Error creating glucose reading:', error);
      res.status(500).json({ message: 'Error creating glucose reading' });
    }
  });

  // Insulin Tracking
  app.get(`${apiPrefix}/insulin`, isAuthenticated, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const records = await storage.getInsulinRecords(parseInt(careRecipientId));
      res.json(records);
    } catch (error) {
      console.error('Error fetching insulin records:', error);
      res.status(500).json({ message: 'Error fetching insulin records' });
    }
  });

  app.post(`${apiPrefix}/insulin`, isAuthenticated, async (req, res) => {
    try {
      const newRecord = await storage.createInsulinRecord(req.body);
      res.status(201).json(newRecord);
    } catch (error) {
      console.error('Error creating insulin record:', error);
      res.status(500).json({ message: 'Error creating insulin record' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
