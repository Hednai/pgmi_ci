// ============================================
// features/realtime/realtime.route.ts
// Ouverture du flux temps réel.
//
// Deux routes complémentaires :
//   POST /api/temps-reel/ticket  authentifiée, délivre un ticket court ;
//   GET  /api/temps-reel/flux    ouvre le flux contre ce ticket.
//
// Le flux n'est jamais ouvert sur la seule foi d'un paramètre d'URL
// contenant un jeton de session : voir l'en-tête de ticket.service.ts.
// ============================================
import { Router } from "express";
import { requireAuthenticated } from "../../middleware/auth.js";
import { ticketLimiter, fluxLimiter } from "../../middleware/limiteurs.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { UnauthorizedError } from "../../utils/errors.js";
import { permissionsDuRole } from "../../domain/permissions.js";
import { TOUS_LES_EVENEMENTS } from "../../domain/evenements.js";
import { delivrerTicket, consommerTicket } from "../../services/realtime/ticket.service.js";
import { ouvrirFlux } from "../../services/realtime/sse.broadcaster.js";
import type { AbonneTempsReel } from "../../services/realtime/RealtimeBroadcaster.js";

const tempsReelRouter = Router();

// POST /api/temps-reel/ticket
tempsReelRouter.post(
  "/ticket",
  ticketLimiter,
  requireAuthenticated,
  asyncHandler(async (req, res) => {
    const acteur = req.acteur;
    if (!acteur) throw new UnauthorizedError();

    // Les permissions sont figées dans le ticket, à partir du rôle courant.
    // Un agent dont le rôle change devra rouvrir son flux : c'est le
    // comportement voulu, le flux ne gagne jamais de droits en cours de vie.
    const abonne: AbonneTempsReel = {
      type: acteur.type,
      id: acteur.id,
      permissions: acteur.type === "AGENT" ? permissionsDuRole(acteur.role) : [],
    };

    res.status(200).json({
      success: true,
      data: {
        ...delivrerTicket(abonne),
        // Le client n'a pas à recopier la liste des événements
        evenements: TOUS_LES_EVENEMENTS,
      },
    });
  }),
);

// GET /api/temps-reel/flux?ticket=...
// La réponse reste ouverte : pas de res.json, pas de next.
tempsReelRouter.get("/flux", fluxLimiter, (req, res) => {
  const valeur = typeof req.query.ticket === "string" ? req.query.ticket : "";
  const abonne = consommerTicket(valeur);

  if (!abonne) {
    res.status(401).json({ success: false, message: "Ticket de flux invalide ou expiré." });
    return;
  }

  ouvrirFlux(abonne, req, res);
});

export { tempsReelRouter };