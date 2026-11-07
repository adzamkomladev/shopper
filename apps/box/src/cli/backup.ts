import { backupBox } from "../backup";

// The backup timer's entry (deploy/systemd/backup.service); a separate file, so the box's own bundle never runs it.
const env = process.env;
if (!env.DATABASE_URL || !env.SHOPPER_BACKUP_RECIPIENT || !env.SHOPPER_BACKUP_REMOTE)
  throw new Error("DATABASE_URL, SHOPPER_BACKUP_RECIPIENT and SHOPPER_BACKUP_REMOTE are required");
const report = await backupBox({
  databaseUrl: env.DATABASE_URL,
  recipient: env.SHOPPER_BACKUP_RECIPIENT,
  remote: env.SHOPPER_BACKUP_REMOTE,
  workDir: env.SHOPPER_BACKUP_DIR ?? ".shopper/backups",
});
console.log(
  JSON.stringify({
    event: "backup.uploaded",
    file: report.file,
    tables: Object.keys(report.counts).length,
  }),
);
