import { db } from "./index";
import * as schema from "@shared/schema";

async function seed() {
  try {
    // Create a test user
    console.log("Creating test user...");
    
    const [user] = await db.insert(schema.users).values({
      username: "testuser",
      password: "password123", // In a real app, this would be hashed
      fullName: "Test User",
      email: "test@example.com"
    }).returning();
    
    console.log(`Created user with ID: ${user.id}`);
    
    // Create care recipients
    console.log("Creating care recipients...");
    const careRecipientData = [
      { name: "Mom", color: "#4F46E5", status: "active", userId: user.id },
      { name: "Dad", color: "#10B981", status: "active", userId: user.id },
      { name: "Aunt Jane", color: "#F97316", status: "active", userId: user.id }
    ];
    
    for (const data of careRecipientData) {
      const [recipient] = await db.insert(schema.careRecipients).values(data).returning();
      console.log(`Created care recipient: ${recipient.name} with ID: ${recipient.id}`);
    }
    
    console.log("Seed completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

// Run the seed function
seed();