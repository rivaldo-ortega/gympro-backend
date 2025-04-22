import {
  User,
  InsertUser,
  MembershipPlan,
  InsertMembershipPlan,
  Member,
  InsertMember,
  Trainer,
  InsertTrainer,
  Class,
  InsertClass,
  ClassBooking,
  InsertClassBooking,
  Equipment,
  InsertEquipment,
  Announcement,
  InsertAnnouncement,
  Activity,
  InsertActivity,
  Payment,
  InsertPayment,
  // Import table references
  users,
  membershipPlans,
  members,
  trainers,
  classes,
  classBookings,
  equipment,
  announcements,
  activities,
  payments,
} from './schema'

import session from 'express-session'
import connectPg from 'connect-pg-simple'
import {pool, db} from './db'
import {eq, desc, and, gte, isNull, asc, or} from 'drizzle-orm'

const PostgresSessionStore = connectPg(session)

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>
  getUser(id: number): Promise<User | undefined>
  getUserByUsername(username: string): Promise<User | undefined>
  createUser(user: InsertUser): Promise<User>
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>
  deleteUser(id: number): Promise<boolean>

  // Membership Plans
  getMembershipPlans(): Promise<MembershipPlan[]>
  getMembershipPlan(id: number): Promise<MembershipPlan | undefined>
  createMembershipPlan(plan: InsertMembershipPlan): Promise<MembershipPlan>
  updateMembershipPlan(
    id: number,
    plan: Partial<MembershipPlan>,
  ): Promise<MembershipPlan | undefined>
  deleteMembershipPlan(id: number): Promise<boolean>

  // Members
  getMembers(): Promise<Member[]>
  getMember(id: number): Promise<Member | undefined>
  getMemberByEmail(email: string): Promise<Member | undefined>
  createMember(member: InsertMember): Promise<Member>
  updateMember(id: number, member: Partial<Member>): Promise<Member | undefined>
  deleteMember(id: number): Promise<boolean>

  // Trainers
  getTrainers(): Promise<Trainer[]>
  getTrainer(id: number): Promise<Trainer | undefined>
  getTrainerByEmail(email: string): Promise<Trainer | undefined>
  createTrainer(trainer: InsertTrainer): Promise<Trainer>
  updateTrainer(
    id: number,
    trainer: Partial<Trainer>,
  ): Promise<Trainer | undefined>
  deleteTrainer(id: number): Promise<boolean>

  // Classes
  getClasses(): Promise<Class[]>
  getClass(id: number): Promise<Class | undefined>
  createClass(gymClass: InsertClass): Promise<Class>
  updateClass(id: number, gymClass: Partial<Class>): Promise<Class | undefined>
  deleteClass(id: number): Promise<boolean>

  // Class Bookings
  getClassBookings(): Promise<ClassBooking[]>
  getClassBooking(id: number): Promise<ClassBooking | undefined>
  getClassBookingsByClass(classId: number): Promise<ClassBooking[]>
  getClassBookingsByMember(memberId: number): Promise<ClassBooking[]>
  createClassBooking(booking: InsertClassBooking): Promise<ClassBooking>
  updateClassBooking(
    id: number,
    booking: Partial<ClassBooking>,
  ): Promise<ClassBooking | undefined>
  deleteClassBooking(id: number): Promise<boolean>

  // Equipment
  getEquipment(): Promise<Equipment[]>
  getEquipmentItem(id: number): Promise<Equipment | undefined>
  createEquipment(item: InsertEquipment): Promise<Equipment>
  updateEquipment(
    id: number,
    item: Partial<Equipment>,
  ): Promise<Equipment | undefined>
  deleteEquipment(id: number): Promise<boolean>

  // Announcements
  getAnnouncements(): Promise<Announcement[]>
  getAnnouncement(id: number): Promise<Announcement | undefined>
  getActiveAnnouncements(): Promise<Announcement[]>
  createAnnouncement(announcement: InsertAnnouncement): Promise<Announcement>
  updateAnnouncement(
    id: number,
    announcement: Partial<Announcement>,
  ): Promise<Announcement | undefined>
  deleteAnnouncement(id: number): Promise<boolean>

  // Activities
  getActivities(): Promise<Activity[]>
  getRecentActivities(limit: number): Promise<Activity[]>
  getUserActivities(userId: number): Promise<Activity[]>
  getMemberActivities(memberId: number): Promise<Activity[]>
  createActivity(activity: InsertActivity): Promise<Activity>

  // Payments
  getPayments(): Promise<Payment[]>
  getPayment(id: number): Promise<Payment | undefined>
  getPaymentsByMember(memberId: number): Promise<Payment[]>
  getPendingPayments(): Promise<Payment[]>
  createPayment(payment: InsertPayment): Promise<Payment>
  updatePayment(
    id: number,
    payment: Partial<Payment>,
  ): Promise<Payment | undefined>
  verifyPayment(id: number, adminId: number): Promise<Payment | undefined>
  rejectPayment(
    id: number,
    adminId: number,
    notes?: string,
  ): Promise<Payment | undefined>

  // Session store for auth
  sessionStore: any
}

export class MemStorage implements IStorage {
  private users: Map<number, User>
  private membershipPlans: Map<number, MembershipPlan>
  private members: Map<number, Member>
  private trainers: Map<number, Trainer>
  private classes: Map<number, Class>
  private classBookings: Map<number, ClassBooking>
  private equipmentItems: Map<number, Equipment>
  private announcements: Map<number, Announcement>
  private activities: Map<number, Activity>
  private payments: Map<number, Payment>

  private userIdCounter: number
  private planIdCounter: number
  private memberIdCounter: number
  private trainerIdCounter: number
  private classIdCounter: number
  private bookingIdCounter: number
  private equipmentIdCounter: number
  private announcementIdCounter: number
  private activityIdCounter: number
  private paymentIdCounter: number

  // Add session store
  public sessionStore: any

  constructor() {
    this.users = new Map()
    this.membershipPlans = new Map()
    this.members = new Map()
    this.trainers = new Map()
    this.classes = new Map()
    this.classBookings = new Map()
    this.equipmentItems = new Map()
    this.announcements = new Map()
    this.activities = new Map()
    this.payments = new Map()

    this.userIdCounter = 1
    this.planIdCounter = 1
    this.memberIdCounter = 1
    this.trainerIdCounter = 1
    this.classIdCounter = 1
    this.bookingIdCounter = 1
    this.equipmentIdCounter = 1
    this.announcementIdCounter = 1
    this.activityIdCounter = 1
    this.paymentIdCounter = 1

    // Initialize session store
    const MemoryStore = require('memorystore')(session)
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    })

    // Seed initial data
    this.seedInitialData()
  }

  // Users
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values())
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id)
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      user => user.username === username,
    )
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++
    const user: User = {...insertUser, id}
    this.users.set(id, user)
    return user
  }

  async updateUser(
    id: number,
    userData: Partial<User>,
  ): Promise<User | undefined> {
    const user = this.users.get(id)
    if (!user) return undefined

    const updatedUser = {...user, ...userData}
    this.users.set(id, updatedUser)
    return updatedUser
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id)
  }

  // Membership Plans
  async getMembershipPlans(): Promise<MembershipPlan[]> {
    return Array.from(this.membershipPlans.values())
  }

  async getMembershipPlan(id: number): Promise<MembershipPlan | undefined> {
    return this.membershipPlans.get(id)
  }

  async createMembershipPlan(
    plan: InsertMembershipPlan,
  ): Promise<MembershipPlan> {
    const id = this.planIdCounter++
    const membershipPlan: MembershipPlan = {...plan, id}
    this.membershipPlans.set(id, membershipPlan)
    return membershipPlan
  }

  async updateMembershipPlan(
    id: number,
    planData: Partial<MembershipPlan>,
  ): Promise<MembershipPlan | undefined> {
    const plan = this.membershipPlans.get(id)
    if (!plan) return undefined

    const updatedPlan = {...plan, ...planData}
    this.membershipPlans.set(id, updatedPlan)
    return updatedPlan
  }

  async deleteMembershipPlan(id: number): Promise<boolean> {
    return this.membershipPlans.delete(id)
  }

  // Members
  async getMembers(): Promise<Member[]> {
    // Verificar membresías expiradas y actualizar estado automáticamente
    const today = new Date()
    const members = Array.from(this.members.values())

    // Iterar sobre todos los miembros para verificar fechas de expiración
    for (const member of members) {
      // Solo verificar miembros activos que tengan fecha de expiración
      if (member.status === 'active' && member.expiryDate) {
        const expiryDate = new Date(member.expiryDate)

        // Si la fecha de expiración ya pasó, actualizar estado a 'expired'
        if (expiryDate < today) {
          // Actualizar estado en la memoria
          member.status = 'expired'
          this.members.set(member.id, member)

          // Registrar actividad
          await this.createActivity({
            memberId: member.id,
            activityType: 'membership_expired',
            description: `Membership expired for: ${member.firstName} ${member.lastName}`,
            timestamp: new Date(),
            userId: null,
          })

          console.log(
            `Updated member status to expired: ${member.firstName} ${member.lastName}`,
          )
        }
      }
    }

    // Devolver la lista actualizada de miembros
    return Array.from(this.members.values())
  }

  async getMember(id: number): Promise<Member | undefined> {
    return this.members.get(id)
  }

  async getMemberByEmail(email: string): Promise<Member | undefined> {
    return Array.from(this.members.values()).find(
      member => member.email === email,
    )
  }

  async createMember(memberData: InsertMember): Promise<Member> {
    const id = this.memberIdCounter++
    const member: Member = {...memberData, id}
    this.members.set(id, member)

    // Log activity
    await this.createActivity({
      memberId: id,
      activityType: 'member_created',
      description: `New member added: ${member.firstName} ${member.lastName}`,
      timestamp: new Date(),
      userId: null,
    })

    return member
  }

  async updateMember(
    id: number,
    memberData: Partial<Member>,
  ): Promise<Member | undefined> {
    const member = this.members.get(id)
    if (!member) return undefined

    const updatedMember = {...member, ...memberData}
    this.members.set(id, updatedMember)

    // Log activity
    await this.createActivity({
      memberId: id,
      activityType: 'member_updated',
      description: `Member updated: ${updatedMember.firstName} ${updatedMember.lastName}`,
      timestamp: new Date(),
      userId: null,
    })

    return updatedMember
  }

  async deleteMember(id: number): Promise<boolean> {
    const member = this.members.get(id)
    if (member) {
      // Log activity before deletion
      await this.createActivity({
        memberId: null,
        activityType: 'member_deleted',
        description: `Member deleted: ${member.firstName} ${member.lastName}`,
        timestamp: new Date(),
        userId: null,
      })
    }

    return this.members.delete(id)
  }

  // Trainers
  async getTrainers(): Promise<Trainer[]> {
    return Array.from(this.trainers.values())
  }

  async getTrainer(id: number): Promise<Trainer | undefined> {
    return this.trainers.get(id)
  }

  async getTrainerByEmail(email: string): Promise<Trainer | undefined> {
    return Array.from(this.trainers.values()).find(
      trainer => trainer.email === email,
    )
  }

  async createTrainer(trainerData: InsertTrainer): Promise<Trainer> {
    const id = this.trainerIdCounter++
    const trainer: Trainer = {...trainerData, id}
    this.trainers.set(id, trainer)

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'trainer_created',
      description: `New trainer added: ${trainer.firstName} ${trainer.lastName}`,
      timestamp: new Date(),
      userId: null,
    })

    return trainer
  }

  async updateTrainer(
    id: number,
    trainerData: Partial<Trainer>,
  ): Promise<Trainer | undefined> {
    const trainer = this.trainers.get(id)
    if (!trainer) return undefined

    const updatedTrainer = {...trainer, ...trainerData}
    this.trainers.set(id, updatedTrainer)
    return updatedTrainer
  }

  async deleteTrainer(id: number): Promise<boolean> {
    return this.trainers.delete(id)
  }

  // Classes
  async getClasses(): Promise<Class[]> {
    return Array.from(this.classes.values())
  }

  async getClass(id: number): Promise<Class | undefined> {
    return this.classes.get(id)
  }

  async createClass(classData: InsertClass): Promise<Class> {
    const id = this.classIdCounter++
    const gymClass: Class = {...classData, id}
    this.classes.set(id, gymClass)

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'class_created',
      description: `New class added: ${gymClass.name}`,
      timestamp: new Date(),
      userId: null,
    })

    return gymClass
  }

  async updateClass(
    id: number,
    classData: Partial<Class>,
  ): Promise<Class | undefined> {
    const gymClass = this.classes.get(id)
    if (!gymClass) return undefined

    const updatedClass = {...gymClass, ...classData}
    this.classes.set(id, updatedClass)
    return updatedClass
  }

  async deleteClass(id: number): Promise<boolean> {
    return this.classes.delete(id)
  }

  // Class Bookings
  async getClassBookings(): Promise<ClassBooking[]> {
    return Array.from(this.classBookings.values())
  }

  async getClassBooking(id: number): Promise<ClassBooking | undefined> {
    return this.classBookings.get(id)
  }

  async getClassBookingsByClass(classId: number): Promise<ClassBooking[]> {
    return Array.from(this.classBookings.values()).filter(
      booking => booking.classId === classId,
    )
  }

  async getClassBookingsByMember(memberId: number): Promise<ClassBooking[]> {
    return Array.from(this.classBookings.values()).filter(
      booking => booking.memberId === memberId,
    )
  }

  async createClassBooking(
    bookingData: InsertClassBooking,
  ): Promise<ClassBooking> {
    const id = this.bookingIdCounter++
    const booking: ClassBooking = {...bookingData, id}
    this.classBookings.set(id, booking)

    // Get member and class details for activity log
    const member = await this.getMember(booking.memberId)
    const gymClass = await this.getClass(booking.classId)

    if (member && gymClass) {
      // Log activity
      await this.createActivity({
        memberId: booking.memberId,
        activityType: 'class_booking',
        description: `${member.firstName} ${member.lastName} booked ${gymClass.name}`,
        timestamp: new Date(),
        userId: null,
      })
    }

    return booking
  }

  async updateClassBooking(
    id: number,
    bookingData: Partial<ClassBooking>,
  ): Promise<ClassBooking | undefined> {
    const booking = this.classBookings.get(id)
    if (!booking) return undefined

    const updatedBooking = {...booking, ...bookingData}
    this.classBookings.set(id, updatedBooking)

    // Log attendance if status updated
    if (
      bookingData.attendanceStatus &&
      bookingData.attendanceStatus !== booking.attendanceStatus
    ) {
      const member = await this.getMember(booking.memberId)
      const gymClass = await this.getClass(booking.classId)

      if (member && gymClass) {
        await this.createActivity({
          memberId: booking.memberId,
          activityType: 'class_attendance',
          description: `${member.firstName} ${member.lastName} ${bookingData.attendanceStatus} for ${gymClass.name}`,
          timestamp: new Date(),
          userId: null,
        })
      }
    }

    return updatedBooking
  }

  async deleteClassBooking(id: number): Promise<boolean> {
    return this.classBookings.delete(id)
  }

  // Equipment
  async getEquipment(): Promise<Equipment[]> {
    return Array.from(this.equipmentItems.values())
  }

  async getEquipmentItem(id: number): Promise<Equipment | undefined> {
    return this.equipmentItems.get(id)
  }

  async createEquipment(itemData: InsertEquipment): Promise<Equipment> {
    const id = this.equipmentIdCounter++
    const item: Equipment = {...itemData, id}
    this.equipmentItems.set(id, item)

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'equipment_added',
      description: `New equipment added: ${item.name} (${item.quantity})`,
      timestamp: new Date(),
      userId: null,
    })

    return item
  }

  async updateEquipment(
    id: number,
    itemData: Partial<Equipment>,
  ): Promise<Equipment | undefined> {
    const item = this.equipmentItems.get(id)
    if (!item) return undefined

    const updatedItem = {...item, ...itemData}
    this.equipmentItems.set(id, updatedItem)
    return updatedItem
  }

  async deleteEquipment(id: number): Promise<boolean> {
    return this.equipmentItems.delete(id)
  }

  // Announcements
  async getAnnouncements(): Promise<Announcement[]> {
    return Array.from(this.announcements.values())
  }

  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    return this.announcements.get(id)
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const now = new Date()
    return Array.from(this.announcements.values()).filter(announcement => {
      const isActive = announcement.isActive
      const notExpired =
        !announcement.expiryDate || new Date(announcement.expiryDate) > now
      return isActive && notExpired
    })
  }

  async createAnnouncement(
    announcementData: InsertAnnouncement,
  ): Promise<Announcement> {
    const id = this.announcementIdCounter++
    const announcement: Announcement = {...announcementData, id}
    this.announcements.set(id, announcement)

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'announcement_created',
      description: `New announcement: ${announcement.title}`,
      timestamp: new Date(),
      userId: announcement.createdBy,
    })

    return announcement
  }

  async updateAnnouncement(
    id: number,
    announcementData: Partial<Announcement>,
  ): Promise<Announcement | undefined> {
    const announcement = this.announcements.get(id)
    if (!announcement) return undefined

    const updatedAnnouncement = {...announcement, ...announcementData}
    this.announcements.set(id, updatedAnnouncement)
    return updatedAnnouncement
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    return this.announcements.delete(id)
  }

  // Activities
  async getActivities(): Promise<Activity[]> {
    return Array.from(this.activities.values()).sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
  }

  async getRecentActivities(limit: number): Promise<Activity[]> {
    return (await this.getActivities()).slice(0, limit)
  }

  async getUserActivities(userId: number): Promise<Activity[]> {
    return (await this.getActivities()).filter(
      activity => activity.userId === userId,
    )
  }

  async getMemberActivities(memberId: number): Promise<Activity[]> {
    return (await this.getActivities()).filter(
      activity => activity.memberId === memberId,
    )
  }

  async createActivity(activityData: InsertActivity): Promise<Activity> {
    const id = this.activityIdCounter++
    const activity: Activity = {...activityData, id}
    this.activities.set(id, activity)
    return activity
  }

  // Payments
  async getPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values())
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    return this.payments.get(id)
  }

  async getPaymentsByMember(memberId: number): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      payment => payment.memberId === memberId,
    )
  }

  async getPendingPayments(): Promise<Payment[]> {
    return Array.from(this.payments.values()).filter(
      payment => payment.status === 'pending',
    )
  }

  async createPayment(paymentData: InsertPayment): Promise<Payment> {
    const id = this.paymentIdCounter++
    const payment: Payment = {...paymentData, id}
    this.payments.set(id, payment)

    // Get member and plan details for activity log
    const member = await this.getMember(payment.memberId)
    const plan = await this.getMembershipPlan(payment.planId)

    if (member && plan) {
      // Log activity
      await this.createActivity({
        memberId: payment.memberId,
        activityType: 'payment_created',
        description: `${member.firstName} ${
          member.lastName
        } registró un pago de ${(payment.amount / 100).toFixed(2)} soles por ${
          plan.name
        }`,
        timestamp: new Date(),
        userId: null,
      })
    }

    return payment
  }

  async updatePayment(
    id: number,
    paymentData: Partial<Payment>,
  ): Promise<Payment | undefined> {
    const payment = this.payments.get(id)
    if (!payment) return undefined

    const updatedPayment = {...payment, ...paymentData}
    this.payments.set(id, updatedPayment)
    return updatedPayment
  }

  async verifyPayment(
    id: number,
    adminId: number,
  ): Promise<Payment | undefined> {
    const payment = this.payments.get(id)
    if (!payment) return undefined

    const updatedPayment = {
      ...payment,
      status: 'verified',
      verifiedById: adminId,
      verifiedAt: new Date(),
    }

    this.payments.set(id, updatedPayment)

    // Get member and plan details for activity log
    const member = await this.getMember(payment.memberId)
    const admin = await this.getUser(adminId)
    const plan = await this.getMembershipPlan(payment.planId)

    if (member && admin && plan) {
      // Log activity
      await this.createActivity({
        memberId: payment.memberId,
        activityType: 'payment_verified',
        description: `Pago de ${member.firstName} ${member.lastName} por ${plan.name} verificado por ${admin.name}`,
        timestamp: new Date(),
        userId: adminId,
      })

      // Update member expiry date based on plan duration
      const currentDate = new Date()
      let expiryDate = new Date(member.expiryDate || currentDate)

      // If membership already expired, start from today
      if (expiryDate < currentDate) {
        expiryDate = currentDate
      }

      // Add duration based on plan durationType
      switch (plan.durationType) {
        case 'day':
          expiryDate.setDate(expiryDate.getDate() + plan.duration)
          break
        case 'week':
          expiryDate.setDate(expiryDate.getDate() + plan.duration * 7)
          break
        case 'month':
          expiryDate.setMonth(expiryDate.getMonth() + plan.duration)
          break
        case 'year':
          expiryDate.setFullYear(expiryDate.getFullYear() + plan.duration)
          break
      }

      // Update member's expiry date and status
      await this.updateMember(member.id, {
        expiryDate: expiryDate.toISOString(),
        status: 'active',
      })
    }

    return updatedPayment
  }

  async rejectPayment(
    id: number,
    adminId: number,
    notes?: string,
  ): Promise<Payment | undefined> {
    const payment = this.payments.get(id)
    if (!payment) return undefined

    const updatedPayment = {
      ...payment,
      status: 'rejected',
      verifiedById: adminId,
      verifiedAt: new Date(),
      notes: notes || payment.notes,
    }

    this.payments.set(id, updatedPayment)

    // Get member and admin details for activity log
    const member = await this.getMember(payment.memberId)
    const admin = await this.getUser(adminId)

    if (member && admin) {
      // Log activity
      await this.createActivity({
        memberId: payment.memberId,
        activityType: 'payment_rejected',
        description: `Pago de ${member.firstName} ${
          member.lastName
        } rechazado por ${admin.name}${notes ? `: ${notes}` : ''}`,
        timestamp: new Date(),
        userId: adminId,
      })
    }

    return updatedPayment
  }

  // Seed initial data for demonstration
  private async seedInitialData() {
    // Create default admin user
    const admin = await this.createUser({
      username: 'admin',
      password: 'admin123', // In a real app, this would be hashed
      name: 'John Smith',
      role: 'admin',
      email: 'admin@gympro.com',
      phone: '555-1234',
      avatarUrl:
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
    })

    // Create membership plans
    const basicPlan = await this.createMembershipPlan({
      name: 'Basic',
      description: 'Access to gym facilities during standard hours',
      price: 2999, // $29.99
      duration: 30,
      durationType: 'monthly',
      features: ['Gym access', 'Locker room'],
      isActive: true,
    })

    const standardPlan = await this.createMembershipPlan({
      name: 'Standard',
      description: 'Full access to gym and basic classes',
      price: 4999, // $49.99
      duration: 30,
      durationType: 'monthly',
      features: [
        'Gym access',
        'Locker room',
        'Group classes',
        'Fitness assessment',
      ],
      isActive: true,
    })

    const premiumPlan = await this.createMembershipPlan({
      name: 'Premium',
      description: 'Complete access to all facilities and classes',
      price: 7999, // $79.99
      duration: 30,
      durationType: 'monthly',
      features: [
        '24/7 Gym access',
        'Locker room',
        'All classes',
        'Personal trainer session',
        'Nutritional consulting',
      ],
      isActive: true,
    })

    // Create trainers
    const trainer1 = await this.createTrainer({
      firstName: 'Emma',
      lastName: 'Lee',
      email: 'emma.lee@gympro.com',
      phone: '555-9876',
      specialization: ['Yoga', 'Pilates', 'Stretching'],
      bio: 'Certified yoga instructor with 5 years of experience',
      status: 'active',
      avatarUrl:
        'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      hireDate: new Date('2021-06-15'),
    })

    const trainer2 = await this.createTrainer({
      firstName: 'Michael',
      lastName: 'Torres',
      email: 'michael.torres@gympro.com',
      phone: '555-5678',
      specialization: ['Spinning', 'HIIT', 'Cardio'],
      bio: 'Former competitive cyclist, now helping others achieve their fitness goals',
      status: 'active',
      avatarUrl:
        'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      hireDate: new Date('2022-01-10'),
    })

    const trainer3 = await this.createTrainer({
      firstName: 'Jessica',
      lastName: 'Brown',
      email: 'jessica.brown@gympro.com',
      phone: '555-4321',
      specialization: ['HIIT', 'Strength Training', 'Functional Fitness'],
      bio: 'Passionate about helping clients push their limits and achieve their goals',
      status: 'active',
      avatarUrl:
        'https://images.unsplash.com/photo-1548372290-8d01b6c8e78c?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      hireDate: new Date('2021-11-20'),
    })

    const trainer4 = await this.createTrainer({
      firstName: 'Ryan',
      lastName: 'Peterson',
      email: 'ryan.peterson@gympro.com',
      phone: '555-8765',
      specialization: [
        'CrossFit',
        'Olympic Lifting',
        'Strength & Conditioning',
      ],
      bio: 'CrossFit Level 2 Trainer with background in competitive weightlifting',
      status: 'active',
      avatarUrl:
        'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      hireDate: new Date('2022-03-01'),
    })

    // Create classes
    await this.createClass({
      name: 'Morning Yoga',
      description: 'Start your day with energy and calm',
      trainerId: trainer1.id,
      room: 'Studio 2',
      capacity: 20,
      startTime: '06:00:00',
      endTime: '07:00:00',
      daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
      isActive: true,
    })

    await this.createClass({
      name: 'Spinning',
      description: 'High-intensity cycling class for all levels',
      trainerId: trainer2.id,
      room: 'Cycling Room',
      capacity: 15,
      startTime: '09:30:00',
      endTime: '10:30:00',
      daysOfWeek: ['Monday', 'Tuesday', 'Thursday', 'Friday'],
      isActive: true,
    })

    await this.createClass({
      name: 'HIIT',
      description: 'High Intensity Interval Training to torch calories',
      trainerId: trainer3.id,
      room: 'Studio 1',
      capacity: 25,
      startTime: '12:00:00',
      endTime: '13:00:00',
      daysOfWeek: ['Monday', 'Wednesday', 'Friday'],
      isActive: true,
    })

    await this.createClass({
      name: 'CrossFit',
      description: 'Challenging functional fitness workout',
      trainerId: trainer4.id,
      room: 'Functional Area',
      capacity: 20,
      startTime: '17:30:00',
      endTime: '18:30:00',
      daysOfWeek: ['Monday', 'Tuesday', 'Thursday'],
      isActive: true,
    })

    // Create members
    const member1 = await this.createMember({
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'sarah.williams@example.com',
      phone: '555-1111',
      address: '123 Main St, Anytown',
      joinDate: new Date('2023-10-15'),
      planId: premiumPlan.id,
      status: 'active',
      avatarUrl:
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      emergencyContact: 'John Williams',
      emergencyPhone: '555-2222',
      notes: 'Interested in personal training',
      expiryDate: new Date('2023-11-15'),
    })

    const member2 = await this.createMember({
      firstName: 'Marcus',
      lastName: 'Johnson',
      email: 'marcus.johnson@example.com',
      phone: '555-3333',
      address: '456 Oak Ave, Anytown',
      joinDate: new Date('2023-09-22'),
      planId: standardPlan.id,
      status: 'active',
      avatarUrl:
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      emergencyContact: 'Lisa Johnson',
      emergencyPhone: '555-4444',
      notes: 'Prefers morning workouts',
      expiryDate: new Date('2024-09-22'),
    })

    const member3 = await this.createMember({
      firstName: 'Emma',
      lastName: 'Garcia',
      email: 'emma.garcia@example.com',
      phone: '555-5555',
      address: '789 Pine St, Anytown',
      joinDate: new Date('2023-09-19'),
      planId: basicPlan.id,
      status: 'active',
      avatarUrl:
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      emergencyContact: 'Carlos Garcia',
      emergencyPhone: '555-6666',
      notes: 'Interested in yoga classes',
      expiryDate: new Date('2023-10-19'),
    })

    const member4 = await this.createMember({
      firstName: 'David',
      lastName: 'Chen',
      email: 'david.chen@example.com',
      phone: '555-7777',
      address: '101 Cedar Ln, Anytown',
      joinDate: new Date('2023-09-15'),
      planId: premiumPlan.id,
      status: 'pending',
      avatarUrl:
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      emergencyContact: 'Mei Chen',
      emergencyPhone: '555-8888',
      notes: 'Looking for a training partner',
      expiryDate: new Date('2023-10-15'),
    })

    const member5 = await this.createMember({
      firstName: 'Sophia',
      lastName: 'Martinez',
      email: 'sophia.martinez@example.com',
      phone: '555-9999',
      address: '202 Maple Dr, Anytown',
      joinDate: new Date('2023-08-30'),
      planId: standardPlan.id,
      status: 'expired',
      avatarUrl:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=120&h=120&q=80',
      emergencyContact: 'Miguel Martinez',
      emergencyPhone: '555-0000',
      notes: 'Needs a reminder to renew membership',
      expiryDate: new Date('2023-09-30'),
    })

    // Create equipment
    await this.createEquipment({
      name: 'Treadmill',
      description: 'Commercial grade running machine',
      category: 'Cardio',
      purchaseDate: new Date('2022-05-15'),
      purchasePrice: 299900, // $2,999.00
      condition: 'good',
      maintenanceDate: new Date('2023-05-15'),
      notes: 'Regular maintenance required',
      quantity: 8,
      imageUrl:
        'https://images.unsplash.com/photo-1570440828762-c86aa7168ef4?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    })

    await this.createEquipment({
      name: 'Dumbbells Set',
      description: '5-50 lbs rubber hex dumbbells',
      category: 'Weights',
      purchaseDate: new Date('2022-06-10'),
      purchasePrice: 499900, // $4,999.00
      condition: 'excellent',
      maintenanceDate: null,
      notes: 'Complete set, store on rack properly',
      quantity: 10,
      imageUrl:
        'https://images.unsplash.com/photo-1580261450046-d0a30080dc9b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    })

    await this.createEquipment({
      name: 'Yoga Mats',
      description: 'Premium non-slip exercise mats',
      category: 'Accessories',
      purchaseDate: new Date('2023-01-20'),
      purchasePrice: 2500, // $25.00 each
      condition: 'good',
      maintenanceDate: null,
      notes: 'Clean after each use',
      quantity: 25,
      imageUrl:
        'https://images.unsplash.com/photo-1607077803136-eea8548b9f15?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    })

    await this.createEquipment({
      name: 'Squat Rack',
      description: 'Commercial power cage with safety bars',
      category: 'Strength',
      purchaseDate: new Date('2022-07-05'),
      purchasePrice: 199900, // $1,999.00
      condition: 'good',
      maintenanceDate: new Date('2023-07-05'),
      notes: 'Weight capacity: 1000 lbs',
      quantity: 4,
      imageUrl:
        'https://images.unsplash.com/photo-1577221084712-45b0445d2b00?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    })

    // Create announcements
    await this.createAnnouncement({
      title: 'Holiday Hours',
      content:
        'Special holiday hours in effect next week. The gym will close at 8pm on Dec 24 and Dec 31.',
      category: 'operational',
      publishDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdBy: 1,
    })

    await this.createAnnouncement({
      title: 'New Classes Added',
      content:
        "We've added 3 new HIIT classes on Tuesdays and Thursdays. Sign up is now open!",
      category: 'classes',
      publishDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      expiryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdBy: 1,
    })

    await this.createAnnouncement({
      title: 'Summer Promotion',
      content:
        'Refer a friend and both get 20% off your next monthly membership fee!',
      category: 'promotion',
      publishDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      createdBy: 1,
    })

    // Create class bookings and activities
    await this.createClassBooking({
      classId: 1,
      memberId: member1.id,
      bookingDate: new Date(),
      status: 'confirmed',
      attendanceStatus: 'checked-in',
    })

    await this.createClassBooking({
      classId: 2,
      memberId: member2.id,
      bookingDate: new Date(),
      status: 'confirmed',
      attendanceStatus: null,
    })

    await this.createClassBooking({
      classId: 3,
      memberId: member3.id,
      bookingDate: new Date(),
      status: 'confirmed',
      attendanceStatus: null,
    })

    // Create mock activities
    await this.createActivity({
      userId: null,
      memberId: member1.id,
      activityType: 'check_in',
      description: 'Sarah Williams checked in for Spin Class',
      timestamp: new Date(),
    })

    await this.createActivity({
      userId: null,
      memberId: member2.id,
      activityType: 'membership_update',
      description: 'Marcus Johnson updated his membership plan',
      timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    })

    await this.createActivity({
      userId: null,
      memberId: member3.id,
      activityType: 'class_registration',
      description: 'Emma Garcia registered for Yoga Class',
      timestamp: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
    })

    await this.createActivity({
      userId: null,
      memberId: null,
      activityType: 'equipment_added',
      description: 'New equipment added to inventory',
      timestamp: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    })
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: any

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    })

    // Inicializar datos por defecto
    this.initDefaultData()
  }

  // Payments
  async getPayments(): Promise<Payment[]> {
    return await db.select().from(payments)
  }

  async getPayment(id: number): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id))
    return payment
  }

  async getPaymentsByMember(memberId: number): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.memberId, memberId))
  }

  async getPendingPayments(): Promise<Payment[]> {
    return await db
      .select()
      .from(payments)
      .where(eq(payments.status, 'pending'))
  }

  async verifyPayment(
    id: number,
    adminId: number,
  ): Promise<Payment | undefined> {
    const payment = await this.getPayment(id)
    if (!payment) return undefined

    // Actualizar el estado del pago a verificado
    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: 'verified',
        verifiedById: adminId,
        verifiedAt: new Date(),
      })
      .where(eq(payments.id, id))
      .returning()

    // Obtener detalles del miembro, admin y plan para registros de actividad
    const member = await this.getMember(payment.memberId)
    const admin = await this.getUser(adminId)
    const plan = await this.getMembershipPlan(payment.planId)

    if (member && admin && plan) {
      // Registrar actividad de verificación
      await this.createActivity({
        memberId: payment.memberId,
        activityType: 'payment_verified',
        description: `Pago de ${member.firstName} ${member.lastName} por ${plan.name} verificado por ${admin.name}`,
        timestamp: new Date(),
        userId: adminId,
      })

      // Calcular nueva fecha de expiración basada en el plan
      const currentDate = new Date()
      let expiryDate = member.expiryDate
        ? new Date(member.expiryDate)
        : currentDate

      // Si la membresía ya expiró, comenzar desde hoy
      if (expiryDate < currentDate) {
        expiryDate = currentDate
      }

      // Añadir duración basada en el tipo de duración del plan
      switch (plan.durationType) {
        case 'day':
          expiryDate.setDate(expiryDate.getDate() + plan.duration)
          break
        case 'week':
          expiryDate.setDate(expiryDate.getDate() + plan.duration * 7)
          break
        case 'month':
          expiryDate.setMonth(expiryDate.getMonth() + plan.duration)
          break
        case 'year':
          expiryDate.setFullYear(expiryDate.getFullYear() + plan.duration)
          break
      }

      // Actualizar estado del miembro a activo y establecer nueva fecha de expiración
      await this.updateMember(member.id, {
        status: 'active',
        planId: plan.id,
        expiryDate: expiryDate.toISOString(),
      })

      // Registrar actividad de activación de membresía
      await this.createActivity({
        activityType: 'membership_activated',
        description: `Membresía ${plan.name} activada para ${member.firstName} ${member.lastName}`,
        timestamp: new Date(),
        memberId: member.id,
        userId: adminId,
      })
    }

    return updatedPayment
  }

  async createPayment(paymentData: InsertPayment): Promise<Payment> {
    // Solo actualizar el estado si viene como verificado o establecerlo automáticamente
    const status = paymentData.status || 'verified'
    const verifiedAt = status === 'verified' ? new Date() : null
    const verifiedById =
      status === 'verified' ? paymentData.verifiedById || null : null

    const paymentWithStatus = {
      ...paymentData,
      status,
      verifiedAt,
      verifiedById,
    }

    const [newPayment] = await db
      .insert(payments)
      .values(paymentWithStatus)
      .returning()

    // Get member and plan details for activity log
    const member = await this.getMember(newPayment.memberId)
    const plan = await this.getMembershipPlan(newPayment.planId)

    if (member && plan) {
      // Log activity
      await this.createActivity({
        memberId: newPayment.memberId,
        activityType: 'payment_created',
        description: `${member.firstName} ${
          member.lastName
        } registró un pago de ${(newPayment.amount / 100).toFixed(
          2,
        )} soles por ${plan.name}`,
        timestamp: new Date(),
        userId: null,
      })

      // Solo actualizar la membresía si el pago está verificado
      if (status === 'verified') {
        // Calcular nueva fecha de expiración desde la fecha de pago
        const paymentDate = new Date(newPayment.paymentDate)
        // Usar la fecha de pago como base para el cálculo
        let expiryDate = new Date(paymentDate)

        console.log(
          `Calculando expiración usando fecha de pago: ${paymentDate.toISOString()}`,
        )

        // Añadir duración basada en el tipo de duración del plan
        // La duración siempre es un multiplicador de la unidad definida por el tipo
        // (ej: un plan mensual con duración 3 = 3 meses)
        console.log(
          `Calculando expiración para plan: ${plan.name}, tipo: ${plan.durationType}, multiplicador: ${plan.duration}`,
        )

        // Default a 1 si la duración no está definida o es menor que 1
        const duration = plan.duration && plan.duration > 0 ? plan.duration : 1

        switch (plan.durationType) {
          case 'daily':
            // Si es diario, añadir días (duración * 1 día)
            expiryDate.setDate(expiryDate.getDate() + duration)
            console.log(`Añadiendo ${duration} días`)
            break
          case 'weekly':
            // Si es semanal, añadir semanas (duración * 7 días)
            expiryDate.setDate(expiryDate.getDate() + duration * 7)
            console.log(`Añadiendo ${duration} semanas (${duration * 7} días)`)
            break
          case 'monthly':
            // Si es mensual, añadir meses (duración * 1 mes)
            expiryDate.setMonth(expiryDate.getMonth() + duration)
            console.log(`Añadiendo ${duration} meses`)
            break
          case 'yearly':
          case 'annual':
            // Si es anual, añadir años (duración * 1 año)
            expiryDate.setFullYear(expiryDate.getFullYear() + duration)
            console.log(`Añadiendo ${duration} años`)
            break
          default:
            // Si no se reconoce el tipo de duración, usar días por defecto
            console.log(
              `Tipo de duración no reconocido: ${plan.durationType}, usando ${duration} días como valor predeterminado`,
            )
            expiryDate.setDate(expiryDate.getDate() + duration)
            break
        }

        // Asegurar que la fecha no sea el mismo día (añadir 1 día más por seguridad)
        expiryDate.setDate(expiryDate.getDate() + 1)

        console.log(
          `Actualizando estado de miembro a activo: ${member.firstName} ${
            member.lastName
          }, nueva fecha expiración: ${expiryDate.toISOString()}`,
        )

        // Actualizar directamente en la base de datos para evitar la verificación automática
        await db
          .update(members)
          .set({
            status: 'active',
            planId: plan.id,
            expiryDate: expiryDate.toISOString(),
          })
          .where(eq(members.id, member.id))

        // Registrar actividad de activación de membresía
        await this.createActivity({
          activityType: 'membership_activated',
          description: `Membresía ${plan.name} activada para ${member.firstName} ${member.lastName}`,
          timestamp: new Date(),
          memberId: member.id,
          userId: newPayment.verifiedById,
        })
      }
    }

    return newPayment
  }

  async updatePayment(
    id: number,
    paymentData: Partial<Payment>,
  ): Promise<Payment | undefined> {
    const [updatedPayment] = await db
      .update(payments)
      .set(paymentData)
      .where(eq(payments.id, id))
      .returning()

    return updatedPayment
  }

  async rejectPayment(
    id: number,
    adminId: number,
    notes?: string,
  ): Promise<Payment | undefined> {
    const [updatedPayment] = await db
      .update(payments)
      .set({
        status: 'rejected',
        verifiedById: adminId,
        verifiedAt: new Date(),
        notes: notes,
      })
      .where(eq(payments.id, id))
      .returning()

    if (updatedPayment) {
      // Get member and admin details for activity log
      const member = await this.getMember(updatedPayment.memberId)
      const admin = await this.getUser(adminId)

      if (member && admin) {
        // Log activity
        await this.createActivity({
          memberId: updatedPayment.memberId,
          activityType: 'payment_rejected',
          description: `Pago de ${member.firstName} ${member.lastName} fue rechazado por ${admin.name}`,
          timestamp: new Date(),
          userId: adminId,
        })
      }
    }

    return updatedPayment
  }

  // Inicializar datos por defecto si no existen
  private async initDefaultData() {
    try {
      // Verificar si ya existen planes de membresía
      const plans = await this.getMembershipPlans()
      if (plans.length === 0) {
        // Crear planes por defecto
        await this.seedMembershipPlans()
      }

      // Verificar si ya existen pagos
      const existingPayments = await this.getPayments()
      if (existingPayments.length === 0) {
        // Crear algunos pagos de prueba
        await this.seedPayments()
      }
    } catch (error) {
      console.error('Error al inicializar datos por defecto:', error)
    }
  }

  // Crear pagos de prueba
  private async seedPayments() {
    try {
      // Obtener miembros existentes
      const members = await this.getMembers()
      // Obtener planes existentes
      const plans = await this.getMembershipPlans()

      if (members.length > 0 && plans.length > 0) {
        // Pago verificado
        await this.createPayment({
          memberId: members[0].id,
          planId: plans[0].id,
          amount: plans[0].price,
          paymentMethod: 'yape',
          paymentDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 días atrás
          status: 'verified',
          receiptUrl:
            'https://images.unsplash.com/photo-1572021335469-31706a17aaef?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
          notes: 'Pago realizado correctamente',
          verifiedById: 1, // Admin
          verifiedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 días atrás
        })

        // Pago pendiente
        await this.createPayment({
          memberId: members[1].id,
          planId: plans[1].id,
          amount: plans[1].price,
          paymentMethod: 'yape',
          paymentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 días atrás
          status: 'pending',
          receiptUrl:
            'https://images.unsplash.com/photo-1564593296751-403020f7b70e?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
          notes: null,
          verifiedById: null,
          verifiedAt: null,
        })

        // Pago rechazado
        await this.createPayment({
          memberId: members[2].id,
          planId: plans[2].id,
          amount: plans[2].price,
          paymentMethod: 'yape',
          paymentDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 días atrás
          status: 'rejected',
          receiptUrl:
            'https://images.unsplash.com/photo-1550565353-0d14a343dea6?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
          notes: 'Comprobante no válido o ilegible',
          verifiedById: 1, // Admin
          verifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 días atrás
        })

        // Otro pago pendiente más reciente
        await this.createPayment({
          memberId: members[3].id,
          planId: plans[0].id,
          amount: plans[0].price,
          paymentMethod: 'efectivo',
          paymentDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 día atrás
          status: 'pending',
          receiptUrl: null,
          notes: 'Pagará en recepción',
          verifiedById: null,
          verifiedAt: null,
        })
      }
    } catch (error) {
      console.error('Error al generar pagos de prueba:', error)
    }
  }

  // Crear planes de membresía por defecto
  private async seedMembershipPlans() {
    // Plan diario (1 día)
    await this.createMembershipPlan({
      name: 'Diario',
      description: 'Acceso al gimnasio durante 1 día',
      price: 600, // S/6.00
      duration: 1,
      durationType: 'daily',
      features: ['Acceso al gimnasio', 'Vestuarios'],
      isActive: true,
    })

    // Plan semanal (1 semana)
    await this.createMembershipPlan({
      name: 'Semanal',
      description: 'Acceso al gimnasio durante 1 semana',
      price: 3000, // S/30.00
      duration: 1,
      durationType: 'weekly',
      features: ['Acceso al gimnasio', 'Vestuarios', 'Clases básicas'],
      isActive: true,
    })

    // Plan mensual (1 mes)
    await this.createMembershipPlan({
      name: 'Mensual',
      description: 'Acceso al gimnasio durante 1 mes',
      price: 7000, // S/70.00
      duration: 1,
      durationType: 'monthly',
      features: [
        'Acceso al gimnasio',
        'Vestuarios',
        'Todas las clases',
        '1 sesión con entrenador personal',
      ],
      isActive: true,
    })

    // Plan trimestral (3 meses)
    await this.createMembershipPlan({
      name: 'Trimestral',
      description: 'Acceso al gimnasio durante 3 meses',
      price: 18000, // S/180.00
      duration: 3,
      durationType: 'monthly',
      features: [
        'Acceso al gimnasio',
        'Vestuarios',
        'Todas las clases',
        '3 sesiones con entrenador personal',
      ],
      isActive: true,
    })

    // Plan anual (1 año)
    await this.createMembershipPlan({
      name: 'Anual',
      description: 'Acceso al gimnasio durante 1 año',
      price: 65000, // S/650.00
      duration: 1,
      durationType: 'yearly',
      features: [
        'Acceso al gimnasio 24/7',
        'Vestuarios',
        'Todas las clases',
        '12 sesiones con entrenador personal',
        'Plan nutricional',
      ],
      isActive: true,
    })
  }

  // Users
  async getUsers(): Promise<User[]> {
    return await db.select().from(users)
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id))
    return user
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
    return user
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning()
    return newUser
  }

  async updateUser(
    id: number,
    userData: Partial<User>,
  ): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning()
    return updatedUser
  }

  async deleteUser(id: number): Promise<boolean> {
    await db.delete(users).where(eq(users.id, id))
    return true
  }

  // Membership Plans
  async getMembershipPlans(): Promise<MembershipPlan[]> {
    return await db.select().from(membershipPlans)
  }

  async getMembershipPlan(id: number): Promise<MembershipPlan | undefined> {
    const [plan] = await db
      .select()
      .from(membershipPlans)
      .where(eq(membershipPlans.id, id))
    return plan
  }

  async createMembershipPlan(
    plan: InsertMembershipPlan,
  ): Promise<MembershipPlan> {
    const [newPlan] = await db.insert(membershipPlans).values(plan).returning()
    return newPlan
  }

  async updateMembershipPlan(
    id: number,
    planData: Partial<MembershipPlan>,
  ): Promise<MembershipPlan | undefined> {
    const [updatedPlan] = await db
      .update(membershipPlans)
      .set(planData)
      .where(eq(membershipPlans.id, id))
      .returning()
    return updatedPlan
  }

  async deleteMembershipPlan(id: number): Promise<boolean> {
    await db.delete(membershipPlans).where(eq(membershipPlans.id, id))
    return true
  }

  // Members
  async getMembers(): Promise<Member[]> {
    // Obtener todos los miembros
    const membersList = await db.select().from(members)

    // Verificar membresías expiradas y actualizar estado automáticamente
    const today = new Date()
    // Establecer la hora a 00:00:00 para comparar solo la fecha
    today.setHours(0, 0, 0, 0)

    // Miembros que necesitan actualización (activos con fecha de expiración pasada)
    const membersToUpdate = membersList.filter(
      member =>
        member.status === 'active' &&
        member.expiryDate &&
        new Date(member.expiryDate) < today,
    )

    // Actualizar estado de miembros con membresías expiradas
    for (const member of membersToUpdate) {
      // Actualizar estado en la base de datos
      await db
        .update(members)
        .set({status: 'expired'})
        .where(eq(members.id, member.id))

      // Registrar actividad
      await this.createActivity({
        memberId: member.id,
        activityType: 'membership_expired',
        description: `Membership expired for: ${member.firstName} ${member.lastName}`,
        timestamp: new Date(),
        userId: null,
      })

      console.log(
        `Updated member status to expired: ${member.firstName} ${member.lastName}`,
      )

      // Actualizar el objeto en la lista
      member.status = 'expired'
    }

    // Devolver la lista actualizada de miembros
    return membersList
  }

  async getMember(id: number): Promise<Member | undefined> {
    const [member] = await db.select().from(members).where(eq(members.id, id))
    return member
  }

  async getMemberByEmail(email: string): Promise<Member | undefined> {
    const [member] = await db
      .select()
      .from(members)
      .where(eq(members.email, email))
    return member
  }

  async createMember(member: InsertMember): Promise<Member> {
    const [newMember] = await db.insert(members).values(member).returning()

    // Log activity
    await this.createActivity({
      memberId: newMember.id,
      activityType: 'member_created',
      description: `New member added: ${newMember.firstName} ${newMember.lastName}`,
      timestamp: new Date(),
      userId: null,
    })

    return newMember
  }

  async updateMember(
    id: number,
    memberData: Partial<Member>,
  ): Promise<Member | undefined> {
    const [updatedMember] = await db
      .update(members)
      .set(memberData)
      .where(eq(members.id, id))
      .returning()

    if (updatedMember) {
      // Log activity
      await this.createActivity({
        memberId: id,
        activityType: 'member_updated',
        description: `Member updated: ${updatedMember.firstName} ${updatedMember.lastName}`,
        timestamp: new Date(),
        userId: null,
      })
    }

    return updatedMember
  }

  async deleteMember(id: number): Promise<boolean> {
    const [member] = await db.select().from(members).where(eq(members.id, id))

    if (member) {
      // Log activity before deletion
      await this.createActivity({
        memberId: null,
        activityType: 'member_deleted',
        description: `Member deleted: ${member.firstName} ${member.lastName}`,
        timestamp: new Date(),
        userId: null,
      })
    }

    await db.delete(members).where(eq(members.id, id))
    return true
  }

  // Trainers
  async getTrainers(): Promise<Trainer[]> {
    return await db.select().from(trainers)
  }

  async getTrainer(id: number): Promise<Trainer | undefined> {
    const [trainer] = await db
      .select()
      .from(trainers)
      .where(eq(trainers.id, id))
    return trainer
  }

  async getTrainerByEmail(email: string): Promise<Trainer | undefined> {
    const [trainer] = await db
      .select()
      .from(trainers)
      .where(eq(trainers.email, email))
    return trainer
  }

  async createTrainer(trainer: InsertTrainer): Promise<Trainer> {
    const [newTrainer] = await db.insert(trainers).values(trainer).returning()

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'trainer_created',
      description: `New trainer added: ${newTrainer.firstName} ${newTrainer.lastName}`,
      timestamp: new Date(),
      userId: null,
    })

    return newTrainer
  }

  async updateTrainer(
    id: number,
    trainerData: Partial<Trainer>,
  ): Promise<Trainer | undefined> {
    const [updatedTrainer] = await db
      .update(trainers)
      .set(trainerData)
      .where(eq(trainers.id, id))
      .returning()
    return updatedTrainer
  }

  async deleteTrainer(id: number): Promise<boolean> {
    await db.delete(trainers).where(eq(trainers.id, id))
    return true
  }

  // Classes
  async getClasses(): Promise<Class[]> {
    return await db.select().from(classes)
  }

  async getClass(id: number): Promise<Class | undefined> {
    const [gymClass] = await db.select().from(classes).where(eq(classes.id, id))
    return gymClass
  }

  async createClass(gymClass: InsertClass): Promise<Class> {
    const [newClass] = await db.insert(classes).values(gymClass).returning()

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'class_created',
      description: `New class added: ${newClass.name}`,
      timestamp: new Date(),
      userId: null,
    })

    return newClass
  }

  async updateClass(
    id: number,
    classData: Partial<Class>,
  ): Promise<Class | undefined> {
    const [updatedClass] = await db
      .update(classes)
      .set(classData)
      .where(eq(classes.id, id))
      .returning()
    return updatedClass
  }

  async deleteClass(id: number): Promise<boolean> {
    await db.delete(classes).where(eq(classes.id, id))
    return true
  }

  // Class Bookings
  async getClassBookings(): Promise<ClassBooking[]> {
    return await db.select().from(classBookings)
  }

  async getClassBooking(id: number): Promise<ClassBooking | undefined> {
    const [booking] = await db
      .select()
      .from(classBookings)
      .where(eq(classBookings.id, id))
    return booking
  }

  async getClassBookingsByClass(classId: number): Promise<ClassBooking[]> {
    return await db
      .select()
      .from(classBookings)
      .where(eq(classBookings.classId, classId))
  }

  async getClassBookingsByMember(memberId: number): Promise<ClassBooking[]> {
    return await db
      .select()
      .from(classBookings)
      .where(eq(classBookings.memberId, memberId))
  }

  async createClassBooking(booking: InsertClassBooking): Promise<ClassBooking> {
    const [newBooking] = await db
      .insert(classBookings)
      .values(booking)
      .returning()

    // Get member and class details for activity log
    const member = await this.getMember(newBooking.memberId)
    const gymClass = await this.getClass(newBooking.classId)

    if (member && gymClass) {
      // Log activity
      await this.createActivity({
        memberId: newBooking.memberId,
        activityType: 'class_booking',
        description: `${member.firstName} ${member.lastName} booked ${gymClass.name}`,
        timestamp: new Date(),
        userId: null,
      })
    }

    return newBooking
  }

  async updateClassBooking(
    id: number,
    bookingData: Partial<ClassBooking>,
  ): Promise<ClassBooking | undefined> {
    // Get booking before update for comparison
    const [oldBooking] = await db
      .select()
      .from(classBookings)
      .where(eq(classBookings.id, id))

    const [updatedBooking] = await db
      .update(classBookings)
      .set(bookingData)
      .where(eq(classBookings.id, id))
      .returning()

    // Log attendance if status updated
    if (
      updatedBooking &&
      bookingData.attendanceStatus &&
      bookingData.attendanceStatus !== oldBooking?.attendanceStatus
    ) {
      const member = await this.getMember(updatedBooking.memberId)
      const gymClass = await this.getClass(updatedBooking.classId)

      if (member && gymClass) {
        await this.createActivity({
          memberId: updatedBooking.memberId,
          activityType: 'class_attendance',
          description: `${member.firstName} ${member.lastName} ${bookingData.attendanceStatus} for ${gymClass.name}`,
          timestamp: new Date(),
          userId: null,
        })
      }
    }

    return updatedBooking
  }

  async deleteClassBooking(id: number): Promise<boolean> {
    await db.delete(classBookings).where(eq(classBookings.id, id))
    return true
  }

  // Equipment
  async getEquipment(): Promise<Equipment[]> {
    return await db.select().from(equipment)
  }

  async getEquipmentItem(id: number): Promise<Equipment | undefined> {
    const [item] = await db.select().from(equipment).where(eq(equipment.id, id))
    return item
  }

  async createEquipment(item: InsertEquipment): Promise<Equipment> {
    const [newItem] = await db.insert(equipment).values(item).returning()

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'equipment_added',
      description: `New equipment added: ${newItem.name} (${newItem.quantity})`,
      timestamp: new Date(),
      userId: null,
    })

    return newItem
  }

  async updateEquipment(
    id: number,
    itemData: Partial<Equipment>,
  ): Promise<Equipment | undefined> {
    const [updatedItem] = await db
      .update(equipment)
      .set(itemData)
      .where(eq(equipment.id, id))
      .returning()
    return updatedItem
  }

  async deleteEquipment(id: number): Promise<boolean> {
    await db.delete(equipment).where(eq(equipment.id, id))
    return true
  }

  // Announcements
  async getAnnouncements(): Promise<Announcement[]> {
    return await db.select().from(announcements)
  }

  async getAnnouncement(id: number): Promise<Announcement | undefined> {
    const [announcement] = await db
      .select()
      .from(announcements)
      .where(eq(announcements.id, id))
    return announcement
  }

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const now = new Date()
    return await db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.isActive, true),
          or(
            isNull(announcements.expiryDate),
            gte(announcements.expiryDate, now),
          ),
        ),
      )
  }

  async createAnnouncement(
    announcement: InsertAnnouncement,
  ): Promise<Announcement> {
    const [newAnnouncement] = await db
      .insert(announcements)
      .values(announcement)
      .returning()

    // Log activity
    await this.createActivity({
      memberId: null,
      activityType: 'announcement_created',
      description: `New announcement: ${newAnnouncement.title}`,
      timestamp: new Date(),
      userId: newAnnouncement.createdBy,
    })

    return newAnnouncement
  }

  async updateAnnouncement(
    id: number,
    announcementData: Partial<Announcement>,
  ): Promise<Announcement | undefined> {
    const [updatedAnnouncement] = await db
      .update(announcements)
      .set(announcementData)
      .where(eq(announcements.id, id))
      .returning()
    return updatedAnnouncement
  }

  async deleteAnnouncement(id: number): Promise<boolean> {
    await db.delete(announcements).where(eq(announcements.id, id))
    return true
  }

  // Activities
  async getActivities(): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .orderBy(desc(activities.timestamp))
  }

  async getRecentActivities(limit: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .orderBy(desc(activities.timestamp))
      .limit(limit)
  }

  async getUserActivities(userId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.timestamp))
  }

  async getMemberActivities(memberId: number): Promise<Activity[]> {
    return await db
      .select()
      .from(activities)
      .where(eq(activities.memberId, memberId))
      .orderBy(desc(activities.timestamp))
  }

  async createActivity(activity: InsertActivity): Promise<Activity> {
    const [newActivity] = await db
      .insert(activities)
      .values(activity)
      .returning()
    return newActivity
  }
}

// Switch to database storage
export const storage = new DatabaseStorage()
