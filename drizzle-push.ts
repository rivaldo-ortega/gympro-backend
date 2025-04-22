import {drizzle} from 'drizzle-orm/neon-serverless'
import {migrate} from 'drizzle-orm/neon-serverless/migrator'
import {Pool} from '@neondatabase/serverless'
import * as schema from './schema' // Adjusted path to match the correct location

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
const db = drizzle(pool, {schema})

async function main() {
  console.log('Running migrations...')
  await migrate(db, {migrationsFolder: 'drizzle'})
  console.log('Migrations complete!')
  process.exit(0)
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
