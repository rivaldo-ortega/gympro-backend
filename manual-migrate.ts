import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import ws from 'ws';

// Configuración necesaria para WebSocket en Neon
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
  console.log('Iniciando migración manual...');
  
  try {
    // Actualizar esquema para miembros
    await db.execute(sql`
      ALTER TABLE "members" 
      ALTER COLUMN "plan_id" DROP NOT NULL,
      ALTER COLUMN "status" DROP NOT NULL,
      ALTER COLUMN "status" SET DEFAULT 'inactive'
    `);
    
    console.log('Migración completada exitosamente');
  } catch (error) {
    console.error('Error durante la migración:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Error fatal durante la migración:', error);
  process.exit(1);
});