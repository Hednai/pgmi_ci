// ============================================
// middleware/notFound.ts
// Route inconnue : réponse au même format que les autres erreurs.
// ============================================
import type { Request, Response } from "express";

const notFound = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route introuvable : ${req.method} ${req.originalUrl}`,
  });
};

export default notFound;
