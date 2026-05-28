import cron from 'node-cron';
import { prisma } from '../config/db';
import { env } from '../config/env';

// Run every hour to delete old messages
export const startCronJobs = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Running message auto-delete job...');
    try {
      const retentionHours = env.MESSAGE_RETENTION_HOURS;
      const cutoffDate = new Date(Date.now() - retentionHours * 60 * 60 * 1000);

      // We implement a Soft Delete for messages older than retentionHours
      // But we can also do a Hard Delete. Let's do Soft Delete, then hard delete anything older than 7 days.
      
      const softDeleteResult = await prisma.message.updateMany({
        where: {
          created_at: { lt: cutoffDate },
          is_deleted: false
        },
        data: {
          is_deleted: true,
          content: 'This message was auto-deleted.'
        }
      });

      console.log(`[Cron] Soft deleted ${softDeleteResult.count} messages older than ${retentionHours} hours.`);

      // Hard delete messages older than 7 days
      const hardDeleteCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const hardDeleteResult = await prisma.message.deleteMany({
        where: {
          created_at: { lt: hardDeleteCutoff }
        }
      });

      console.log(`[Cron] Hard deleted ${hardDeleteResult.count} old messages.`);
    } catch (error) {
      console.error('[Cron] Error during auto-delete job:', error);
    }
  });
  
  console.log('[Cron] Auto-delete cron job scheduled.');
};
