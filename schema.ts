import { pgTable, text, serial, integer, boolean, timestamp, date, time, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users (Gym Staff y Public Users)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("user"), // Cambiado de 'staff' a 'user' como valor predeterminado
  email: text("email").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  name: true,
  role: true,
  email: true,
  phone: true,
  avatarUrl: true,
});

// Membership Plans
export const membershipPlans = pgTable("membership_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  price: integer("price").notNull(), // stored in cents
  duration: integer("duration").notNull(), // in days
  durationType: text("duration_type").notNull(), // monthly, quarterly, annual
  features: text("features").array(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertMembershipPlanSchema = createInsertSchema(membershipPlans).pick({
  name: true,
  description: true,
  price: true,
  duration: true,
  durationType: true,
  features: true,
  isActive: true,
});

// Members
export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  address: text("address"),
  joinDate: date("join_date").notNull(),
  planId: integer("plan_id"),
  status: text("status").default("inactive"),
  avatarUrl: text("avatar_url"),
  emergencyContact: text("emergency_contact"),
  emergencyPhone: text("emergency_phone"),
  notes: text("notes"),
  expiryDate: date("expiry_date"),
});

export const insertMemberSchema = createInsertSchema(members).pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  address: true,
  joinDate: true,
  avatarUrl: true,
  emergencyContact: true,
  emergencyPhone: true,
  notes: true,
});

// Trainers
export const trainers = pgTable("trainers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  specialization: text("specialization").array(),
  bio: text("bio"),
  status: text("status").notNull().default("active"),
  avatarUrl: text("avatar_url"),
  hireDate: date("hire_date"),
});

export const insertTrainerSchema = createInsertSchema(trainers).pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  specialization: true,
  bio: true,
  status: true,
  avatarUrl: true,
  hireDate: true,
});

// Classes
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  trainerId: integer("trainer_id").notNull(),
  room: text("room").notNull(),
  capacity: integer("capacity").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  daysOfWeek: text("days_of_week").array().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertClassSchema = createInsertSchema(classes).pick({
  name: true,
  description: true,
  trainerId: true,
  room: true,
  capacity: true,
  startTime: true,
  endTime: true,
  daysOfWeek: true,
  isActive: true,
});

// Class Bookings
export const classBookings = pgTable("class_bookings", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull(),
  memberId: integer("member_id").notNull(),
  bookingDate: date("booking_date").notNull(),
  status: text("status").notNull().default("confirmed"),
  attendanceStatus: text("attendance_status"),
}, (table) => {
  return {
    unq: unique().on(table.classId, table.memberId, table.bookingDate)
  }
});

export const insertClassBookingSchema = createInsertSchema(classBookings).pick({
  classId: true,
  memberId: true,
  bookingDate: true,
  status: true,
  attendanceStatus: true,
});

// Equipment Inventory
export const equipment = pgTable("equipment", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  purchaseDate: date("purchase_date"),
  purchasePrice: integer("purchase_price"), // stored in cents
  condition: text("condition").notNull().default("good"),
  maintenanceDate: date("maintenance_date"),
  notes: text("notes"),
  quantity: integer("quantity").notNull().default(1),
  imageUrl: text("image_url"),
});

export const insertEquipmentSchema = createInsertSchema(equipment).pick({
  name: true,
  description: true,
  category: true,
  purchaseDate: true,
  purchasePrice: true,
  condition: true,
  maintenanceDate: true,
  notes: true,
  quantity: true,
  imageUrl: true,
});

// Announcements
export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  publishDate: timestamp("publish_date").notNull(),
  expiryDate: timestamp("expiry_date"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").notNull(),
});

export const insertAnnouncementSchema = createInsertSchema(announcements).pick({
  title: true,
  content: true,
  category: true,
  publishDate: true,
  expiryDate: true,
  isActive: true,
  createdBy: true,
});

// Activities Log
export const activities = pgTable("activities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  memberId: integer("member_id"),
  activityType: text("activity_type").notNull(),
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activities).pick({
  userId: true,
  memberId: true,
  activityType: true,
  description: true,
  timestamp: true,
});

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;

export type Member = typeof members.$inferSelect;
export type InsertMember = z.infer<typeof insertMemberSchema>;

export type Trainer = typeof trainers.$inferSelect;
export type InsertTrainer = z.infer<typeof insertTrainerSchema>;

export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;

export type ClassBooking = typeof classBookings.$inferSelect;
export type InsertClassBooking = z.infer<typeof insertClassBookingSchema>;

export type Equipment = typeof equipment.$inferSelect;
export type InsertEquipment = z.infer<typeof insertEquipmentSchema>;

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;

export type Activity = typeof activities.$inferSelect;
export type InsertActivity = z.infer<typeof insertActivitySchema>;

// Payments
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull().references(() => members.id),
  amount: integer("amount").notNull(), // stored in cents
  paymentDate: timestamp("payment_date").notNull().defaultNow(),
  paymentMethod: text("payment_method").notNull(), // yape, efectivo, tarjeta, etc.
  planId: integer("plan_id").notNull().references(() => membershipPlans.id),
  status: text("status").notNull().default("pending"), // pending, verified, rejected
  receiptUrl: text("receipt_url"), // URL a la imagen del comprobante de pago para Yape
  notes: text("notes"),
  verifiedById: integer("verified_by_id").references(() => users.id), // admin que verificó el pago
  verifiedAt: timestamp("verified_at"), // fecha de verificación
});

export const insertPaymentSchema = createInsertSchema(payments).pick({
  memberId: true,
  amount: true,
  paymentDate: true,
  paymentMethod: true,
  planId: true,
  status: true,
  receiptUrl: true,
  notes: true,
  verifiedById: true,
  verifiedAt: true,
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
