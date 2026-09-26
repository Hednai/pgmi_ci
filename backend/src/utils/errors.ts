// ============================================
// utils/errors.ts
// Classes d'erreurs applicatives. Chaque type porte son code HTTP, le
// gestionnaire centralisé n'a donc aucune table de correspondance à tenir.
// ============================================

export class AppError extends Error {
  public statusCode: number;
  // Identifiant de règle métier (R6, R15...), utile côté client et audit
  public rule?: string;

  constructor(message: string, statusCode: number, rule?: string) {
    super(message);
    this.statusCode = statusCode;
    this.rule = rule;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Données invalides.") {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentification requise.") {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Action non autorisée.", rule?: string) {
    super(message, 403, rule);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Ressource introuvable.") {
    super(message, 404);
  }
}

// Violation d'un invariant métier : transition de statut interdite,
// document immuable, quorum non atteint.
export class BusinessRuleError extends AppError {
  constructor(message: string, rule?: string) {
    super(message, 409, rule);
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Trop de requêtes. Réessayez plus tard.") {
    super(message, 429);
  }
}
