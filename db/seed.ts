import { db } from "./index";
import * as schema from "@shared/schema";

async function seed() {
  try {
    // Create a test user
    console.log("Creating test user...");
    const existingUser = await db.query.users.findFirst({
      where: { username: "testuser" }
    });
    
    let userId;
    if (!existingUser) {
      const [user] = await db.insert(schema.users).values({
        username: "testuser",
        password: "password123", // In a real app, this would be hashed
        fullName: "Test User",
        email: "test@example.com"
      }).returning();
      userId = user.id;
      console.log(`Created user with ID: ${userId}`);
    } else {
      userId = existingUser.id;
      console.log(`Using existing user with ID: ${userId}`);
    }
    
    // Create care recipients
    console.log("Creating care recipients...");
    const careRecipientData = [
      { name: "Mom", color: "#4F46E5", status: "active", userId },
      { name: "Dad", color: "#10B981", status: "active", userId },
      { name: "Aunt Jane", color: "#F97316", status: "active", userId }
    ];
    
    const careRecipientIds = [];
    for (const data of careRecipientData) {
      const existingRecipient = await db.query.careRecipients.findFirst({
        where: { name: data.name, userId: userId }
      });
      
      if (!existingRecipient) {
        const [recipient] = await db.insert(schema.careRecipients).values(data).returning();
        careRecipientIds.push(recipient.id);
        console.log(`Created care recipient: ${recipient.name} with ID: ${recipient.id}`);
      } else {
        careRecipientIds.push(existingRecipient.id);
        console.log(`Using existing care recipient: ${existingRecipient.name} with ID: ${existingRecipient.id}`);
      }
    }
    
    // Create medications for the first care recipient
    console.log("Creating medications...");
    const medicationData = [
      { 
        name: "Lisinopril", 
        dosage: "10mg", 
        instructions: "Take with food", 
        icon: "pills", 
        iconColor: "red", 
        careRecipientId: careRecipientIds[0] 
      },
      { 
        name: "Metformin", 
        dosage: "500mg", 
        instructions: "Take with breakfast", 
        icon: "capsules", 
        iconColor: "blue", 
        careRecipientId: careRecipientIds[0]
      },
      { 
        name: "Aspirin", 
        dosage: "81mg", 
        instructions: "Take with lunch", 
        icon: "tablets", 
        iconColor: "purple", 
        careRecipientId: careRecipientIds[0] 
      },
      { 
        name: "Atorvastatin", 
        dosage: "20mg", 
        instructions: "Take in the evening", 
        icon: "pills", 
        iconColor: "green", 
        careRecipientId: careRecipientIds[0] 
      }
    ];
    
    for (const data of medicationData) {
      const existingMedication = await db.query.medications.findFirst({
        where: { 
          name: data.name,
          careRecipientId: data.careRecipientId
        }
      });
      
      if (!existingMedication) {
        const [medication] = await db.insert(schema.medications).values(data).returning();
        console.log(`Created medication: ${medication.name} with ID: ${medication.id}`);
        
        // Create medication schedule
        const scheduleData = {
          medicationId: medication.id,
          time: data.name === "Atorvastatin" ? "20:00:00" : "08:00:00",
          daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
          quantity: data.name === "Metformin" ? "2 tablets" : "1 tablet",
          withFood: data.instructions.toLowerCase().includes("food"),
          active: true,
          reminderEnabled: true
        };
        
        const [schedule] = await db.insert(schema.medicationSchedules).values(scheduleData).returning();
        console.log(`Created medication schedule for: ${medication.name}`);
      } else {
        console.log(`Using existing medication: ${existingMedication.name} with ID: ${existingMedication.id}`);
      }
    }
    
    // Create appointments
    console.log("Creating appointments...");
    const today = new Date();
    const appointmentData = [
      {
        title: "Dr. Johnson Appointment",
        date: today.toISOString().split('T')[0],
        time: "15:30:00",
        location: "123 Medical Plaza",
        notes: "Annual checkup",
        careRecipientId: careRecipientIds[0],
        reminderEnabled: true
      },
      {
        title: "Physical Therapy",
        date: new Date(today.setDate(today.getDate() + 2)).toISOString().split('T')[0],
        time: "10:00:00",
        location: "456 Health Center",
        notes: "Bring comfortable clothes",
        careRecipientId: careRecipientIds[0],
        reminderEnabled: true
      }
    ];
    
    for (const data of appointmentData) {
      const existingAppointment = await db.query.appointments.findFirst({
        where: { 
          title: data.title,
          date: data.date as any,
          careRecipientId: data.careRecipientId
        }
      });
      
      if (!existingAppointment) {
        const [appointment] = await db.insert(schema.appointments).values(data).returning();
        console.log(`Created appointment: ${appointment.title} with ID: ${appointment.id}`);
      } else {
        console.log(`Using existing appointment: ${existingAppointment.title} with ID: ${existingAppointment.id}`);
      }
    }
    
    // Create supplies
    console.log("Creating supplies...");
    const suppliesData = [
      {
        name: "Depends",
        quantity: 23,
        threshold: 5,
        careRecipientId: careRecipientIds[0]
      },
      {
        name: "Gloves",
        quantity: 50,
        threshold: 10,
        careRecipientId: careRecipientIds[0]
      }
    ];
    
    for (const data of suppliesData) {
      const existingSupply = await db.query.supplies.findFirst({
        where: { 
          name: data.name,
          careRecipientId: data.careRecipientId
        }
      });
      
      if (!existingSupply) {
        const [supply] = await db.insert(schema.supplies).values(data).returning();
        console.log(`Created supply: ${supply.name} with ID: ${supply.id}`);
      } else {
        console.log(`Using existing supply: ${existingSupply.name} with ID: ${existingSupply.id}`);
      }
    }
    
    // Create notes
    console.log("Creating notes...");
    const notesData = [
      {
        title: "Medication Reaction",
        content: "Seemed a bit dizzy after morning medication. Will monitor throughout the day.",
        careRecipientId: careRecipientIds[0]
      },
      {
        title: "Appetite Improved",
        content: "Ate almost all dinner. Seems to enjoy the new food options we tried.",
        careRecipientId: careRecipientIds[0]
      }
    ];
    
    for (const data of notesData) {
      const existingNote = await db.query.notes.findFirst({
        where: { 
          title: data.title,
          careRecipientId: data.careRecipientId
        }
      });
      
      if (!existingNote) {
        const [note] = await db.insert(schema.notes).values(data).returning();
        console.log(`Created note: ${note.title} with ID: ${note.id}`);
      } else {
        console.log(`Using existing note: ${existingNote.title} with ID: ${existingNote.id}`);
      }
    }
    
    // Create inspiration messages
    console.log("Creating inspiration messages...");
    const inspirationData = [
      {
        message: "Caregiving often calls us to lean into love we didn't know possible.",
        author: "Tia Walker",
        active: true
      },
      {
        message: "To care for those who once cared for us is one of the highest honors.",
        author: "Tia Walker",
        active: true
      },
      {
        message: "There are only four kinds of people in the world: those who have been caregivers, those who are currently caregivers, those who will be caregivers, and those who will need caregivers.",
        author: "Rosalynn Carter",
        active: true
      },
      {
        message: "Too often we underestimate the power of a touch, a smile, a kind word, a listening ear, an honest compliment, or the smallest act of caring, all of which have the potential to turn a life around.",
        author: "Leo Buscaglia",
        active: true
      }
    ];
    
    for (const data of inspirationData) {
      const existingMessage = await db.query.inspirationMessages.findFirst({
        where: { message: data.message }
      });
      
      if (!existingMessage) {
        const [message] = await db.insert(schema.inspirationMessages).values(data).returning();
        console.log(`Created inspiration message with ID: ${message.id}`);
      } else {
        console.log(`Using existing inspiration message with ID: ${existingMessage.id}`);
      }
    }
    
    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run the seed function
seed();
