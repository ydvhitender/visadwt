import { Router, Request, Response } from 'express';
import { execSync, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const router = Router();
const BACKUPS_DIR = path.join(__dirname, '../../backups');

if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// All backup routes require admin auth
router.use(authMiddleware);

// List available backups
router.get('/', (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  try {
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => f.endsWith('.tar.gz'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          filename: f,
          size: stat.size,
          sizeHuman: formatBytes(stat.size),
          createdAt: stat.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({ backups: files });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new backup
router.post('/create', async (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `wab-backup-${timestamp}`;
    const backupDir = path.join(BACKUPS_DIR, backupName);
    fs.mkdirSync(backupDir, { recursive: true });

    const steps: string[] = [];

    // 1. MongoDB dump
    try {
      const mongoUri = env.MONGODB_URI;
      const mongoDumpDir = path.join(backupDir, 'mongodb');
      fs.mkdirSync(mongoDumpDir, { recursive: true });
      execSync(`mongodump --uri="${mongoUri}" --out="${mongoDumpDir}" 2>&1`, { timeout: 120000 });
      steps.push('MongoDB dump: OK');
    } catch (e: any) {
      steps.push(`MongoDB dump: FAILED - ${e.message}`);
      logger.error('MongoDB backup failed:', e.message);
    }

    // 2. MySQL dump
    try {
      const mysqlDumpFile = path.join(backupDir, 'mysql-dump.sql');
      const mysqlHost = process.env.MYSQL_HOST || 'localhost';
      const mysqlUser = process.env.MYSQL_USER || 'wabuser';
      const mysqlPass = process.env.MYSQL_PASSWORD || '';
      const mysqlDb = process.env.MYSQL_DATABASE || 'visadcouk_dataf';
      execSync(
        `mysqldump -h "${mysqlHost}" -u "${mysqlUser}" -p"${mysqlPass}" "${mysqlDb}" > "${mysqlDumpFile}" 2>&1`,
        { timeout: 120000 }
      );
      steps.push('MySQL dump: OK');
    } catch (e: any) {
      steps.push(`MySQL dump: FAILED - ${e.message}`);
      logger.error('MySQL backup failed:', e.message);
    }

    // 3. Copy application code (excluding node_modules, .git, backups, dist, logs)
    try {
      const projectRoot = path.resolve(__dirname, '../../..');
      const codeDir = path.join(backupDir, 'code');
      fs.mkdirSync(codeDir, { recursive: true });
      execSync(
        `rsync -a --exclude="node_modules" --exclude=".git" --exclude="backups" --exclude="dist" --exclude="logs" --exclude="server/uploads" "${projectRoot}/" "${codeDir}/"`,
        { timeout: 120000 }
      );
      steps.push('Application code: OK');
    } catch (e: any) {
      steps.push(`Application code: FAILED - ${e.message}`);
      logger.error('Code backup failed:', e.message);
    }

    // 4. Copy uploads
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (fs.existsSync(uploadsDir)) {
      const uploadsBackup = path.join(backupDir, 'uploads');
      execSync(`cp -r "${uploadsDir}" "${uploadsBackup}"`);
      steps.push('Uploads: OK');
    } else {
      steps.push('Uploads: skipped (no uploads directory)');
    }

    // 5. Copy .env
    const envFile = path.resolve(__dirname, '../../../.env');
    if (fs.existsSync(envFile)) {
      fs.copyFileSync(envFile, path.join(backupDir, '.env'));
      steps.push('.env: OK');
    }

    // 6. Copy frontend .env
    const frontendEnv = path.resolve(__dirname, '../../../chatclone-react/.env');
    if (fs.existsSync(frontendEnv)) {
      fs.copyFileSync(frontendEnv, path.join(backupDir, 'chatclone-react.env'));
      steps.push('Frontend .env: OK');
    }

    // 7. Generate restore instructions
    const restoreInstructions = `# WAB Backup Restore Instructions
# Generated: ${new Date().toISOString()}
# Server: wt.visaway.co.uk

## What's included
- code/          — Full application source code
- mongodb/       — MongoDB database dump
- mysql-dump.sql — MySQL database dump
- uploads/       — Media files and avatars
- .env           — Server environment config
- chatclone-react.env — Frontend environment config
- nginx.conf     — Nginx configuration
- ecosystem.config.cjs — PM2 process config

## Prerequisites
- Node.js 18+
- MongoDB 6+
- MySQL 8+
- Nginx
- PM2 (npm i -g pm2)

## Steps to restore on a new server:

### 1. Copy application code
cp -r code/ /home/ubuntu/WAB
cd /home/ubuntu/WAB

### 2. Restore environment files
cp .env /home/ubuntu/WAB/.env
cp chatclone-react.env /home/ubuntu/WAB/chatclone-react/.env
# Edit .env to update:
#   - MONGODB_URI (if different host)
#   - MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD
#   - CLIENT_URL (new domain)
#   - WA_WEBHOOK_VERIFY_TOKEN
#   - JWT_SECRET

### 3. Restore MongoDB
mongorestore --uri="mongodb://localhost:27017" mongodb/

### 4. Restore MySQL
mysql -u <user> -p <database> < mysql-dump.sql

### 5. Restore uploads
cp -r uploads/ /home/ubuntu/WAB/server/uploads/

### 6. Install dependencies and build
cd /home/ubuntu/WAB
npm install
npm run build

### 7. Configure Nginx
# Copy and edit nginx.conf with your new domain
sudo cp nginx.conf /etc/nginx/sites-available/wab
sudo ln -s /etc/nginx/sites-available/wab /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

### 8. Set up SSL (Let's Encrypt)
sudo certbot --nginx -d your-new-domain.com

### 9. Start with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

### 10. Update WhatsApp webhook URL
# Go to Meta Developer Console > WhatsApp > Configuration
# Update the webhook URL to: https://your-new-domain.com/api/webhook
`;
    fs.writeFileSync(path.join(backupDir, 'RESTORE.md'), restoreInstructions);

    // 8. Copy nginx config
    const nginxConf = path.resolve(__dirname, '../../../nginx.conf');
    if (fs.existsSync(nginxConf)) {
      fs.copyFileSync(nginxConf, path.join(backupDir, 'nginx.conf'));
    }

    // 9. Copy ecosystem config
    const ecosystemConf = path.resolve(__dirname, '../../../ecosystem.config.cjs');
    if (fs.existsSync(ecosystemConf)) {
      fs.copyFileSync(ecosystemConf, path.join(backupDir, 'ecosystem.config.cjs'));
    }

    // 10. Create tar.gz archive
    const archiveName = `${backupName}.tar.gz`;
    const archivePath = path.join(BACKUPS_DIR, archiveName);
    execSync(`tar -czf "${archivePath}" -C "${BACKUPS_DIR}" "${backupName}"`, { timeout: 300000 });

    // Clean up the uncompressed directory
    execSync(`rm -rf "${backupDir}"`);

    const stat = fs.statSync(archivePath);

    logger.info(`Backup created: ${archiveName} (${formatBytes(stat.size)})`);

    res.json({
      success: true,
      filename: archiveName,
      size: stat.size,
      sizeHuman: formatBytes(stat.size),
      steps,
      downloadUrl: `/api/backup/download/${archiveName}`,
    });
  } catch (error: any) {
    logger.error('Backup creation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download a backup
router.get('/download/:filename', (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const filename = req.params.filename as string;
  if (!filename.endsWith('.tar.gz') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(BACKUPS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });

  res.set('Content-Type', 'application/gzip');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(filePath);
});

// Delete a backup
router.delete('/:filename', (req: AuthRequest, res: Response) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });

  const filename = req.params.filename as string;
  if (!filename.endsWith('.tar.gz') || filename.includes('..')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.join(BACKUPS_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Backup not found' });

  fs.unlinkSync(filePath);
  res.json({ success: true });
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default router;
