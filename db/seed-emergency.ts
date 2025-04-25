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
    
    // Create emergency info for the first care recipient
    console.log("Creating emergency info...");
    const emergencyInfoData = {
      careRecipientId: careRecipients[0].id,
      dateOfBirth: "1952-06-15",
      socialSecurityNumber: "XXX-XX-1234",
      insuranceProvider: "Medicare Advantage",
      insurancePolicyNumber: "MA12345678",
      insuranceGroupNumber: "GRP987654",
      insurancePhone: "(800) 555-1234",
      emergencyContact1Name: "Jane Smith",
      emergencyContact1Phone: "(555) 765-4321",
      emergencyContact1Relation: "Daughter",
      emergencyContact2Name: "Michael Smith",
      emergencyContact2Phone: "(555) 654-3210",
      emergencyContact2Relation: "Son",
      allergies: "Penicillin, Shellfish, Latex",
      medicationAllergies: "Sulfa drugs, Codeine",
      bloodType: "O+",
      advanceDirectives: true,
      dnrOrder: false,
      additionalInfo: "Prefers to be addressed as Mom. Needs glasses for reading. Hearing aid in right ear."
    };
    
    const [info] = await db.insert(schema.emergencyInfo).values(emergencyInfoData).returning();
    console.log(`Created emergency info with ID: ${info.id} for care recipient ID: ${info.careRecipientId}`);
    
    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run the seed function
seed();