// ============================================
// features/audit/audit.route.ts
// Consultation du journal d'audit.
//
// Lecture seule et réservée à la supervision : aucune route d'écriture ni
// de suppression n'existe, le journal est immuable par construction (R5).
// ============================================
import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { requireAgent } from "../../middleware/auth.js";
import { requireRole } from "../../middleware/rbac.js";
import { validateQuery } from "../../middleware/validate.js";
import { DGAM_SUPERVISION_ROLES } from "../../domain/roles.js";
import { lirePagination, construireReponse } from "../../utils/pagination.js";

const auditRouter = Router();

const filtreAuditSchema = z.object({
  action: z.string().trim().max(60).optional(),
  actorId: z.string().trim().max(40).optional(),
  targetType: z.string().trim().max(40).optional(),
  targetId: z.string().trim().max(40).optional(),
  depuis: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().optional(),
  taille: z.coerce.number().int().positive().optional(),
});

// GET /api/audit
auditRouter.get(
  "/",
  requireAgent,
  requireRole(...DGAM_SUPERVISION_ROLES),
  validateQuery(filtreAuditSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const filtres = req.filtres ?? {};
    const pagination = lirePagination(filtres);

    const where = {
      ...(filtres.action ? { action: String(filtres.action) } : {}),
      ...(filtres.actorId ? { actorId: String(filtres.actorId) } : {}),
      ...(filtres.targetType ? { targetType: String(filtres.targetType) } : {}),
      ...(filtres.targetId ? { targetId: String(filtres.targetId) } : {}),
      ...(filtres.depuis ? { createdAt: { gte: new Date(String(filtres.depuis)) } } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.taille,
      }),
      prisma.auditLog.count({ where }),
    ]);

    // Les métadonnées sont stockées en JSON sérialisé pour rester portables
    const enrichis = items.map((entree) => ({
      ...entree,
      metadata: entree.metadata ? JSON.parse(entree.metadata) : null,
    }));

    res.status(200).json({ success: true, data: construireReponse(enrichis, total, pagination) });
  }),
);

export { auditRouter };
