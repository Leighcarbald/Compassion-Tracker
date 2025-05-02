import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, scheduleMidnightReset } from "./storage";
import { setupAuth } from "./auth";
import { setupWebAuthn } from "./webauthn";
import * as medicationService from "./services/medicationService";
import * as healthDataService from "./services/healthDataService";
import { WebSocketServer } from "ws";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { healthDeviceConnections } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const { isAuthenticated } = setupAuth(app);
  
  // Set up WebAuthn for biometric authentication
  await setupWebAuthn(app);
  
  // Initialize the midnight stats reset scheduler
  scheduleMidnightReset();
  console.log('Midnight reset scheduler initialized');
  
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
  
  app.delete(`${apiPrefix}/care-recipients/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const result = await storage.deleteCareRecipient(id);
      res.status(200).json(result);
    } catch (error) {
      console.error('Error deleting care recipient:', error);
      res.status(500).json({ message: 'Error deleting care recipient' });
    }
  });
  
  app.patch(`${apiPrefix}/care-recipients/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const { name } = req.body;
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ message: 'Name is required' });
      }
      
      const result = await storage.updateCareRecipient(id, { name: name.trim() });
      res.status(200).json(result);
    } catch (error) {
      console.error('Error updating care recipient:', error);
      res.status(500).json({ message: 'Error updating care recipient' });
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
  
  // Get Care Stats for a specific date
  app.get(`${apiPrefix}/care-stats/date`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      const date = req.query.date as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format' });
      }
      
      // Get date range for the specified date
      const { start, end } = storage.getDateRange(date);
      
      // Get stats for the specified date
      const stats = await storage.getDateStats(parseInt(careRecipientId), start, end);
      res.json(stats);
    } catch (error) {
      console.error('Error fetching date stats:', error);
      res.status(500).json({ message: 'Error fetching date stats' });
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

  // Update medication information
  app.patch(`${apiPrefix}/medications/:id`, async (req, res) => {
    try {
      const medicationId = parseInt(req.params.id);
      if (isNaN(medicationId)) {
        return res.status(400).json({ message: 'Invalid medication ID' });
      }
      
      const updatedMedication = await storage.updateMedication(medicationId, req.body);
      res.json(updatedMedication);
    } catch (error) {
      console.error('Error updating medication:', error);
      res.status(500).json({ message: 'Error updating medication' });
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
  
  // Medication Schedules
  app.get(`${apiPrefix}/medication-schedules`, async (req, res) => {
    try {
      const medicationId = req.query.medicationId as string;
      
      if (!medicationId) {
        return res.status(400).json({ message: 'Medication ID is required' });
      }
      
      const schedules = await storage.getMedicationSchedules(parseInt(medicationId));
      res.json(schedules);
    } catch (error) {
      console.error('Error fetching medication schedules:', error);
      res.status(500).json({ message: 'Error fetching medication schedules' });
    }
  });
  
  app.post(`${apiPrefix}/medication-schedules`, async (req, res) => {
    try {
      const newSchedule = await storage.createMedicationSchedule(req.body);
      res.status(201).json(newSchedule);
    } catch (error) {
      console.error('Error creating medication schedule:', error);
      res.status(500).json({ message: 'Error creating medication schedule' });
    }
  });
  
  app.patch(`${apiPrefix}/medication-schedules/:id`, async (req, res) => {
    try {
      const scheduleId = parseInt(req.params.id);
      if (isNaN(scheduleId)) {
        return res.status(400).json({ message: 'Invalid schedule ID' });
      }
      
      // First get the existing schedule to ensure it exists
      const existingSchedules = await storage.getMedicationSchedules(req.body.medicationId);
      const existingSchedule = existingSchedules.find(s => s.id === scheduleId);
      
      if (!existingSchedule) {
        return res.status(404).json({ message: 'Medication schedule not found' });
      }
      
      // Update the schedule by deleting and recreating with the same ID
      await storage.deleteMedicationSchedule(scheduleId);
      const updatedSchedule = await storage.createMedicationSchedule({
        ...req.body,
        id: scheduleId
      });
      
      // Always return a proper JSON response with the updated schedule
      res.status(200).json(updatedSchedule || { 
        id: scheduleId,
        ...req.body,
        message: "Schedule updated successfully" 
      });
    } catch (error) {
      console.error('Error updating medication schedule:', error);
      res.status(500).json({ message: 'Error updating medication schedule' });
    }
  });
  
  app.delete(`${apiPrefix}/medication-schedules/:id`, async (req, res) => {
    try {
      const scheduleId = req.params.id;
      
      // Try to parse as integer if possible
      const numericId = parseInt(scheduleId);
      
      // Use the numeric ID if valid, otherwise use the original string ID
      const idToUse = !isNaN(numericId) ? numericId : scheduleId;
      
      console.log(`Attempting to delete schedule with ID: ${idToUse} (${typeof idToUse})`);
      await storage.deleteMedicationSchedule(idToUse);
      
      res.status(200).json({ message: 'Medication schedule deleted successfully' });
    } catch (error) {
      console.error('Error deleting medication schedule:', error);
      res.status(500).json({ message: 'Error deleting medication schedule' });
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
  
  // Drug Database - Get medication name suggestions
  app.get(`${apiPrefix}/medications/suggestions`, async (req, res) => {
    try {
      const partialName = req.query.name as string;
      
      if (!partialName || partialName.length < 2) {
        return res.status(400).json({ message: 'Medication name must be at least 2 characters' });
      }
      
      const suggestions = await medicationService.getMedicationNameSuggestions(partialName);
      res.json(suggestions);
    } catch (error) {
      console.error('Error getting medication name suggestions:', error);
      res.status(500).json({ message: 'Error getting medication name suggestions' });
    }
  });
  
  // Drug Database - Check for drug interactions
  app.post(`${apiPrefix}/medications/interactions`, async (req, res) => {
    try {
      const { medicationNames } = req.body;
      
      if (!medicationNames || !Array.isArray(medicationNames) || medicationNames.length === 0) {
        return res.status(400).json({ 
          success: true,
          interactions: [],
          message: 'Medication names array is required'
        });
      }
      
      console.log(`Checking interactions for medications: ${medicationNames.join(', ')}`);
      
      // First try our fallback mechanism directly since external API is having issues
      const knownInteractions = medicationService.checkKnownInteractions(medicationNames);
      if (knownInteractions.interactions.length > 0) {
        console.log('Found interactions using known medication database');
        return res.json(knownInteractions);
      }
      
      // If no known interactions, try the full service with external API
      try {
        const result = await medicationService.checkDrugInteractionsByNames(medicationNames);
        res.json(result);
      } catch (serviceError) {
        console.error('Service error:', serviceError);
        // Return empty interactions rather than an error
        res.json({ 
          success: true,
          interactions: [],
          message: 'No interactions found'
        });
      }
    } catch (error) {
      console.error('Error checking drug interactions:', error);
      // Return empty interactions rather than an error
      res.json({ 
        success: true,
        interactions: [],
        message: 'No interactions found due to service error'
      });
    }
  });
  
  // Drug Database - Get medication information
  app.get(`${apiPrefix}/medications/info/:name`, async (req, res) => {
    try {
      const medicationName = req.params.name;
      
      if (!medicationName) {
        return res.status(400).json({ message: 'Medication name is required' });
      }
      
      // First get the RxCUI
      const rxcuiResult = await medicationService.getRxCuiByName(medicationName);
      
      if (!rxcuiResult.success || !rxcuiResult.rxcui) {
        return res.status(404).json({ message: 'Medication not found in database' });
      }
      
      // Then get the medication information
      const medicationInfo = await medicationService.getMedicationInfoByRxCui(rxcuiResult.rxcui);
      res.json(medicationInfo);
    } catch (error) {
      console.error('Error getting medication information:', error);
      res.status(500).json({ message: 'Error getting medication information' });
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
  // First define /appointments/month route (more specific) before the general /appointments route
  app.get(`${apiPrefix}/appointments/month`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      const yearMonth = req.query.yearMonth as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      if (!yearMonth || !yearMonth.match(/^\d{4}-\d{2}$/)) {
        return res.status(400).json({ message: 'Year-Month must be in YYYY-MM format' });
      }
      
      const appointments = await storage.getMonthAppointments(parseInt(careRecipientId), yearMonth);
      res.json(appointments);
    } catch (error) {
      console.error('Error fetching month appointments:', error);
      res.status(500).json({ message: 'Error fetching month appointments' });
    }
  });

  // Then define /appointments route (more general)
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
  
  app.delete(`${apiPrefix}/appointments/:id`, async (req, res) => {
    try {
      const appointmentId = parseInt(req.params.id);
      await storage.deleteAppointment(appointmentId);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      res.status(500).json({ message: 'Error deleting appointment' });
    }
  });

  // Meals
  app.get(`${apiPrefix}/meals`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      const date = req.query.date as string;
      const all = req.query.all === 'true';
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      console.log(`Fetching meals for care recipient ${careRecipientId}, date: ${date || 'not specified'}, all: ${all}`);
      
      // If 'all' is specified, get all meals regardless of date
      if (all) {
        const meals = await storage.getMeals(parseInt(careRecipientId), null);
        return res.json(meals);
      }
      
      // If date is provided, get meals for that specific date range
      if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Get date range for the specified date
        const { start, end } = storage.getDateRange(date);
        const meals = await storage.getMeals(parseInt(careRecipientId), { start, end });
        console.log(`Found ${meals.length} meals for date ${date}`);
        return res.json(meals);
      }
      
      // Otherwise, get today's meals (default behavior)
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
  
  app.patch(`${apiPrefix}/meals/:id`, async (req, res) => {
    try {
      const mealId = parseInt(req.params.id);
      
      if (isNaN(mealId)) {
        return res.status(400).json({ message: 'Invalid meal ID' });
      }
      
      console.log(`Received update request for meal ${mealId} with body:`, req.body);
      
      const updatedMeal = await storage.updateMeal(mealId, req.body);
      console.log(`Meal ${mealId} updated successfully:`, updatedMeal);
      
      res.json(updatedMeal);
    } catch (error) {
      console.error(`Error updating meal:`, error);
      if (error instanceof Error) {
        res.status(500).json({ 
          message: 'Error updating meal', 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        res.status(500).json({ message: 'Unknown error updating meal' });
      }
    }
  });
  
  app.delete(`${apiPrefix}/meals/:id`, async (req, res) => {
    try {
      const mealId = parseInt(req.params.id);
      
      if (isNaN(mealId)) {
        return res.status(400).json({ message: 'Invalid meal ID' });
      }
      
      console.log(`Received delete request for meal ${mealId}`);
      
      await storage.deleteMeal(mealId);
      console.log(`Meal ${mealId} deleted successfully`);
      
      res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting meal:`, error);
      if (error instanceof Error) {
        res.status(500).json({ 
          message: 'Error deleting meal', 
          error: error.message
        });
      } else {
        res.status(500).json({ message: 'Unknown error deleting meal' });
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
  
  app.patch(`${apiPrefix}/bowel-movements/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      console.log('Received bowel movement update request with body:', req.body);
      
      // Transform the data received from the form
      let updateData: any = {
        ...req.body
      };
      
      // Handle occuredAt date/time
      if (req.body.occuredAt) {
        // If occuredAt is directly provided, use it
        updateData.occuredAt = new Date(req.body.occuredAt);
      } else if (req.body.date && req.body.time) {
        // Otherwise construct from date and time fields
        const dateTimeStr = `${req.body.date}T${req.body.time}:00`;
        updateData.occuredAt = new Date(dateTimeStr);
        console.log('Created occuredAt from date/time:', dateTimeStr, updateData.occuredAt);
        
        // Remove the date and time fields as they're not in the schema
        delete updateData.date;
        delete updateData.time;
      }
      
      console.log('Processed bowel movement update data:', updateData);
      
      const updatedMovement = await storage.updateBowelMovement(id, updateData);
      console.log('Bowel movement updated successfully:', updatedMovement);
      
      res.status(200).json(updatedMovement);
    } catch (error) {
      console.error('Error updating bowel movement:', error);
      if (error instanceof Error) {
        res.status(500).json({ 
          message: 'Error updating bowel movement', 
          error: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
      } else {
        res.status(500).json({ message: 'Unknown error updating bowel movement' });
      }
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
      const all = req.query.all === 'true';
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      console.log(`Fetching sleep records for care recipient ${careRecipientId}, all: ${all}`);
      
      // For now, we don't have a date filter for sleep, but we log the all parameter for consistency
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
  
  // Update doctor
  app.put(`${apiPrefix}/doctors/:id`, async (req, res) => {
    try {
      const doctorId = parseInt(req.params.id);
      if (isNaN(doctorId)) {
        return res.status(400).json({ message: 'Invalid doctor ID' });
      }
      
      const updatedDoctor = await storage.updateDoctor(doctorId, req.body);
      res.json(updatedDoctor);
    } catch (error) {
      console.error('Error updating doctor:', error);
      res.status(500).json({ message: 'Error updating doctor' });
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

  // Emergency Info Routes - PIN protection is handled separately in the component
  app.get(`${apiPrefix}/emergency-info`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const recipientIdNum = parseInt(careRecipientId);
      let emergencyInfo = await storage.getEmergencyInfo(recipientIdNum);
      
      console.log(`Emergency info for care recipient #${careRecipientId}:`, emergencyInfo);
      
      // If no emergency info exists, create a default one
      if (!emergencyInfo) {
        console.log(`No emergency info found for care recipient #${careRecipientId}, creating default entry`);
        
        // Create a default emergency info entry
        emergencyInfo = await storage.createEmergencyInfo({
          careRecipientId: recipientIdNum,
          // All other fields will be empty/null
        });
        
        console.log(`Created default emergency info:`, emergencyInfo);
      }
      
      res.json(emergencyInfo);
    } catch (error) {
      console.error('Error fetching emergency info:', error);
      res.status(500).json({ message: 'Error fetching emergency info' });
    }
  });

  app.get(`${apiPrefix}/emergency-info/:id`, async (req, res) => {
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

  app.post(`${apiPrefix}/emergency-info`, async (req, res) => {
    try {
      const newEmergencyInfo = await storage.createEmergencyInfo(req.body);
      res.status(201).json(newEmergencyInfo);
    } catch (error) {
      console.error('Error creating emergency info:', error);
      res.status(500).json({ message: 'Error creating emergency info' });
    }
  });

  app.patch(`${apiPrefix}/emergency-info/:id`, async (req, res) => {
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
  app.post(`${apiPrefix}/emergency-info/:id/verify-pin`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { pin } = req.body;
      
      console.log(`Attempting to verify PIN for emergency info #${id}`);
      
      if (!pin) {
        console.log(`PIN verification failed: PIN required`);
        return res.status(400).json({ message: 'PIN is required', verified: false });
      }
      
      // Validate PIN format (6 digits)
      if (!/^\d{6}$/.test(pin)) {
        console.log(`PIN verification failed: Invalid PIN format`);
        return res.status(400).json({ message: 'PIN must be a 6-digit number', verified: false });
      }
      
      if (isNaN(id)) {
        console.log(`PIN verification failed: Invalid ID ${req.params.id}`);
        return res.status(400).json({ message: 'Invalid emergency info ID', verified: false });
      }
      
      const emergencyInfo = await storage.getEmergencyInfoById(id);
      
      if (!emergencyInfo) {
        console.log(`PIN verification failed: Emergency info #${id} not found`);
        return res.status(404).json({ message: 'Emergency info not found', verified: false });
      }
      
      // Verify the PIN
      const isPinValid = await storage.verifyEmergencyInfoPin(id, pin);
      
      if (!isPinValid) {
        console.log(`PIN verification failed: Invalid PIN for emergency info #${id}`);
        return res.status(200).json({ message: 'Invalid PIN', verified: false });
      }
      
      // Store verification in a signed cookie (secure in prod, httpOnly for all)
      // Cookie will expire in 24 hours (1 day)
      const cookieOptions = {
        httpOnly: true,
        secure: req.secure || req.get('x-forwarded-proto') === 'https',
        signed: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      };
      
      // Create a cookie storing the verified emergency info ID
      const cookieName = `emergency_info_verified_${id}`;
      const cookieValue = 'true';
      
      res.cookie(cookieName, cookieValue, cookieOptions);
      
      console.log(`PIN verified successfully for emergency info #${id}, cookie set`);
      res.status(200).json({ 
        message: 'PIN verified successfully', 
        verified: true,
        id: id
      });
    } catch (error) {
      console.error('Error verifying PIN:', error);
      res.status(500).json({ message: 'Error verifying PIN', verified: false });
    }
  });
  
  // Check if a PIN is verified for an emergency info by checking the cookie
  // DO NOT apply rate limiting to this endpoint - it's used to check verification status
  app.get(`${apiPrefix}/emergency-info/:id/check-verified`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        console.log(`Check verified failed: Invalid ID ${req.params.id}`);
        return res.status(400).json({ message: 'Invalid emergency info ID', verified: false });
      }
      
      // Check for the cookie that indicates PIN verification
      const cookieName = `emergency_info_verified_${id}`;
      const isVerified = req.signedCookies[cookieName] === 'true';
      
      return res.status(200).json({ 
        verified: isVerified,
        id
      });
    } catch (error) {
      console.error('Error checking if PIN is verified:', error);
      res.status(500).json({ message: 'Server error', verified: false });
    }
  });
  
  // Clear PIN verification (lock emergency info)
  app.post(`${apiPrefix}/emergency-info/:id/lock`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        console.log(`Lock failed: Invalid ID ${req.params.id}`);
        return res.status(400).json({ message: 'Invalid emergency info ID', success: false });
      }
      
      // Clear the cookie that indicates PIN verification by setting it to expired
      const cookieName = `emergency_info_verified_${id}`;
      res.clearCookie(cookieName);
      
      console.log(`PIN verification cookie cleared for emergency info #${id}`);
      return res.status(200).json({ 
        message: 'Emergency info locked successfully',
        success: true,
        id
      });
    } catch (error) {
      console.error('Error locking emergency info:', error);
      res.status(500).json({ message: 'Server error', success: false });
    }
  });
  
  // Set PIN for Emergency Info
  app.post(`${apiPrefix}/emergency-info/:id/set-pin`, async (req, res) => {
    try {
      console.log('Set PIN request received with body:', req.body);
      console.log('Request params:', req.params);
      
      const id = parseInt(req.params.id);
      const { pin } = req.body;
      
      console.log(`Setting PIN for emergency info #${id}, pin value type: ${typeof pin}, pin length: ${pin ? pin.length : 'undefined'}`);
      
      if (!pin) {
        console.log(`Set PIN failed: PIN required`);
        return res.status(400).json({ message: 'PIN is required', success: false });
      }
      
      if (isNaN(id)) {
        console.log(`Set PIN failed: Invalid ID ${req.params.id}`);
        return res.status(400).json({ message: 'Invalid emergency info ID', success: false });
      }
      
      // Validate PIN format (6 digits)
      if (!/^\d{6}$/.test(pin.toString())) {
        console.log(`Set PIN failed: Invalid PIN format, value: ${pin}`);
        return res.status(400).json({ message: 'PIN must be a 6-digit number', success: false });
      }
      
      const emergencyInfo = await storage.getEmergencyInfoById(id);
      
      if (!emergencyInfo) {
        console.log(`Set PIN failed: Emergency info #${id} not found`);
        return res.status(404).json({ message: 'Emergency info not found', success: false });
      }
      
      await storage.setEmergencyInfoPin(id, pin);
      
      // After setting the PIN, mark this emergency info as verified by setting a cookie
      const cookieOptions = {
        httpOnly: true,
        secure: req.secure || req.get('x-forwarded-proto') === 'https',
        signed: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      };
      
      // Create a cookie storing the verified emergency info ID
      const cookieName = `emergency_info_verified_${id}`;
      const cookieValue = 'true';
      
      res.cookie(cookieName, cookieValue, cookieOptions);
      
      console.log(`PIN set successfully for emergency info #${id}, cookie set`);
      res.status(200).json({ 
        message: 'PIN set successfully', 
        success: true,
        id
      });
    } catch (error) {
      console.error('Error setting PIN:', error);
      res.status(500).json({ message: 'Error setting PIN', success: false });
    }
  });

  // Blood Pressure Tracking
  app.get(`${apiPrefix}/blood-pressure`, async (req, res) => {
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

  app.post(`${apiPrefix}/blood-pressure`, async (req, res) => {
    try {
      // Handle date conversion for timeOfReading if it's provided as a string
      const readingData = { 
        ...req.body,
        // Convert string date to actual Date object if it's a string
        timeOfReading: req.body.timeOfReading ? new Date(req.body.timeOfReading) : new Date()
      };
      
      const newReading = await storage.createBloodPressureReading(readingData);
      res.status(201).json(newReading);
    } catch (error) {
      console.error('Error creating blood pressure reading:', error);
      res.status(500).json({ message: 'Error creating blood pressure reading' });
    }
  });

  // Glucose Tracking
  app.get(`${apiPrefix}/glucose`, async (req, res) => {
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

  app.get(`${apiPrefix}/glucose/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const reading = await storage.getGlucoseReadingById(id);
      if (!reading) {
        return res.status(404).json({ message: 'Glucose reading not found' });
      }
      
      res.json(reading);
    } catch (error) {
      console.error('Error fetching glucose reading:', error);
      res.status(500).json({ message: 'Error fetching glucose reading' });
    }
  });

  app.post(`${apiPrefix}/glucose`, async (req, res) => {
    try {
      // Handle date conversion for timeOfReading if it's provided as a string
      const readingData = { 
        ...req.body,
        // Convert string date to actual Date object if it's a string
        timeOfReading: req.body.timeOfReading ? new Date(req.body.timeOfReading) : new Date()
      };
      
      const newReading = await storage.createGlucoseReading(readingData);
      res.status(201).json(newReading);
    } catch (error) {
      console.error('Error creating glucose reading:', error);
      res.status(500).json({ message: 'Error creating glucose reading' });
    }
  });
  
  app.patch(`${apiPrefix}/glucose/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const updatedReading = await storage.updateGlucoseReading(id, req.body);
      res.json(updatedReading);
    } catch (error) {
      console.error('Error updating glucose reading:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error updating glucose reading' 
      });
    }
  });
  
  app.delete(`${apiPrefix}/glucose/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const result = await storage.deleteGlucoseReading(id);
      res.json(result);
    } catch (error) {
      console.error('Error deleting glucose reading:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error deleting glucose reading' 
      });
    }
  });

  // Insulin Tracking
  app.get(`${apiPrefix}/insulin`, async (req, res) => {
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

  app.get(`${apiPrefix}/insulin/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const record = await storage.getInsulinRecordById(id);
      if (!record) {
        return res.status(404).json({ message: 'Insulin record not found' });
      }
      
      res.json(record);
    } catch (error) {
      console.error('Error fetching insulin record:', error);
      res.status(500).json({ message: 'Error fetching insulin record' });
    }
  });

  app.post(`${apiPrefix}/insulin`, async (req, res) => {
    try {
      // Handle date conversion for timeAdministered if it's provided as a string
      const recordData = {
        ...req.body,
        // Convert string date to actual Date object if it's a string
        timeAdministered: req.body.timeAdministered ? new Date(req.body.timeAdministered) : new Date()
      };
      
      const newRecord = await storage.createInsulinRecord(recordData);
      res.status(201).json(newRecord);
    } catch (error) {
      console.error('Error creating insulin record:', error);
      res.status(500).json({ message: 'Error creating insulin record' });
    }
  });
  
  app.patch(`${apiPrefix}/insulin/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const updatedRecord = await storage.updateInsulinRecord(id, req.body);
      res.json(updatedRecord);
    } catch (error) {
      console.error('Error updating insulin record:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error updating insulin record' 
      });
    }
  });
  
  app.delete(`${apiPrefix}/insulin/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const result = await storage.deleteInsulinRecord(id);
      res.json(result);
    } catch (error) {
      console.error('Error deleting insulin record:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error deleting insulin record' 
      });
    }
  });

  // Health Platform Integration Routes
  // Get authorization URL for health platforms
  app.get(`${apiPrefix}/health-platforms/auth-url`, async (req, res) => {
    try {
      const provider = req.query.provider as string;
      const careRecipientId = parseInt(req.query.careRecipientId as string);
      
      if (!provider || !['google', 'apple', 'fitbit', 'samsung', 'garmin'].includes(provider)) {
        return res.status(400).json({ message: 'Invalid health provider' });
      }
      
      if (isNaN(careRecipientId)) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const authUrl = healthDataService.getAuthorizationUrl(provider as any, careRecipientId);
      res.json({ authUrl });
    } catch (error) {
      console.error('Error generating auth URL:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error generating auth URL' 
      });
    }
  });
  
  // OAuth callback for Google Fit
  app.get(`${apiPrefix}/oauth/google/callback`, async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      
      if (!code) {
        return res.status(400).json({ message: 'Authorization code is required' });
      }
      
      // Parse state parameter which contains careRecipientId and provider
      let stateObj;
      try {
        stateObj = JSON.parse(state);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }
      
      const { careRecipientId, provider } = stateObj;
      
      if (!careRecipientId || provider !== 'google') {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }
      
      // Exchange code for tokens
      const tokens = await healthDataService.exchangeCodeForTokens('google', code);
      
      // Create or update health device connection
      const connection = await db
        .insert(healthDeviceConnections)
        .values({
          careRecipientId,
          provider: 'google',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
          providerUserId: tokens.providerUserId,
          syncEnabled: true,
          lastSynced: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .onConflictDoUpdate({
          target: [healthDeviceConnections.careRecipientId, healthDeviceConnections.provider],
          set: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || undefined,
            tokenExpiry: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined,
            providerUserId: tokens.providerUserId || undefined,
            syncEnabled: true,
            updatedAt: new Date()
          }
        });
      
      // Redirect to success page
      res.redirect('/#/health-connection-success');
    } catch (error) {
      console.error('Error exchanging OAuth code:', error);
      // Redirect to error page
      res.redirect(`/#/health-connection-error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
    }
  });
  
  // OAuth callback for Apple Health
  app.post(`${apiPrefix}/oauth/apple/callback`, async (req, res) => {
    try {
      const code = req.body.code;
      const state = req.body.state;
      
      if (!code) {
        return res.status(400).json({ message: 'Authorization code is required' });
      }
      
      // Parse state parameter which contains careRecipientId and provider
      let stateObj;
      try {
        stateObj = JSON.parse(state);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }
      
      const { careRecipientId, provider } = stateObj;
      
      if (!careRecipientId || provider !== 'apple') {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }
      
      // Exchange code for tokens
      const tokens = await healthDataService.exchangeCodeForTokens('apple', code);
      
      // Create or update health device connection
      const connection = await db
        .insert(healthDeviceConnections)
        .values({
          careRecipientId,
          provider: 'apple',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
          providerUserId: tokens.providerUserId,
          syncEnabled: true,
          lastSynced: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .onConflictDoUpdate({
          target: [healthDeviceConnections.careRecipientId, healthDeviceConnections.provider],
          set: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || undefined,
            tokenExpiry: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined,
            providerUserId: tokens.providerUserId || undefined,
            syncEnabled: true,
            updatedAt: new Date()
          }
        });
      
      // Redirect to success page - using form post instead of redirect for Apple
      res.send(`
        <html>
          <body>
            <script>
              window.location.href = '/#/health-connection-success';
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error exchanging Apple OAuth code:', error);
      // Redirect to error page using form post
      res.send(`
        <html>
          <body>
            <script>
              window.location.href = '/#/health-connection-error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}';
            </script>
          </body>
        </html>
      `);
    }
  });
  
  // OAuth callback for Fitbit
  app.get(`${apiPrefix}/oauth/fitbit/callback`, async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      
      if (!code) {
        return res.status(400).json({ message: 'Authorization code is required' });
      }
      
      // Parse state parameter which contains careRecipientId and provider
      let stateObj;
      try {
        stateObj = JSON.parse(state);
      } catch (e) {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }
      
      const { careRecipientId, provider } = stateObj;
      
      if (!careRecipientId || provider !== 'fitbit') {
        return res.status(400).json({ message: 'Invalid state parameter' });
      }
      
      // Exchange code for tokens
      const tokens = await healthDataService.exchangeCodeForTokens('fitbit', code);
      
      // Create or update health device connection
      const connection = await db
        .insert(healthDeviceConnections)
        .values({
          careRecipientId,
          provider: 'fitbit',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiry: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : null,
          providerUserId: tokens.providerUserId,
          syncEnabled: true,
          lastSynced: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()
        .onConflictDoUpdate({
          target: [healthDeviceConnections.careRecipientId, healthDeviceConnections.provider],
          set: {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken || undefined,
            tokenExpiry: tokens.expiresIn ? new Date(Date.now() + tokens.expiresIn * 1000) : undefined,
            providerUserId: tokens.providerUserId || undefined,
            syncEnabled: true,
            updatedAt: new Date()
          }
        });
      
      // Redirect to success page
      res.redirect('/#/health-connection-success');
    } catch (error) {
      console.error('Error exchanging Fitbit OAuth code:', error);
      // Redirect to error page
      res.redirect(`/#/health-connection-error?message=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
    }
  });
  
  // List connected health platforms for a care recipient
  app.get(`${apiPrefix}/health-platforms/connections`, async (req, res) => {
    try {
      const careRecipientId = parseInt(req.query.careRecipientId as string);
      
      if (isNaN(careRecipientId)) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const connections = await db
        .select({
          id: healthDeviceConnections.id,
          provider: healthDeviceConnections.provider,
          syncEnabled: healthDeviceConnections.syncEnabled,
          lastSynced: healthDeviceConnections.lastSynced,
          createdAt: healthDeviceConnections.createdAt
        })
        .from(healthDeviceConnections)
        .where(eq(healthDeviceConnections.careRecipientId, careRecipientId));
      
      res.json(connections);
    } catch (error) {
      console.error('Error fetching health platform connections:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error fetching health platform connections' 
      });
    }
  });
  
  // Enable/disable syncing for a health platform connection
  app.patch(`${apiPrefix}/health-platforms/connections/:id`, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      
      if (isNaN(connectionId)) {
        return res.status(400).json({ message: 'Connection ID is required' });
      }
      
      const { syncEnabled } = req.body;
      
      if (typeof syncEnabled !== 'boolean') {
        return res.status(400).json({ message: 'syncEnabled must be a boolean' });
      }
      
      const updatedConnection = await db
        .update(healthDeviceConnections)
        .set({ 
          syncEnabled, 
          updatedAt: new Date() 
        })
        .where(eq(healthDeviceConnections.id, connectionId))
        .returning();
      
      if (updatedConnection.length === 0) {
        return res.status(404).json({ message: 'Connection not found' });
      }
      
      res.json(updatedConnection[0]);
    } catch (error) {
      console.error('Error updating health platform connection:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error updating health platform connection' 
      });
    }
  });
  
  // Delete a health platform connection
  app.delete(`${apiPrefix}/health-platforms/connections/:id`, async (req, res) => {
    try {
      const connectionId = parseInt(req.params.id);
      
      if (isNaN(connectionId)) {
        return res.status(400).json({ message: 'Connection ID is required' });
      }
      
      const deletedCount = await db
        .delete(healthDeviceConnections)
        .where(eq(healthDeviceConnections.id, connectionId))
        .returning({ id: healthDeviceConnections.id });
      
      if (deletedCount.length === 0) {
        return res.status(404).json({ message: 'Connection not found' });
      }
      
      res.json({ message: 'Connection deleted successfully' });
    } catch (error) {
      console.error('Error deleting health platform connection:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error deleting health platform connection' 
      });
    }
  });
  
  // Manually trigger sync for health data
  app.post(`${apiPrefix}/health-platforms/sync`, async (req, res) => {
    try {
      const { careRecipientId, provider, dataType } = req.body;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      if (provider && !['google', 'apple', 'fitbit', 'samsung', 'garmin'].includes(provider)) {
        return res.status(400).json({ message: 'Invalid health provider' });
      }
      
      if (dataType && !['sleep', 'bloodPressure', 'glucose', 'heartRate', 'activity'].includes(dataType)) {
        return res.status(400).json({ message: 'Invalid data type' });
      }
      
      let syncResult: any;
      
      // If specific data type is provided, sync only that data type
      if (dataType === 'sleep') {
        syncResult = await healthDataService.syncAllSleepData();
      } else if (dataType === 'bloodPressure') {
        syncResult = await healthDataService.syncAllBloodPressureData();
      } else {
        // Sync all data types
        syncResult = await healthDataService.syncAllHealthData();
      }
      
      res.json({
        message: 'Health data sync triggered successfully',
        result: syncResult
      });
    } catch (error) {
      console.error('Error syncing health data:', error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : 'Error syncing health data' 
      });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to health data WebSocket server',
      timestamp: new Date().toISOString()
    }));
    
    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        // Handle subscription requests
        if (data.type === 'subscribe' && data.careRecipientId) {
          // Store the care recipient ID in the WebSocket connection
          (ws as any).careRecipientId = data.careRecipientId;
          
          // Send confirmation
          ws.send(JSON.stringify({
            type: 'subscribed',
            careRecipientId: data.careRecipientId,
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Error processing message',
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Function to broadcast health data updates to connected clients
  const broadcastHealthUpdate = (careRecipientId: number, dataType: string, data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && (client as any).careRecipientId === careRecipientId) {
        client.send(JSON.stringify({
          type: 'update',
          dataType,
          data,
          timestamp: new Date().toISOString()
        }));
      }
    });
  };
  
  return httpServer;
}
