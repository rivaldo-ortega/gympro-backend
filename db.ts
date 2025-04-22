import * as schema from './schema'
import * as dotenv from 'dotenv'
dotenv.config()

import {Pool, neonConfig} from '@neondatabase/serverless'
import ws from 'ws'
import {drizzle} from 'drizzle-orm/neon-serverless'

neonConfig.webSocketConstructor = ws

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
export const db = drizzle({client: pool, schema})
