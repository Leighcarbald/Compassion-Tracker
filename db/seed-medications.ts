import { db } from "./index";
import * as schema from "@shared/schema";

async function seed() {
  try {
    // Get care recipients 
    const careRecipients = await db.query.careRecipients.findMany();
    
    if (careRecipients.length === 0) {
      console.log("No care recipients found. Please run seed-simple.ts first.");
      return;
    }

    console.log(`Found ${careRecipients.length} care recipients.`);
    
    // Create medications for each care recipient
    for (const recipient of careRecipients) {
      console.log(`Creating medications for ${recipient.name}...`);
      
      const medicationData = [
        {
          name: "Lisinopril",
          dosage: "10mg",
          instructions: "Take once daily in the morning with or without food",
          icon: "pills",
          iconColor: "#4F46E5",
          careRecipientId: recipient.id,
          currentQuantity: 30,
          reorderThreshold: 7,
          daysToReorder: 7,
          originalQuantity: 90,
          refillsRemaining: 3
        },
        {
          name: "Metformin",
          dosage: "500mg",
          instructions: "Take twice daily with meals",
          icon: "pills",
          iconColor: "#10B981",
          careRecipientId: recipient.id,
          currentQuantity: 45,
          reorderThreshold: 10,
          daysToReorder: 5,
          originalQuantity: 60,
          refillsRemaining: 2
        },
        {
          name: "Atorvastatin",
          dosage: "20mg",
          instructions: "Take once daily at bedtime",
          icon: "pills",
          iconColor: "#F97316",
          careRecipientId: recipient.id,
          currentQuantity: 12,
          reorderThreshold: 5,
          daysToReorder: 10,
          originalQuantity: 30,
          refillsRemaining: 1
        }
      ];
      
      for (const data of medicationData) {
        // Check if medication already exists
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
          console.log(`Created medication schedule for ${medication.name}`);
        } else {
          console.log(`Medication ${data.name} already exists for ${recipient.name}`);
        }
      }
    }
    
    console.log("Medication seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run the seed function
seed();