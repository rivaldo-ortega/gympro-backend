import passport from 'passport'
import {Strategy as LocalStrategy} from 'passport-local'
import {Express, NextFunction, Request, Response} from 'express'
import session from 'express-session'
import {scrypt, randomBytes, timingSafeEqual} from 'crypto'
import {promisify} from 'util'
import {storage} from './storage'
import {User as SelectUser} from './schema' // Adjusted the path to match the likely location

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt)

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const buf = (await scryptAsync(password, salt, 64)) as Buffer
  return `${buf.toString('hex')}.${salt}`
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split('.')
  const hashedBuf = Buffer.from(hashed, 'hex')
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer
  return timingSafeEqual(hashedBuf, suppliedBuf)
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret:
      process.env.SESSION_SECRET || 'gymadmin-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
    },
    store: storage.sessionStore,
  }

  app.use(session(sessionSettings))
  app.use(passport.initialize())
  app.use(passport.session())

  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        const user = await storage.getUserByUsername(username)
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false)
        } else {
          return done(null, user)
        }
      } catch (error) {
        return done(error)
      }
    }),
  )

  passport.serializeUser<number>((user, done) => {
    done(null, user.id)
  })

  passport.deserializeUser<number>(async (id, done) => {
    try {
      const user = await storage.getUser(id)
      done(null, user)
    } catch (error) {
      done(error)
    }
  })

  app.post('/api/register', async (req: Request, res: Response) => {
    try {
      const existingUser = await storage.getUserByUsername(req.body.username)
      if (existingUser) {
        return res.status(400).json({message: 'El nombre de usuario ya existe'})
      }

      // Hash de la contraseña
      const hashedPassword = await hashPassword(req.body.password)

      // Crear el usuario con la contraseña hasheada
      // Asegurarnos de que el rol sea 'user' a menos que se especifique 'admin' explícitamente por un admin existente
      // Por ahora asignamos el rol 'user' como predeterminado para los registros públicos
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        role: 'user', // Asignamos explícitamente el rol 'user' a los nuevos registros
      })

      // Inicio de sesión automático después del registro
      req.login(user, err => {
        if (err) {
          return res
            .status(500)
            .json({message: 'Error al iniciar sesión automáticamente'})
        }
        // Devolver el usuario sin la contraseña
        const {password, ...userWithoutPassword} = user
        res.status(201).json(userWithoutPassword)
      })
    } catch (error) {
      console.error('Error en el registro:', error)
      res.status(500).json({message: 'Error en el registro'})
    }
  })

  app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err: Error, user: SelectUser) => {
      if (err) {
        return next(err)
      }
      if (!user) {
        return res.status(401).json({message: 'Credenciales inválidas'})
      }
      req.login(user, err => {
        if (err) {
          return next(err)
        }
        // Devolver el usuario sin la contraseña
        const {password, ...userWithoutPassword} = user
        return res.status(200).json(userWithoutPassword)
      })
    })(req, res, next)
  })

  app.post('/api/logout', (req, res) => {
    req.logout(err => {
      if (err) {
        return res.status(500).json({message: 'Error al cerrar sesión'})
      }
      res.status(200).json({message: 'Sesión cerrada correctamente'})
    })
  })

  app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({message: 'No autenticado'})
    }
    // Devolver el usuario sin la contraseña
    const {password, ...userWithoutPassword} = req.user as SelectUser
    res.json(userWithoutPassword)
  })
}

export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.isAuthenticated()) {
    return next()
  }
  res.status(401).json({message: 'No autorizado'})
}

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && (req.user as SelectUser).role === 'admin') {
    return next()
  }
  res.status(403).json({message: 'Acceso prohibido'})
}
