import { Request, Response } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { env } from '../config/env';
import { getMysqlPool } from '../config/mysql';
import { logger } from '../utils/logger';

function generateToken(user: { _id: any; email: string; role: string }) {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as any };
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    env.JWT_SECRET,
    options
  );
}

// Map SQL roles to MongoDB roles
function mapSqlRole(sqlRole: string): 'admin' | 'agent' {
  const adminRoles = ['SUPERADMIN', 'ADMIN', 'MANAGER'];
  return adminRoles.includes(sqlRole) ? 'admin' : 'agent';
}

// Try to authenticate against SQL users table
async function authenticateFromSql(identifier: string, password: string) {
  try {
    const pool = getMysqlPool();
    const [rows] = await pool.execute(
      'SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1',
      [identifier]
    );
    const users = rows as any[];
    if (users.length === 0) return null;

    const sqlUser = users[0];
    const isMatch = await bcrypt.compare(password, sqlUser.password);
    if (!isMatch) return null;

    // Sync to MongoDB — create or update a corresponding user record
    const syntheticEmail = `${sqlUser.username}@sql.local`;
    let mongoUser = await User.findOne({ email: syntheticEmail });
    if (!mongoUser) {
      // Create a MongoDB user with a random password (never used for login)
      const randomPwd = await bcrypt.hash(`sql_${Date.now()}_${Math.random()}`, 12);
      mongoUser = await User.create({
        email: syntheticEmail,
        password: randomPwd,
        name: sqlUser.username,
        role: mapSqlRole(sqlUser.role),
      });
    } else {
      // Update role if changed in SQL
      const newRole = mapSqlRole(sqlUser.role);
      if (mongoUser.role !== newRole) {
        mongoUser.role = newRole;
        await mongoUser.save();
      }
    }

    // Update last_seen in SQL
    try {
      await pool.execute('UPDATE users SET last_seen = NOW() WHERE id = ?', [sqlUser.id]);
    } catch {}

    return mongoUser;
  } catch (err) {
    logger.warn('SQL auth failed:', err);
    return null;
  }
}

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { email, password, name, role } = req.body;
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ error: 'Email already registered' });
      }
      const user = await User.create({ email, password, name, role: role || 'agent' });
      const token = generateToken(user);
      res.status(201).json({
        token,
        user: { id: user._id, email: user.email, name: user.name, role: user.role },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email/username and password are required' });
      }

      // 1. Try MongoDB user by email
      let user = await User.findOne({ email }).select('+password');
      if (user) {
        const isMatch = await user.comparePassword(password);
        if (isMatch) {
          user.isOnline = true;
          await user.save();
          const token = generateToken(user);
          return res.json({
            token,
            user: { id: user._id, email: user.email, name: user.name, role: user.role },
          });
        }
      }

      // 2. Try SQL user by username (identifier can be username)
      const sqlUser = await authenticateFromSql(email, password);
      if (sqlUser) {
        sqlUser.isOnline = true;
        await sqlUser.save();
        const token = generateToken(sqlUser);
        return res.json({
          token,
          user: { id: sqlUser._id, email: sqlUser.email, name: sqlUser.name, role: sqlUser.role },
        });
      }

      return res.status(401).json({ error: 'Invalid credentials' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },

  async me(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json({
        user: {
          id: user._id, email: user.email, name: user.name, role: user.role,
          isOnline: user.isOnline, avatar: user.avatar,
          waPhoneNumberId: env.WA_PHONE_NUMBER_ID,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
};
