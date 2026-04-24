import mongoose from 'mongoose';
import mysql from 'mysql2/promise';
import { Contact } from './models/Contact';
import { Conversation } from './models/Conversation';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wab';

async function importContacts() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected.');

  console.log('Connecting to MySQL...');
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'wabuser',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'visadcouk_dataf',
  });
  console.log('MySQL connected.');

  // Fetch all travelers with phone numbers
  const [rows] = await pool.execute(
    `SELECT id, name, first_name, last_name, whatsapp_contact, status, travel_country, visa_center
     FROM travelers
     WHERE whatsapp_contact IS NOT NULL AND whatsapp_contact != ''
     ORDER BY id DESC`
  );
  const travelers = rows as any[];
  console.log(`Found ${travelers.length} travelers with phone numbers.`);

  let created = 0;
  let skipped = 0;

  for (const t of travelers) {
    const rawPhone = t.whatsapp_contact.replace(/[\s\-\(\)]/g, '');
    if (rawPhone.length < 7) {
      skipped++;
      continue;
    }

    // Last 10 digits as main identifier
    const last10 = rawPhone.slice(-10);

    // Build waId: if number starts with country code (10+ digits), use as-is
    // Otherwise prepend 44 (UK default)
    let waId: string;
    let phoneNumber: string;
    const cleanDigits = rawPhone.replace(/\+/g, '');

    if (cleanDigits.length > 10) {
      // Already has country code
      waId = cleanDigits;
      phoneNumber = `+${cleanDigits}`;
    } else {
      // Add +44 default
      waId = `44${cleanDigits}`;
      phoneNumber = `+44${cleanDigits}`;
    }

    // Check if contact already exists by last 10 digits
    const existing = await Contact.findOne({
      $or: [
        { waId: waId },
        { waId: { $regex: `${last10}$` } },
      ]
    });

    if (existing) {
      // Update name if SQL has a better name
      const sqlName = t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim();
      if (sqlName && sqlName !== 'New Traveler' && !existing.name) {
        existing.name = sqlName;
        existing.profileName = sqlName;
        await existing.save();
      }
      skipped++;
      continue;
    }

    // Create contact
    const sqlName = t.name || `${t.first_name || ''} ${t.last_name || ''}`.trim();
    const contact = await Contact.create({
      waId,
      phoneNumber,
      name: sqlName && sqlName !== 'New Traveler' ? sqlName : undefined,
      profileName: sqlName && sqlName !== 'New Traveler' ? sqlName : undefined,
      tags: t.status ? [t.status] : [],
    });

    // Create conversation
    await Conversation.create({
      contact: contact._id,
      status: 'open',
      unreadCount: 0,
      tags: t.status ? [t.status] : [],
    });

    created++;
    if (created % 50 === 0) {
      console.log(`  Created ${created} contacts...`);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Created: ${created}`);
  console.log(`  Skipped (existing or invalid): ${skipped}`);

  await pool.end();
  await mongoose.disconnect();
}

importContacts().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
