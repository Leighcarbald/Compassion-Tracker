import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage, scheduleMidnightReset } from "./storage";
import { setupAuth } from "./auth";
import { setupWebAuthn } from "./webauthn";
import * as medicationService from "./services/medicationService";
import { WebSocketServer } from "ws";
import { db } from "../db";
import { eq, and } from "drizzle-orm";

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
  
  // Delete medication
  app.delete(`${apiPrefix}/medications/:id`, async (req, res) => {
    try {
      const medicationId = parseInt(req.params.id);
      
      if (isNaN(medicationId)) {
        return res.status(400).json({ message: 'Invalid medication ID format' });
      }
      
      await storage.deleteMedication(medicationId);
      res.status(200).json({ message: 'Medication deleted successfully' });
    } catch (error) {
      console.error('Error deleting medication:', error);
      res.status(500).json({ message: 'Error deleting medication' });
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
        return res.status(400).json({ message: 'Name parameter must be at least 2 characters' });
      }
      
      const suggestions = await medicationService.getMedicationNameSuggestions(partialName);
      res.json(suggestions);
    } catch (error) {
      console.error('Error fetching medication suggestions:', error);
      res.status(500).json({ message: 'Error fetching medication suggestions' });
    }
  });
  
  // Drug Database - Check medication interactions
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
      
      console.log('Found interactions:', knownInteractions);
      
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
          interactions: [] 
        });
      }
    } catch (error) {
      console.error('Error checking drug interactions:', error);
      res.status(500).json({ message: 'Error checking drug interactions' });
    }
  });
  
  // Drug Database - Get normalized medication name
  app.get(`${apiPrefix}/medications/normalize-name`, async (req, res) => {
    try {
      const medicationName = req.query.name as string;
      
      if (!medicationName) {
        return res.status(400).json({ message: 'Name parameter is required' });
      }
      
      // Use the available functions to approximate medication name normalization
      const suggestions = await medicationService.getMedicationNameSuggestions(medicationName);
      const normalizedName = suggestions.length > 0 ? suggestions[0] : medicationName;
      res.json({ original: medicationName, normalized: normalizedName });
    } catch (error) {
      console.error('Error normalizing medication name:', error);
      res.status(500).json({ message: 'Error normalizing medication name' });
    }
  });
  
  // Drug Database - Check medication interactions
  app.post(`${apiPrefix}/medications/check-interactions`, async (req, res) => {
    try {
      const { medications } = req.body;
      
      if (!medications || !Array.isArray(medications) || medications.length < 2) {
        return res.status(400).json({ message: 'At least two medication names are required' });
      }
      
      const interactions = await medicationService.checkDrugInteractionsByNames(medications);
      res.json(interactions);
    } catch (error) {
      console.error('Error checking medication interactions:', error);
      res.status(500).json({ message: 'Error checking medication interactions' });
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
      const newLog = await storage.createMedicationLog(req.body);
      res.status(201).json(newLog);
    } catch (error) {
      console.error('Error creating medication log:', error);
      res.status(500).json({ message: 'Error creating medication log' });
    }
  });
  
  // Delete medication log
  app.delete(`${apiPrefix}/medication-logs/:id`, async (req, res) => {
    try {
      const logId = parseInt(req.params.id);
      if (isNaN(logId)) {
        return res.status(400).json({ message: 'Invalid log ID format' });
      }
      
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
  
  app.delete(`${apiPrefix}/appointments/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      await storage.deleteAppointment(id);
      res.status(200).json({ message: 'Appointment deleted successfully' });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      res.status(500).json({ message: 'Error deleting appointment' });
    }
  });
  
  // Get appointments for a month
  app.get(`${apiPrefix}/appointments/month/:yearMonth`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      const yearMonth = req.params.yearMonth;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      if (!yearMonth || !yearMonth.match(/^\d{4}-\d{2}$/)) {
        return res.status(400).json({ message: 'Year-month must be in YYYY-MM format' });
      }
      
      const appointments = await storage.getMonthAppointments(parseInt(careRecipientId), yearMonth);
      res.json(appointments);
    } catch (error) {
      console.error('Error fetching month appointments:', error);
      res.status(500).json({ message: 'Error fetching month appointments' });
    }
  });
  
  // Meals
  app.get(`${apiPrefix}/meals`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      let dateRange = null;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      // If date range is provided, parse it
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      
      if (startDate && endDate) {
        dateRange = {
          start: new Date(startDate),
          end: new Date(endDate)
        };
      }
      
      const meals = await storage.getMeals(parseInt(careRecipientId), dateRange);
      res.json(meals);
    } catch (error) {
      console.error('Error fetching meals:', error);
      res.status(500).json({ message: 'Error fetching meals' });
    }
  });
  
  app.post(`${apiPrefix}/meals`, async (req, res) => {
    try {
      const newMeal = await storage.createMeal(req.body);
      res.status(201).json(newMeal);
    } catch (error) {
      console.error('Error creating meal:', error);
      res.status(500).json({ message: 'Error creating meal' });
    }
  });
  
  app.patch(`${apiPrefix}/meals/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const updatedMeal = await storage.updateMeal(id, req.body);
      res.json(updatedMeal);
    } catch (error) {
      console.error('Error updating meal:', error);
      res.status(500).json({ message: 'Error updating meal' });
    }
  });
  
  app.delete(`${apiPrefix}/meals/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      await storage.deleteMeal(id);
      res.status(200).json({ message: 'Meal deleted successfully' });
    } catch (error) {
      console.error('Error deleting meal:', error);
      res.status(500).json({ message: 'Error deleting meal' });
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
      const newMovement = await storage.createBowelMovement(req.body);
      res.status(201).json(newMovement);
    } catch (error) {
      console.error('Error creating bowel movement:', error);
      res.status(500).json({ message: 'Error creating bowel movement' });
    }
  });
  
  app.patch(`${apiPrefix}/bowel-movements/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const updatedMovement = await storage.updateBowelMovement(id, req.body);
      res.json(updatedMovement);
    } catch (error) {
      console.error('Error updating bowel movement:', error);
      res.status(500).json({ message: 'Error updating bowel movement' });
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
  
  app.post(`${apiPrefix}/supply-usages`, async (req, res) => {
    try {
      const newUsage = await storage.createSupplyUsage(req.body);
      res.status(201).json(newUsage);
    } catch (error) {
      console.error('Error creating supply usage:', error);
      res.status(500).json({ message: 'Error creating supply usage' });
    }
  });
  
  // Sleep
  app.get(`${apiPrefix}/sleep`, async (req, res) => {
    try {
      const careRecipientId = req.query.careRecipientId as string;
      
      if (!careRecipientId) {
        return res.status(400).json({ message: 'Care recipient ID is required' });
      }
      
      const records = await storage.getSleepRecords(parseInt(careRecipientId));
      res.json(records);
    } catch (error) {
      console.error('Error fetching sleep records:', error);
      res.status(500).json({ message: 'Error fetching sleep records' });
    }
  });
  
  app.post(`${apiPrefix}/sleep`, async (req, res) => {
    try {
      const newRecord = await storage.createSleepRecord(req.body);
      res.status(201).json(newRecord);
    } catch (error) {
      console.error('Error creating sleep record:', error);
      res.status(500).json({ message: 'Error creating sleep record' });
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
  
  // Daily Inspiration
  app.get(`${apiPrefix}/inspiration`, async (req, res) => {
    try {
      const inspirationMessage = await storage.getDailyInspiration();
      res.json(inspirationMessage);
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
  
  app.patch(`${apiPrefix}/doctors/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const updatedDoctor = await storage.updateDoctor(id, req.body);
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
  
  // Medication Pharmacies
  app.get(`${apiPrefix}/medication-pharmacies`, async (req, res) => {
    try {
      const medicationId = req.query.medicationId as string;
      
      if (!medicationId) {
        return res.status(400).json({ message: 'Medication ID is required' });
      }
      
      const pharmacies = await storage.getMedicationPharmacies(parseInt(medicationId));
      res.json(pharmacies);
    } catch (error) {
      console.error('Error fetching medication pharmacies:', error);
      res.status(500).json({ message: 'Error fetching medication pharmacies' });
    }
  });
  
  app.post(`${apiPrefix}/medication-pharmacies`, async (req, res) => {
    try {
      const newRelation = await storage.createMedicationPharmacy(req.body);
      res.status(201).json(newRelation);
    } catch (error) {
      console.error('Error associating medication with pharmacy:', error);
      res.status(500).json({ message: 'Error associating medication with pharmacy' });
    }
  });
  
  // Emergency Info
  app.get(`${apiPrefix}/emergency-info`, async (req, res) => {
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
  
  app.get(`${apiPrefix}/emergency-info/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const emergencyInfo = await storage.getEmergencyInfoById(id);
      
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
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      const updatedInfo = await storage.updateEmergencyInfo(id, req.body);
      res.json(updatedInfo);
    } catch (error) {
      console.error('Error updating emergency info:', error);
      res.status(500).json({ message: 'Error updating emergency info' });
    }
  });
  
  app.post(`${apiPrefix}/emergency-info/:id/verify-pin`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { pin } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      if (!pin) {
        return res.status(400).json({ message: 'PIN is required' });
      }
      
      const isValid = await storage.verifyEmergencyInfoPin(id, pin);
      
      if (isValid) {
        // If the PIN is valid, add this emergency info to the verified list in the session
        // This allows future access without requiring the PIN again during the session
        if (!req.session.verifiedEmergencyInfos) {
          req.session.verifiedEmergencyInfos = [];
        }
        
        if (!req.session.verifiedEmergencyInfos.includes(id)) {
          req.session.verifiedEmergencyInfos.push(id);
        }
        
        return res.json({ verified: true });
      } else {
        return res.status(401).json({ 
          verified: false, 
          message: 'Invalid PIN' 
        });
      }
    } catch (error) {
      console.error('Error verifying emergency info PIN:', error);
      res.status(500).json({ 
        verified: false,
        message: 'Error verifying emergency info PIN' 
      });
    }
  });
  
  app.post(`${apiPrefix}/emergency-info/:id/set-pin`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { pin } = req.body;
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      if (!pin || pin.length < 4) {
        return res.status(400).json({ message: 'PIN must be at least 4 characters' });
      }
      
      await storage.setEmergencyInfoPin(id, pin);
      res.json({ success: true });
    } catch (error) {
      console.error('Error setting emergency info PIN:', error);
      res.status(500).json({ message: 'Error setting emergency info PIN' });
    }
  });
  
  // Blood Pressure
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
      // Validate required fields
      const { systolic, diastolic, careRecipientId } = req.body;
      
      if (!systolic || !diastolic || !careRecipientId) {
        return res.status(400).json({ message: 'Systolic, diastolic, and careRecipientId are required' });
      }
      
      const newReading = await storage.createBloodPressureReading(req.body);
      res.status(201).json(newReading);
    } catch (error) {
      console.error('Error creating blood pressure reading:', error);
      res.status(500).json({ message: 'Error creating blood pressure reading' });
    }
  });
  
  // Glucose
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
      console.error('Error fetching glucose reading by ID:', error);
      res.status(500).json({ message: 'Error fetching glucose reading by ID' });
    }
  });
  
  app.post(`${apiPrefix}/glucose`, async (req, res) => {
    try {
      const newReading = await storage.createGlucoseReading(req.body);
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
      res.status(500).json({ message: 'Error updating glucose reading' });
    }
  });
  
  app.delete(`${apiPrefix}/glucose/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      await storage.deleteGlucoseReading(id);
      res.status(200).json({ message: 'Glucose reading deleted successfully' });
    } catch (error) {
      console.error('Error deleting glucose reading:', error);
      res.status(500).json({ message: 'Error deleting glucose reading' });
    }
  });
  
  // Insulin
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
      console.error('Error fetching insulin record by ID:', error);
      res.status(500).json({ message: 'Error fetching insulin record by ID' });
    }
  });
  
  app.post(`${apiPrefix}/insulin`, async (req, res) => {
    try {
      const newRecord = await storage.createInsulinRecord(req.body);
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
      res.status(500).json({ message: 'Error updating insulin record' });
    }
  });
  
  app.delete(`${apiPrefix}/insulin/:id`, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: 'Invalid ID format' });
      }
      
      await storage.deleteInsulinRecord(id);
      res.status(200).json({ message: 'Insulin record deleted successfully' });
    } catch (error) {
      console.error('Error deleting insulin record:', error);
      res.status(500).json({ message: 'Error deleting insulin record' });
    }
  });

  // Create the HTTP server
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    
    // Send initial connection message
    ws.send(JSON.stringify({
      type: 'connection',
      message: 'Connected to WebSocket server',
      timestamp: new Date().toISOString()
    }));
    
    // Handle incoming messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received WebSocket message:', data);
        
        // Handle subscription requests
        if (data.type === 'subscribe' && data.careRecipientId) {
          // Store the care recipient ID with this connection
          // This allows us to send targeted updates to this connection
          (ws as any).careRecipientId = data.careRecipientId;
          
          ws.send(JSON.stringify({
            type: 'subscribed',
            careRecipientId: data.careRecipientId,
            timestamp: new Date().toISOString()
          }));
        }
      } catch (error) {
        console.error('Error handling WebSocket message:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString()
        }));
      }
    });
    
    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Broadcast updates to all connected clients
  const broadcastUpdate = (type: string, data: any) => {
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // If this is a targeted update, only send to clients subscribed to this care recipient
        if (data.careRecipientId && (client as any).careRecipientId !== data.careRecipientId) {
          return;
        }
        
        client.send(JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString()
        }));
      }
    });
  };
  
  return httpServer;
}