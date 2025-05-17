/* import { db } from "./db";
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { members } from "./schema";

cron.schedule("0 0 * * *", async () => {
  console.log("Members status updated", new Date().toISOString());

  await db.execute(
    sql`UPDATE ${members}
        SET status = CASE
          WHEN expiry_date IS NULL THEN 'expired
          WHEN expiry_date > CURRENT_DATE + INTERVAL '3 days' THEN 'active'
          WHEN expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days' THEN 'about-expire'
          ELSE 'expired'
        END`,
  );
});
 */
