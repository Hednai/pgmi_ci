// ============================================
// features/documents/documents.validation.ts
// Schémas Zod de la gestion documentaire.
// ============================================
import { z } from "zod";

// Fichier transmis en base64 après compression côté client (ENF-009).
// La taille réelle est contrôlée à l'écriture par le service de stockage.
export const fichierSchema = z.object({
  nom: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(3).max(80),
  contenuBase64: z.string().min(1, "Contenu du fichier requis"),
});

export const depotDocumentSchema = z.object({
  certificateTypeId: z.string().trim().min(1, "Type de certificat requis"),
  number: z.string().trim().max(60).optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  issuedPlace: z.string().trim().max(120).optional(),
  fichier: fichierSchema.optional(),
});

export const verificationDocumentSchema = z.object({
  // Méthode de contrôle, conservée dans l'audit : comparaison au registre
  // papier, appel à l'organisme émetteur, contrôle visuel du original
  methode: z.string().trim().min(3, "Précisez la méthode de vérification").max(160),
  number: z.string().trim().max(60).optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
});

export const rejetDocumentSchema = z.object({
  reason: z.string().trim().min(5, "Motif obligatoire").max(300),
});

export const revocationDocumentSchema = z.object({
  reason: z.string().trim().min(5, "Motif obligatoire").max(300),
});

export const filtreDocumentsSchema = z.object({
  status: z.string().trim().max(30).optional(),
  category: z.string().trim().max(30).optional(),
  marinId: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().positive().optional(),
  taille: z.coerce.number().int().positive().optional(),
});
