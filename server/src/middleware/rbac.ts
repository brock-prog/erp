// server/src/middleware/rbac.ts — Role-Based Access Control

import { Request, Response, NextFunction } from 'express';

type Role = 'admin' | 'manager' | 'sales' | 'operator' | 'viewer';

const ROLE_HIERARCHY: Record<Role, number> = {
  admin:    5,
  manager:  4,
  sales:    3,
  operator: 2,
  viewer:   1,
};

/**
 * Middleware factory: require a minimum role level.
 * Example: requireRole('manager') allows admin + manager, blocks sales/operator/viewer
 */
export function requireRole(minRole: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userLevel = ROLE_HIERARCHY[req.user.role as Role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel >= requiredLevel) {
      next();
    } else {
      res.status(403).json({
        error: `Insufficient permissions. Required: ${minRole}, your role: ${req.user.role}`,
        code: 'FORBIDDEN',
      });
    }
  };
}

/** Check role without middleware (for inline use) */
export function hasRole(userRole: string, minRole: Role): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as Role] ?? 0;
  return userLevel >= ROLE_HIERARCHY[minRole];
}
