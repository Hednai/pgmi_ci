// ============================================
// middleware/xssClean.ts
// Nettoyage des chaînes entrantes (ENF-003).
//
// La bibliothèque xss retire le HTML dangereux sans toucher aux caractères
// accentués : indispensable ici, les noms ivoiriens et les libellés français
// contiennent des accents et des apostrophes.
// ============================================
import type { Request, Response, NextFunction } from "express";
import { filterXSS } from "xss";

// Nettoyer récursivement une valeur quelconque
const nettoyer = (valeur: unknown): unknown => {
  if (typeof valeur === "string") {
    return filterXSS(valeur, { whiteList: {}, stripIgnoreTag: true });
  }
  if (Array.isArray(valeur)) {
    return valeur.map(nettoyer);
  }
  if (valeur && typeof valeur === "object") {
    const source = valeur as Record<string, unknown>;
    const resultat: Record<string, unknown> = {};
    for (const cle of Object.keys(source)) {
      resultat[cle] = nettoyer(source[cle]);
    }
    return resultat;
  }
  return valeur;
};

// Seul le corps est réaffecté : req.query est immuable sur Express 5.
const xssClean = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") {
    req.body = nettoyer(req.body);
  }
  next();
};

export default xssClean;
