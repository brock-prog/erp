// server/src/routes/users.ts — User management (admin only)

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db';
import { requireRole } from '../middleware/rbac';

export const usersRouter = Router();

const safeUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  department: u.department,
  avatarInitials: u.avatarInitials,
  phone: u.phone,
  active: u.active,
  lastLogin: u.lastLogin?.toISOString?.() ?? u.lastLogin,
  createdAt: u.createdAt?.toISOString?.() ?? u.createdAt,
});

// GET /api/users — list all users (manager+)
usersRouter.get('/', requireRole('manager'), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    res.json(users.map(safeUser));
  } catch {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST /api/users — create user (admin only)
const CreateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'manager', 'operator', 'sales', 'viewer']),
  department: z.string().default(''),
  phone: z.string().optional(),
});

usersRouter.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  const parse = CreateUserSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid request', details: parse.error.errors });
    return;
  }

  const { name, email, password, role, department, phone } = parse.data;
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash, role, department, phone, avatarInitials: initials },
  });

  res.status(201).json(safeUser(user));
});

// PUT /api/users/:id — update user (admin only)
const UpdateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  role: z.enum(['admin', 'manager', 'operator', 'sales', 'viewer']).optional(),
  department: z.string().optional(),
  phone: z.string().optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

usersRouter.put('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  const parse = UpdateUserSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: 'Invalid request', details: parse.error.errors });
    return;
  }

  const { password, ...rest } = parse.data;
  const data: any = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 12);
  if (rest.name) data.avatarInitials = rest.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);

  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json(safeUser(user));
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});

// DELETE /api/users/:id — deactivate user (admin only, can't delete self)
usersRouter.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  if (req.params.id === req.user!.userId) {
    res.status(400).json({ error: 'Cannot deactivate your own account' });
    return;
  }
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { active: false } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'User not found' });
  }
});
