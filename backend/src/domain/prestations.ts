// ============================================
// domain/prestations.ts
// Prestations payantes qui ne sont pas des certificats.
//
// Une demande de certificat est tarifée par type de certificat. Deux autres
// prestations le sont par code de service : la validation d'un mouvement et
// l'édition d'un relevé de navigation. Les montants restent administrables
// par la DGAM (EF-015), seuls les codes sont figés.
// ============================================

export const SERVICE_TARIFE = {
  // Validation d'un embarquement par la DGAM. Payé une seule fois, acquis
  // à vie une fois le mouvement vérifié (R23).
  EMBARKATION_VALIDATION: "EMBARKATION_VALIDATION",
  // Édition d'un relevé de navigation. Payé à chaque édition (R24).
  NAVIGATION_RECORD: "NAVIGATION_RECORD",
} as const;

export type ServiceTarife = (typeof SERVICE_TARIFE)[keyof typeof SERVICE_TARIFE];

// Type de prestation unique pour les services : contrairement aux
// certificats, il n'existe ni première délivrance ni duplicata.
export const TYPE_PRESTATION_SERVICE = "SERVICE";

export const LIBELLE_SERVICE: Record<ServiceTarife, string> = {
  [SERVICE_TARIFE.EMBARKATION_VALIDATION]: "Validation d'un mouvement",
  [SERVICE_TARIFE.NAVIGATION_RECORD]: "Relevé de navigation",
};