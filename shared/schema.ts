import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date, time, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Care Recipients
export const careRecipients = pgTable("care_recipients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#4F46E5"), // Default to primary color
  status: text("status").notNull().default("active"),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Medications
export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  dosage: text("dosage").notNull(),
  instructions: text("instructions"),
  icon: text("icon").default("pills"),
  iconColor: text("icon_color").default("#4F46E5"),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  doctorId: integer("doctor_id").references(() => doctors.id),
  prescriptionNumber: text("prescription_number"),
  expirationDate: date("expiration_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Medication Schedules
export const medicationSchedules = pgTable("medication_schedules", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").references(() => medications.id).notNull(),
  time: time("time").notNull(),
  daysOfWeek: jsonb("days_of_week").notNull(), // Array of days (0-6, Sunday-Saturday)
  quantity: text("quantity").notNull(), // e.g., "1 tablet", "2 pills"
  withFood: boolean("with_food").default(false),
  active: boolean("active").default(true),
  reminderEnabled: boolean("reminder_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Medication Logs
export const medicationLogs = pgTable("medication_logs", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").references(() => medications.id).notNull(),
  scheduleId: integer("schedule_id").references(() => medicationSchedules.id),
  taken: boolean("taken").notNull().default(true),
  takenAt: timestamp("taken_at").notNull().defaultNow(),
  notes: text("notes"),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Appointments
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  date: date("date").notNull(),
  time: time("time").notNull(),
  location: text("location"),
  notes: text("notes"),
  reminderEnabled: boolean("reminder_enabled").default(true),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Meals
export const meals = pgTable("meals", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // breakfast, lunch, dinner, snack
  food: text("food").notNull(),
  notes: text("notes"),
  consumedAt: timestamp("consumed_at").notNull().defaultNow(),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Bowel Movements
export const bowelMovements = pgTable("bowel_movements", {
  id: serial("id").primaryKey(),
  type: text("type"), // e.g. solid, liquid, etc.
  notes: text("notes"),
  occuredAt: timestamp("occured_at").notNull().defaultNow(),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Supplies
export const supplies = pgTable("supplies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull().default(0),
  threshold: integer("threshold"), // Min threshold for low supply alert
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Supply Usage
export const supplyUsages = pgTable("supply_usages", {
  id: serial("id").primaryKey(),
  supplyId: integer("supply_id").references(() => supplies.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  usedAt: timestamp("used_at").notNull().defaultNow(),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Sleep
export const sleep = pgTable("sleep", {
  id: serial("id").primaryKey(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  quality: text("quality"), // good, fair, poor
  interruptions: integer("interruptions").default(0),
  notes: text("notes"),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Notes
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Inspiration Messages
export const inspirationMessages = pgTable("inspiration_messages", {
  id: serial("id").primaryKey(),
  message: text("message").notNull(),
  author: text("author"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Doctors
export const doctors = pgTable("doctors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialty: text("specialty").notNull(),
  phoneNumber: text("phone_number").notNull(),
  address: text("address"),
  email: text("email"),
  notes: text("notes"),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Emergency Info (contains sensitive information)
export const emergencyInfo = pgTable("emergency_info", {
  id: serial("id").primaryKey(),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  dateOfBirth: date("date_of_birth"),
  socialSecurityNumber: text("social_security_number"),
  insuranceProvider: text("insurance_provider"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceGroupNumber: text("insurance_group_number"),
  insurancePhone: text("insurance_phone"),
  emergencyContact1Name: text("emergency_contact1_name"),
  emergencyContact1Phone: text("emergency_contact1_phone"),
  emergencyContact1Relation: text("emergency_contact1_relation"),
  emergencyContact2Name: text("emergency_contact2_name"),
  emergencyContact2Phone: text("emergency_contact2_phone"),
  emergencyContact2Relation: text("emergency_contact2_relation"),
  allergies: text("allergies"), // General allergies (food, environmental, etc.)
  medicationAllergies: text("medication_allergies"), // Specific medication allergies
  additionalInfo: text("additional_info"),
  bloodType: text("blood_type"),
  advanceDirectives: boolean("advance_directives").default(false),
  dnrOrder: boolean("dnr_order").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Pharmacies
export const pharmacies = pgTable("pharmacies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  phoneNumber: text("phone_number").notNull(),
  notes: text("notes"),
  careRecipientId: integer("care_recipient_id").references(() => careRecipients.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Medication Pharmacy Relation - which medications are filled at which pharmacies
export const medicationPharmacies = pgTable("medication_pharmacies", {
  id: serial("id").primaryKey(),
  medicationId: integer("medication_id").references(() => medications.id).notNull(),
  pharmacyId: integer("pharmacy_id").references(() => pharmacies.id).notNull(),
  refillInfo: text("refill_info"),
  lastRefillDate: date("last_refill_date"),
  nextRefillDate: date("next_refill_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Users table (keeping existing structure)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: varchar("email", { length: 255 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Define relations
export const usersRelations = relations(users, ({ many }) => ({
  careRecipients: many(careRecipients)
}));

export const careRecipientsRelations = relations(careRecipients, ({ one, many }) => ({
  user: one(users, {
    fields: [careRecipients.userId],
    references: [users.id]
  }),
  medications: many(medications),
  appointments: many(appointments),
  meals: many(meals),
  bowelMovements: many(bowelMovements),
  supplies: many(supplies),
  sleepRecords: many(sleep),
  notes: many(notes),
  doctors: many(doctors),
  pharmacies: many(pharmacies),
  emergencyInfo: many(emergencyInfo)
}));

export const medicationsRelations = relations(medications, ({ one, many }) => ({
  careRecipient: one(careRecipients, {
    fields: [medications.careRecipientId],
    references: [careRecipients.id]
  }),
  prescribingDoctor: one(doctors, {
    fields: [medications.doctorId],
    references: [doctors.id]
  }),
  schedules: many(medicationSchedules),
  logs: many(medicationLogs),
  pharmacyRelations: many(medicationPharmacies)
}));

export const doctorsRelations = relations(doctors, ({ one, many }) => ({
  careRecipient: one(careRecipients, {
    fields: [doctors.careRecipientId],
    references: [careRecipients.id]
  }),
  prescriptions: many(medications)
}));

export const pharmaciesRelations = relations(pharmacies, ({ one, many }) => ({
  careRecipient: one(careRecipients, {
    fields: [pharmacies.careRecipientId],
    references: [careRecipients.id]
  }),
  medicationRelations: many(medicationPharmacies)
}));

export const medicationPharmaciesRelations = relations(medicationPharmacies, ({ one }) => ({
  medication: one(medications, {
    fields: [medicationPharmacies.medicationId],
    references: [medications.id]
  }),
  pharmacy: one(pharmacies, {
    fields: [medicationPharmacies.pharmacyId],
    references: [pharmacies.id]
  })
}));

export const medicationSchedulesRelations = relations(medicationSchedules, ({ one, many }) => ({
  medication: one(medications, {
    fields: [medicationSchedules.medicationId],
    references: [medications.id]
  }),
  logs: many(medicationLogs)
}));

export const emergencyInfoRelations = relations(emergencyInfo, ({ one }) => ({
  careRecipient: one(careRecipients, {
    fields: [emergencyInfo.careRecipientId],
    references: [careRecipients.id]
  })
}));

// Create insert/select schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  fullName: true,
  email: true
});

export const insertCareRecipientSchema = createInsertSchema(careRecipients).pick({
  name: true,
  color: true,
  status: true,
  userId: true
});

export const insertMedicationSchema = createInsertSchema(medications);

export const insertMedicationScheduleSchema = createInsertSchema(medicationSchedules);

export const insertMedicationLogSchema = createInsertSchema(medicationLogs);

export const insertAppointmentSchema = createInsertSchema(appointments);

export const insertMealSchema = createInsertSchema(meals);

export const insertBowelMovementSchema = createInsertSchema(bowelMovements);

export const insertSupplySchema = createInsertSchema(supplies);

export const insertSupplyUsageSchema = createInsertSchema(supplyUsages);

export const insertSleepSchema = createInsertSchema(sleep);

export const insertNoteSchema = createInsertSchema(notes);

export const insertInspirationMessageSchema = createInsertSchema(inspirationMessages);

export const insertDoctorSchema = createInsertSchema(doctors);

export const insertPharmacySchema = createInsertSchema(pharmacies);

export const insertMedicationPharmacySchema = createInsertSchema(medicationPharmacies);

export const insertEmergencyInfoSchema = createInsertSchema(emergencyInfo);

// Define types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type EmergencyInfo = typeof emergencyInfo.$inferSelect;
export type InsertEmergencyInfo = z.infer<typeof insertEmergencyInfoSchema>;

export type CareRecipient = typeof careRecipients.$inferSelect;
export type InsertCareRecipient = z.infer<typeof insertCareRecipientSchema>;

export type Medication = typeof medications.$inferSelect;
export type InsertMedication = z.infer<typeof insertMedicationSchema>;

export type MedicationSchedule = typeof medicationSchedules.$inferSelect;
export type InsertMedicationSchedule = z.infer<typeof insertMedicationScheduleSchema>;

export type MedicationLog = typeof medicationLogs.$inferSelect;
export type InsertMedicationLog = z.infer<typeof insertMedicationLogSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type Meal = typeof meals.$inferSelect;
export type InsertMeal = z.infer<typeof insertMealSchema>;

export type BowelMovement = typeof bowelMovements.$inferSelect;
export type InsertBowelMovement = z.infer<typeof insertBowelMovementSchema>;

export type Supply = typeof supplies.$inferSelect;
export type InsertSupply = z.infer<typeof insertSupplySchema>;

export type SupplyUsage = typeof supplyUsages.$inferSelect;
export type InsertSupplyUsage = z.infer<typeof insertSupplyUsageSchema>;

export type Sleep = typeof sleep.$inferSelect;
export type InsertSleep = z.infer<typeof insertSleepSchema>;

export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;

export type InspirationMessage = typeof inspirationMessages.$inferSelect;
export type InsertInspirationMessage = z.infer<typeof insertInspirationMessageSchema>;

export type Doctor = typeof doctors.$inferSelect;
export type InsertDoctor = z.infer<typeof insertDoctorSchema>;

export type Pharmacy = typeof pharmacies.$inferSelect;
export type InsertPharmacy = z.infer<typeof insertPharmacySchema>;

export type MedicationPharmacy = typeof medicationPharmacies.$inferSelect;
export type InsertMedicationPharmacy = z.infer<typeof insertMedicationPharmacySchema>;
