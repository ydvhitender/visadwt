import { Router, Request, Response } from 'express';
import { getMysqlPool } from '../config/mysql';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
router.use(authMiddleware);

// Get distinct statuses for filter pills
router.get('/statuses', async (_req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.execute(
      `SELECT status, COUNT(*) as count FROM travelers WHERE status IS NOT NULL AND status != '' GROUP BY status ORDER BY count DESC`
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Search travelers by phone number or name
router.get('/travelers/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }
    const pool = getMysqlPool();
    const term = `%${q}%`;
    const [rows] = await pool.execute(
      `SELECT id, name, first_name, last_name, whatsapp_contact, travel_country,
              visa_type, status, package, passport_no, email, dob, nationality
       FROM travelers
       WHERE name LIKE ? OR first_name LIKE ? OR last_name LIKE ?
             OR whatsapp_contact LIKE ? OR passport_no LIKE ? OR email LIKE ?
       ORDER BY id DESC LIMIT 50`,
      [term, term, term, term, term, term]
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get traveler by phone number (for linking with WhatsApp contact)
router.get('/travelers/by-phone/:phone', async (req: Request, res: Response) => {
  try {
    const phone = req.params.phone as string;
    const pool = getMysqlPool();
    // Try matching with and without country code
    const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
    const [rows] = await pool.execute(
      `SELECT * FROM travelers
       WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(whatsapp_contact, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') LIKE ?
       ORDER BY id DESC`,
      [`%${cleanPhone.slice(-10)}%`]
    );
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single traveler by ID
router.get('/travelers/:id', async (req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.execute('SELECT * FROM travelers WHERE id = ?', [req.params.id]);
    const data = rows as any[];
    if (data.length === 0) return res.status(404).json({ error: 'Traveler not found' });
    res.json(data[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List travelers with pagination
router.get('/travelers', async (req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let where = '';
    const params: any[] = [];
    if (status) {
      where = 'WHERE status = ?';
      params.push(status);
    }

    const [rows] = await pool.execute(
      `SELECT id, name, first_name, last_name, whatsapp_contact, travel_country,
              visa_type, status, package, passport_no, email, nationality, doc_date
       FROM travelers ${where}
       ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM travelers ${where}`,
      params
    );
    res.json({ travelers: rows, total: (countResult as any[])[0].total, page, limit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get dependents for a traveler
router.get('/travelers/:id/dependents', async (req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.execute('SELECT * FROM dependents WHERE traveler_id = ?', [req.params.id]);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get documents for a traveler
router.get('/travelers/:id/documents', async (req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.execute('SELECT * FROM documents WHERE traveler_id = ?', [req.params.id]);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get invoices for a traveler
router.get('/travelers/:id/invoices', async (req: Request, res: Response) => {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.execute('SELECT * FROM invoices WHERE traveler_id = ?', [req.params.id]);
    res.json(rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
