// ============================================
// middleware/validate.ts
// Validation Zod des entrées (ENF-003).
//
// Le corps validé remplace req.body : les contrôleurs ne manipulent jamais
// de données non validées, et les champs non déclarés sont écartés.
// ============================================
import type { Request, Response, NextFunction } from "express";
import type { ZodType } from "zod";

// Valider le corps de la requête
export const validateBody =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const resultat = schema.safeParse(req.body);

    if (!resultat.success) {
      return res.status(400).json({
        success: false,
        message: "Données invalides.",
        details: resultat.error.issues.map((probleme) => ({
          champ: probleme.path.join("."),
          message: probleme.message,
        })),
      });
    }

    req.body = resultat.data;
    return next();
  };

// Valider les paramètres de requête (filtres, pagination).
// req.query est en lecture seule sur Express 5 : le résultat est déposé
// sur req.filtres plutôt que réaffecté.
export const validateQuery =
  (schema: ZodType) => (req: Request, res: Response, next: NextFunction) => {
    const resultat = schema.safeParse(req.query);

    if (!resultat.success) {
      return res.status(400).json({
        success: false,
        message: "Paramètres de recherche invalides.",
        details: resultat.error.issues.map((probleme) => ({
          champ: probleme.path.join("."),
          message: probleme.message,
        })),
      });
    }

    req.filtres = resultat.data as Record<string, unknown>;
    return next();
  };

declare module "express-serve-static-core" {
  interface Request {
    filtres?: Record<string, unknown>;
  }
}
