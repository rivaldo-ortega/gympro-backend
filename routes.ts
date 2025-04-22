import type {Express, Request, Response} from 'express'
import {createServer, type Server} from 'http'
import {storage} from './storage'
import {
  insertMemberSchema,
  insertMembershipPlanSchema,
  insertTrainerSchema,
  insertClassSchema,
  insertClassBookingSchema,
  insertEquipmentSchema,
  insertAnnouncementSchema,
  insertActivitySchema,
} from './schema'
import {z} from 'zod'
import {setupAuth, isAuthenticated, isAdmin} from './auth'

export async function registerRoutes(app: Express): Promise<Server> {
  // Configuración de autenticación
  setupAuth(app)

  // API Routes - all prefixed with /api

  // Dashboard stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const members = await storage.getMembers()
      const activeMembers = members.filter(m => m.status === 'active').length

      const classes = await storage.getClasses()
      const classesToday = classes.filter(c => {
        const today = new Date().toLocaleDateString('en-US', {weekday: 'long'})
        return c.daysOfWeek.includes(today) && c.isActive
      }).length

      // Calculate monthly revenue based on active members' plans
      let monthlyRevenue = 0
      const plans = await storage.getMembershipPlans()
      const planPriceMap = new Map(plans.map(p => [p.id, p.price]))

      for (const member of members) {
        if (member.status === 'active') {
          const planPrice = planPriceMap.get(member.planId) || 0
          monthlyRevenue += planPrice
        }
      }

      // Get new signups (members who joined in the last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const newSignups = members.filter(m => {
        const joinDate = new Date(m.joinDate)
        return joinDate >= thirtyDaysAgo
      }).length

      res.json({
        activeMembers,
        classesToday,
        monthlyRevenue,
        newSignups,
      })
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch dashboard stats'})
    }
  })

  // Recent activities
  app.get('/api/activities/recent', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10
      const activities = await storage.getRecentActivities(limit)

      // Get member and user data for each activity
      const activitiesWithDetails = await Promise.all(
        activities.map(async activity => {
          let member = null
          if (activity.memberId) {
            member = await storage.getMember(activity.memberId)
          }

          let user = null
          if (activity.userId) {
            user = await storage.getUser(activity.userId)
          }

          return {
            ...activity,
            member,
            user,
          }
        }),
      )

      res.json(activitiesWithDetails)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch recent activities'})
    }
  })

  // Members
  app.get('/api/members', async (req, res) => {
    try {
      const members = await storage.getMembers()

      // Get plan info for each member
      const membersWithPlan = await Promise.all(
        members.map(async member => {
          const plan = await storage.getMembershipPlan(member.planId)
          return {
            ...member,
            plan,
          }
        }),
      )

      res.json(membersWithPlan)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch members'})
    }
  })

  app.get('/api/members/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const member = await storage.getMember(id)

      if (!member) {
        return res.status(404).json({message: 'Member not found'})
      }

      // Get plan info
      const plan = await storage.getMembershipPlan(member.planId)

      // Get class bookings
      const bookings = await storage.getClassBookingsByMember(id)
      const bookingsWithClass = await Promise.all(
        bookings.map(async booking => {
          const gymClass = await storage.getClass(booking.classId)
          const trainer = gymClass
            ? await storage.getTrainer(gymClass.trainerId)
            : null

          return {
            ...booking,
            class: gymClass,
            trainer,
          }
        }),
      )

      // Get member activities
      const activities = await storage.getMemberActivities(id)

      res.json({
        ...member,
        plan,
        bookings: bookingsWithClass,
        activities,
      })
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch member details'})
    }
  })

  app.post('/api/members', async (req, res) => {
    try {
      const memberData = insertMemberSchema.parse(req.body)
      const member = await storage.createMember(memberData)
      res.status(201).json(member)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid member data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create member'})
    }
  })

  app.patch('/api/members/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const memberData = req.body

      const updatedMember = await storage.updateMember(id, memberData)
      if (!updatedMember) {
        return res.status(404).json({message: 'Member not found'})
      }

      res.json(updatedMember)
    } catch (error) {
      res.status(500).json({message: 'Failed to update member'})
    }
  })

  app.delete('/api/members/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const result = await storage.deleteMember(id)

      if (!result) {
        return res.status(404).json({message: 'Member not found'})
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({message: 'Failed to delete member'})
    }
  })

  // Ruta para obtener el perfil completo de un miembro con toda su información relacionada
  app.get('/api/members/:id/profile', async (req, res) => {
    try {
      const id = parseInt(req.params.id)

      // Obtener la información básica del miembro
      const member = await storage.getMember(id)
      if (!member) {
        return res.status(404).json({message: 'Miembro no encontrado'})
      }

      // Obtener el plan de membresía
      const plan = await storage.getMembershipPlan(member.planId)

      // Obtener historial de pagos
      const payments = await storage.getPaymentsByMember(id)

      // Obtener las reservas de clases
      const classBookings = await storage.getClassBookingsByMember(id)

      // Obtener información de las clases reservadas
      const classDetails = await Promise.all(
        classBookings.map(async booking => {
          const classInfo = await storage.getClass(booking.classId)
          const trainerInfo = classInfo
            ? await storage.getTrainer(classInfo.trainerId)
            : null

          return {
            ...booking,
            classInfo,
            trainerName: trainerInfo
              ? `${trainerInfo.firstName} ${trainerInfo.lastName}`
              : 'Desconocido',
          }
        }),
      )

      // Obtener actividades del miembro
      const activities = await storage.getMemberActivities(id)

      // Calcular estadísticas
      const attendedClasses = classBookings.filter(
        b => b.attendanceStatus === 'checked-in',
      ).length
      const missedClasses = classBookings.filter(
        b => b.attendanceStatus === 'no-show',
      ).length
      const totalBookings = classBookings.length
      const attendanceRate =
        totalBookings > 0 ? (attendedClasses / totalBookings) * 100 : 0

      const verifiedPayments = payments.filter(
        p => p.status === 'verified',
      ).length
      const pendingPayments = payments.filter(
        p => p.status === 'pending',
      ).length
      const totalPayments = payments.length

      // Enriquecer los datos de pagos con información del plan
      const enrichedPayments = await Promise.all(
        payments.map(async payment => {
          const paymentPlan = await storage.getMembershipPlan(payment.planId)
          return {
            ...payment,
            planName: paymentPlan ? paymentPlan.name : 'Plan desconocido',
          }
        }),
      )

      // Construir y devolver la respuesta completa
      res.json({
        member,
        plan,
        payments: enrichedPayments,
        classBookings: classDetails,
        activities,
        stats: {
          attendedClasses,
          missedClasses,
          totalBookings,
          attendanceRate: Math.round(attendanceRate),
          verifiedPayments,
          pendingPayments,
          totalPayments,
        },
      })
    } catch (error) {
      console.error('Error al obtener perfil completo del miembro:', error)
      res.status(500).json({message: 'Error al obtener perfil completo'})
    }
  })

  // Membership Plans
  app.get('/api/membership-plans', async (req, res) => {
    try {
      const plans = await storage.getMembershipPlans()
      res.json(plans)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch membership plans'})
    }
  })

  // Public membership plans - no authentication required
  app.get('/api/membership-plans/public', async (req, res) => {
    try {
      const plans = await storage.getMembershipPlans()
      // Only return active plans for public view
      const activePlans = plans.filter(plan => plan.isActive)
      res.json(activePlans)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch public membership plans'})
    }
  })

  app.get('/api/membership-plans/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const plan = await storage.getMembershipPlan(id)

      if (!plan) {
        return res.status(404).json({message: 'Membership plan not found'})
      }

      res.json(plan)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch membership plan'})
    }
  })

  app.post('/api/membership-plans', async (req, res) => {
    try {
      const planData = insertMembershipPlanSchema.parse(req.body)
      const plan = await storage.createMembershipPlan(planData)
      res.status(201).json(plan)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid plan data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create membership plan'})
    }
  })

  app.patch('/api/membership-plans/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const planData = req.body

      const updatedPlan = await storage.updateMembershipPlan(id, planData)
      if (!updatedPlan) {
        return res.status(404).json({message: 'Membership plan not found'})
      }

      res.json(updatedPlan)
    } catch (error) {
      res.status(500).json({message: 'Failed to update membership plan'})
    }
  })

  app.delete('/api/membership-plans/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const result = await storage.deleteMembershipPlan(id)

      if (!result) {
        return res.status(404).json({message: 'Membership plan not found'})
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({message: 'Failed to delete membership plan'})
    }
  })

  // Trainers
  app.get('/api/trainers', async (req, res) => {
    try {
      const trainers = await storage.getTrainers()
      res.json(trainers)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch trainers'})
    }
  })

  app.get('/api/trainers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const trainer = await storage.getTrainer(id)

      if (!trainer) {
        return res.status(404).json({message: 'Trainer not found'})
      }

      // Get trainer's classes
      const classes = await storage.getClasses()
      const trainerClasses = classes.filter(c => c.trainerId === id)

      res.json({
        ...trainer,
        classes: trainerClasses,
      })
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch trainer details'})
    }
  })

  app.post('/api/trainers', async (req, res) => {
    try {
      const trainerData = insertTrainerSchema.parse(req.body)
      const trainer = await storage.createTrainer(trainerData)
      res.status(201).json(trainer)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid trainer data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create trainer'})
    }
  })

  app.patch('/api/trainers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const trainerData = req.body

      const updatedTrainer = await storage.updateTrainer(id, trainerData)
      if (!updatedTrainer) {
        return res.status(404).json({message: 'Trainer not found'})
      }

      res.json(updatedTrainer)
    } catch (error) {
      res.status(500).json({message: 'Failed to update trainer'})
    }
  })

  app.delete('/api/trainers/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const result = await storage.deleteTrainer(id)

      if (!result) {
        return res.status(404).json({message: 'Trainer not found'})
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({message: 'Failed to delete trainer'})
    }
  })

  // Classes
  app.get('/api/classes', async (req, res) => {
    try {
      const classes = await storage.getClasses()

      // Get trainer info for each class
      const classesWithTrainer = await Promise.all(
        classes.map(async gymClass => {
          const trainer = await storage.getTrainer(gymClass.trainerId)
          return {
            ...gymClass,
            trainer,
          }
        }),
      )

      res.json(classesWithTrainer)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch classes'})
    }
  })

  app.get('/api/classes/today', async (req, res) => {
    try {
      const classes = await storage.getClasses()
      const today = new Date().toLocaleDateString('en-US', {weekday: 'long'})

      const todayClasses = classes.filter(
        c => c.daysOfWeek.includes(today) && c.isActive,
      )

      // Get trainer info and booking count for each class
      const classesWithDetails = await Promise.all(
        todayClasses.map(async gymClass => {
          const trainer = await storage.getTrainer(gymClass.trainerId)
          const bookings = await storage.getClassBookingsByClass(gymClass.id)
          const todayBookings = bookings.filter(b => {
            const bookingDate = new Date(b.bookingDate).toDateString()
            const today = new Date().toDateString()
            return bookingDate === today
          })

          return {
            ...gymClass,
            trainer,
            bookingsCount: todayBookings.length,
          }
        }),
      )

      res.json(classesWithDetails)
    } catch (error) {
      res.status(500).json({message: "Failed to fetch today's classes"})
    }
  })

  app.get('/api/classes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const gymClass = await storage.getClass(id)

      if (!gymClass) {
        return res.status(404).json({message: 'Class not found'})
      }

      // Get trainer info
      const trainer = await storage.getTrainer(gymClass.trainerId)

      // Get class bookings
      const bookings = await storage.getClassBookingsByClass(id)
      const bookingsWithMember = await Promise.all(
        bookings.map(async booking => {
          const member = await storage.getMember(booking.memberId)
          return {
            ...booking,
            member,
          }
        }),
      )

      res.json({
        ...gymClass,
        trainer,
        bookings: bookingsWithMember,
      })
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch class details'})
    }
  })

  app.post('/api/classes', async (req, res) => {
    try {
      const classData = insertClassSchema.parse(req.body)
      const gymClass = await storage.createClass(classData)
      res.status(201).json(gymClass)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid class data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create class'})
    }
  })

  app.patch('/api/classes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const classData = req.body

      const updatedClass = await storage.updateClass(id, classData)
      if (!updatedClass) {
        return res.status(404).json({message: 'Class not found'})
      }

      res.json(updatedClass)
    } catch (error) {
      res.status(500).json({message: 'Failed to update class'})
    }
  })

  app.delete('/api/classes/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const result = await storage.deleteClass(id)

      if (!result) {
        return res.status(404).json({message: 'Class not found'})
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({message: 'Failed to delete class'})
    }
  })

  // Class Bookings
  app.post('/api/class-bookings', async (req, res) => {
    try {
      const bookingData = insertClassBookingSchema.parse(req.body)
      const booking = await storage.createClassBooking(bookingData)
      res.status(201).json(booking)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid booking data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create class booking'})
    }
  })

  app.patch('/api/class-bookings/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const bookingData = req.body

      const updatedBooking = await storage.updateClassBooking(id, bookingData)
      if (!updatedBooking) {
        return res.status(404).json({message: 'Booking not found'})
      }

      res.json(updatedBooking)
    } catch (error) {
      res.status(500).json({message: 'Failed to update class booking'})
    }
  })

  app.delete('/api/class-bookings/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const result = await storage.deleteClassBooking(id)

      if (!result) {
        return res.status(404).json({message: 'Booking not found'})
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({message: 'Failed to delete class booking'})
    }
  })

  // Equipment
  app.get('/api/equipment', async (req, res) => {
    try {
      const equipment = await storage.getEquipment()
      res.json(equipment)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch equipment'})
    }
  })

  app.get('/api/equipment/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const item = await storage.getEquipmentItem(id)

      if (!item) {
        return res.status(404).json({message: 'Equipment not found'})
      }

      res.json(item)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch equipment details'})
    }
  })

  app.post('/api/equipment', async (req, res) => {
    try {
      const equipmentData = insertEquipmentSchema.parse(req.body)
      const equipment = await storage.createEquipment(equipmentData)
      res.status(201).json(equipment)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid equipment data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create equipment'})
    }
  })

  app.patch('/api/equipment/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const equipmentData = req.body

      const updatedEquipment = await storage.updateEquipment(id, equipmentData)
      if (!updatedEquipment) {
        return res.status(404).json({message: 'Equipment not found'})
      }

      res.json(updatedEquipment)
    } catch (error) {
      res.status(500).json({message: 'Failed to update equipment'})
    }
  })

  app.delete('/api/equipment/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const result = await storage.deleteEquipment(id)

      if (!result) {
        return res.status(404).json({message: 'Equipment not found'})
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({message: 'Failed to delete equipment'})
    }
  })

  // Announcements
  app.get('/api/announcements', async (req, res) => {
    try {
      const activeOnly = req.query.active === 'true'

      if (activeOnly) {
        const announcements = await storage.getActiveAnnouncements()
        return res.json(announcements)
      }

      const announcements = await storage.getAnnouncements()
      res.json(announcements)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch announcements'})
    }
  })

  // Public announcements - no authentication required
  app.get('/api/announcements/public', async (req, res) => {
    try {
      const announcements = await storage.getActiveAnnouncements()
      res.json(announcements)
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch public announcements'})
    }
  })

  app.get('/api/announcements/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const announcement = await storage.getAnnouncement(id)

      if (!announcement) {
        return res.status(404).json({message: 'Announcement not found'})
      }

      // Get creator info
      const creator = await storage.getUser(announcement.createdBy)

      res.json({
        ...announcement,
        creator,
      })
    } catch (error) {
      res.status(500).json({message: 'Failed to fetch announcement details'})
    }
  })

  app.post('/api/announcements', async (req, res) => {
    try {
      // Obtenemos los datos directamente de req.body
      const {
        title,
        content,
        category,
        publishDate,
        expiryDate,
        isActive,
        createdBy,
      } = req.body

      // Validamos campos obligatorios manualmente
      if (!title || !content || !category || !publishDate || !createdBy) {
        return res.status(400).json({message: 'Missing required fields'})
      }

      // Creamos el objeto con conversión explícita de fechas
      const announcementData = {
        title,
        content,
        category,
        publishDate: new Date(publishDate),
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        isActive: isActive !== undefined ? isActive : true,
        createdBy,
      }

      // Creamos el anuncio directamente
      const announcement = await storage.createAnnouncement(announcementData)
      res.status(201).json(announcement)
    } catch (error) {
      console.error('Error creating announcement:', error)
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid announcement data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create announcement'})
    }
  })

  app.patch('/api/announcements/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)

      // Modificamos el esquema para aceptar también strings en fechas
      const customAnnouncementSchema = z.object({
        title: z.string().optional(),
        content: z.string().optional(),
        category: z.string().optional(),
        publishDate: z
          .union([z.date(), z.string().transform(date => new Date(date))])
          .optional(),
        expiryDate: z
          .union([
            z.date(),
            z.string().transform(date => new Date(date)),
            z.null(),
          ])
          .optional(),
        isActive: z.boolean().optional(),
        createdBy: z.number().optional(),
      })

      // Parseamos los datos con el nuevo esquema
      const announcementData = customAnnouncementSchema.parse(req.body)

      const updatedAnnouncement = await storage.updateAnnouncement(
        id,
        announcementData,
      )
      if (!updatedAnnouncement) {
        return res.status(404).json({message: 'Announcement not found'})
      }

      res.json(updatedAnnouncement)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid announcement data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to update announcement'})
    }
  })

  app.delete('/api/announcements/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id)
      const result = await storage.deleteAnnouncement(id)

      if (!result) {
        return res.status(404).json({message: 'Announcement not found'})
      }

      res.status(204).send()
    } catch (error) {
      res.status(500).json({message: 'Failed to delete announcement'})
    }
  })

  // Activities
  app.post('/api/activities', async (req, res) => {
    try {
      const activityData = insertActivitySchema.parse(req.body)
      const activity = await storage.createActivity(activityData)
      res.status(201).json(activity)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json({message: 'Invalid activity data', errors: error.errors})
      }
      res.status(500).json({message: 'Failed to create activity'})
    }
  })

  // Reports
  app.get('/api/reports/member-stats', async (req, res) => {
    try {
      const members = await storage.getMembers()

      // Count members by status
      const membersByStatus = {
        active: members.filter(m => m.status === 'active').length,
        pending: members.filter(m => m.status === 'pending').length,
        expired: members.filter(m => m.status === 'expired').length,
        frozen: members.filter(m => m.status === 'frozen').length,
      }

      // Count members by plan
      const membersByPlan = {}
      for (const member of members) {
        if (member.status === 'active') {
          if (membersByPlan[member.planId]) {
            membersByPlan[member.planId]++
          } else {
            membersByPlan[member.planId] = 1
          }
        }
      }

      // Get plan details for the report
      const plans = await storage.getMembershipPlans()
      const planStats = plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        count: membersByPlan[plan.id] || 0,
      }))

      // Monthly new members (for the last 6 months)
      const monthlySignups: {
        month: string
        monthYear: string
        signups: number
      }[] = []
      const now = new Date()

      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthName = month.toLocaleDateString('en-US', {month: 'short'})
        const monthYear = month.toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })

        const startOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
        const endOfMonth = new Date(
          month.getFullYear(),
          month.getMonth() + 1,
          0,
        )

        const signups = members.filter(m => {
          const joinDate = new Date(m.joinDate)
          return joinDate >= startOfMonth && joinDate <= endOfMonth
        }).length

        monthlySignups.push({
          month: monthName,
          monthYear,
          signups,
        })
      }

      res.json({
        membersByStatus,
        planStats,
        monthlySignups,
        totalMembers: members.length,
      })
    } catch (error) {
      res.status(500).json({message: 'Failed to generate member statistics'})
    }
  })

  app.get('/api/reports/class-attendance', async (req, res) => {
    try {
      const classes = await storage.getClasses()
      const bookings = await storage.getClassBookings()

      // Group bookings by class
      const bookingsByClass = {}
      for (const booking of bookings) {
        if (bookingsByClass[booking.classId]) {
          bookingsByClass[booking.classId].push(booking)
        } else {
          bookingsByClass[booking.classId] = [booking]
        }
      }

      // Calculate stats for each class
      const classStats = await Promise.all(
        classes.map(async gymClass => {
          const classBookings = bookingsByClass[gymClass.id] || []
          const trainer = await storage.getTrainer(gymClass.trainerId)

          // Calculate attendance rate
          const attendanceCount = classBookings.filter(
            b => b.attendanceStatus === 'checked-in',
          ).length
          const totalBookings = classBookings.length
          const attendanceRate =
            totalBookings > 0 ? (attendanceCount / totalBookings) * 100 : 0

          return {
            id: gymClass.id,
            name: gymClass.name,
            trainerName: trainer
              ? `${trainer.firstName} ${trainer.lastName}`
              : 'Unknown',
            totalBookings,
            attendanceCount,
            attendanceRate: Math.round(attendanceRate),
            capacity: gymClass.capacity,
            fillRate: Math.round((totalBookings / gymClass.capacity) * 100),
          }
        }),
      )

      // Most popular classes
      const popularClasses = [...classStats]
        .sort((a, b) => b.fillRate - a.fillRate)
        .slice(0, 5)

      res.json({
        classStats,
        popularClasses,
      })
    } catch (error) {
      res
        .status(500)
        .json({message: 'Failed to generate class attendance report'})
    }
  })

  // Payment processing with Yape
  app.post('/api/yape-payment/verify', async (req, res) => {
    try {
      // En una implementación real, esto verificaría el pago con Yape
      // Por ahora, solo almacenamos la información y devolvemos éxito

      const {name, email, phone, planId, paymentProofImageUrl, memberData} =
        req.body

      // Se crearía un miembro pendiente y se registraría la actividad
      // En un escenario real, esto sería verificado manualmente por un administrador

      if (planId) {
        try {
          const plan = await storage.getMembershipPlan(parseInt(planId))
          if (!plan) {
            return res.status(404).json({error: 'Plan not found'})
          }

          // Primero verificamos si el usuario existe por email
          let member = await storage.getMemberByEmail(email)
          let memberId

          // Si no existe el miembro, lo creamos
          if (!member) {
            try {
              member = await storage.createMember({
                firstName: memberData.firstName,
                lastName: memberData.lastName,
                email,
                phone,
                planId: parseInt(planId),
                status: 'pending',
                joinDate: new Date().toISOString().split('T')[0],
              })
              console.log('Created new member:', member)
              memberId = member.id
            } catch (memberError) {
              console.error('Error creating member:', memberError)
              // Continuamos el proceso incluso si no se pudo crear el miembro
            }
          } else {
            memberId = member.id
          }

          // Creamos un registro de pago pendiente en la base de datos
          const payment = await storage.createPayment({
            amount: plan.price,
            memberId: memberId || 0, // Si no tenemos miembro, usamos 0 como temporal
            planId: parseInt(planId),
            paymentMethod: 'Yape',
            status: 'pending',
            paymentDate: new Date(),
            receiptUrl: paymentProofImageUrl
              ? paymentProofImageUrl.substring(0, 255)
              : null, // Limitamos la URL para la base de datos
            notes: `Pago pendiente de verificación por ${name} (${email})`,
          })

          // Record activity
          await storage.createActivity({
            description: `New Yape payment received for ${plan.name} plan - pending verification`,
            activityType: 'yape_payment_received',
            timestamp: new Date(),
            memberId: memberId || null,
            userId: null,
          })

          // Return success with a reference number
          const referenceNumber = 'YAPE' + Date.now().toString().substring(5)

          res.status(201).json({
            success: true,
            message: 'Tu pago está pendiente de verificación',
            referenceNumber,
            paymentId: payment.id,
          })
        } catch (error) {
          console.error('Error processing payment:', error)
          res.status(500).json({error: 'Error al procesar el pago'})
        }
      } else {
        res.status(400).json({error: 'Se requiere un plan de membresía válido'})
      }
    } catch (error) {
      console.error('Error processing Yape payment:', error)
      res.status(500).json({error: 'Error al procesar el pago'})
    }
  })

  const httpServer = createServer(app)
  // API para pagos
  app.get('/api/payments', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const payments = await storage.getPayments()

      // Obtenemos información de miembros y planes para enriquecer la respuesta
      const enrichedPayments = await Promise.all(
        payments.map(async payment => {
          const member = await storage.getMember(payment.memberId)
          const plan = await storage.getMembershipPlan(payment.planId)

          return {
            ...payment,
            memberName: member
              ? `${member.firstName} ${member.lastName}`
              : 'Desconocido',
            planName: plan ? plan.name : 'Plan desconocido',
          }
        }),
      )

      res.json(enrichedPayments)
    } catch (error) {
      console.error('Error al obtener pagos:', error)
      res.status(500).json({message: 'Error interno del servidor'})
    }
  })

  app.get(
    '/api/payments/pending',
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const payments = await storage.getPendingPayments()

        // Obtenemos información de miembros y planes para enriquecer la respuesta
        const enrichedPayments = await Promise.all(
          payments.map(async payment => {
            const member = await storage.getMember(payment.memberId)
            const plan = await storage.getMembershipPlan(payment.planId)

            return {
              ...payment,
              memberName: member
                ? `${member.firstName} ${member.lastName}`
                : 'Desconocido',
              planName: plan ? plan.name : 'Plan desconocido',
            }
          }),
        )

        res.json(enrichedPayments)
      } catch (error) {
        console.error('Error al obtener pagos pendientes:', error)
        res.status(500).json({message: 'Error interno del servidor'})
      }
    },
  )

  app.get('/api/payments/member/:id', isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.id)
      const payments = await storage.getPaymentsByMember(memberId)

      // Obtenemos información del plan para enriquecer la respuesta
      const enrichedPayments = await Promise.all(
        payments.map(async payment => {
          const plan = await storage.getMembershipPlan(payment.planId)

          return {
            ...payment,
            planName: plan ? plan.name : 'Plan desconocido',
          }
        }),
      )

      res.json(enrichedPayments)
    } catch (error) {
      console.error('Error al obtener pagos de miembro:', error)
      res.status(500).json({message: 'Error interno del servidor'})
    }
  })

  app.post('/api/payments', isAuthenticated, async (req, res) => {
    try {
      const paymentData = req.body

      // Validar datos del pago
      if (
        !paymentData.memberId ||
        !paymentData.planId ||
        !paymentData.amount ||
        !paymentData.paymentMethod
      ) {
        return res.status(400).json({message: 'Datos de pago incompletos'})
      }

      // La fecha de pago siempre es ahora
      const paymentDate = new Date()

      // Crear registro de pago - ahora el método createPayment manejará el estado
      // y actualizará automáticamente la membresía
      const payment = await storage.createPayment({
        ...paymentData,
        paymentDate,
      })

      res.status(201).json(payment)
    } catch (error) {
      console.error('Error al crear pago:', error)
      res.status(500).json({message: 'Error interno del servidor'})
    }
  })

  app.post(
    '/api/payments/:id/verify',
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const paymentId = parseInt(req.params.id)
        const adminId = req.user.id

        // Verificar pago - este método ya actualiza el estado de la membresía y registra la actividad
        const payment = await storage.verifyPayment(paymentId, adminId)

        if (!payment) {
          return res.status(404).json({message: 'Pago no encontrado'})
        }

        res.json(payment)
      } catch (error) {
        console.error('Error al verificar pago:', error)
        res.status(500).json({message: 'Error interno del servidor'})
      }
    },
  )

  app.post(
    '/api/payments/:id/reject',
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const paymentId = parseInt(req.params.id)
        const adminId = req.user.id
        const {notes} = req.body

        // Rechazar pago
        const payment = await storage.rejectPayment(paymentId, adminId, notes)

        if (!payment) {
          return res.status(404).json({message: 'Pago no encontrado'})
        }

        res.json(payment)
      } catch (error) {
        console.error('Error al rechazar pago:', error)
        res.status(500).json({message: 'Error interno del servidor'})
      }
    },
  )

  // Ruta especial para promover a un usuario a administrador
  // Esta ruta no debería existir en un entorno de producción o debería estar mucho más protegida
  app.post('/api/make-admin/:username', async (req, res) => {
    try {
      const username = req.params.username

      // Buscar el usuario por nombre de usuario
      const user = await storage.getUserByUsername(username)

      if (!user) {
        return res.status(404).json({message: 'Usuario no encontrado'})
      }

      // Actualizar el rol del usuario a 'admin'
      const updatedUser = await storage.updateUser(user.id, {role: 'admin'})

      // Registrar actividad
      await storage.createActivity({
        description: `Usuario ${username} promovido a administrador`,
        activityType: 'admin_action',
        timestamp: new Date(),
      })

      res.status(200).json({
        message: `Usuario ${username} ahora es administrador`,
        user: updatedUser,
      })
    } catch (error) {
      console.error('Error al promover usuario:', error)
      res.status(500).json({message: 'Error interno del servidor'})
    }
  })

  // Endpoint para que cualquier usuario consulte sus pagos pendientes por email
  app.get('/api/user/pending-payments', async (req, res) => {
    try {
      // Si el usuario está autenticado, obtener sus pagos
      if (req.isAuthenticated() && req.user) {
        // Encontrar miembro asociado al usuario por email
        const member = await storage.getMemberByEmail(req.user.email)

        if (member) {
          const payments = await storage.getPaymentsByMember(member.id)
          const pendingPayments = payments.filter(p => p.status === 'pending')

          // Obtener información del plan para cada pago
          const enriched = await Promise.all(
            pendingPayments.map(async payment => {
              const plan = await storage.getMembershipPlan(payment.planId)
              return {
                ...payment,
                planName: plan ? plan.name : 'Plan desconocido',
              }
            }),
          )

          return res.json(enriched)
        }

        return res.json([])
      }

      // Para usuarios no autenticados, permitir buscar por email opcional (query param)
      const email = req.query.email as string
      if (email) {
        // Intentar encontrar un miembro por email
        const member = await storage.getMemberByEmail(email)

        if (member) {
          const payments = await storage.getPaymentsByMember(member.id)
          const pendingPayments = payments.filter(p => p.status === 'pending')

          // Obtener información del plan para cada pago
          const enriched = await Promise.all(
            pendingPayments.map(async payment => {
              const plan = await storage.getMembershipPlan(payment.planId)
              return {
                ...payment,
                planName: plan ? plan.name : 'Plan desconocido',
              }
            }),
          )

          return res.json(enriched)
        }
      }

      // Si no hay email o no se encuentra el miembro, devolver array vacío
      return res.json([])
    } catch (error) {
      console.error('Error al obtener pagos pendientes del usuario:', error)
      res.status(500).json({message: 'Error interno del servidor'})
    }
  })

  return httpServer
}
