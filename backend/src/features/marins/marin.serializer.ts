// ============================================
// features/marins/marin.serializer.ts
// Mise en forme des marins renvoyés par l'API.
//
// Un sérialiseur unique garantit qu'aucun champ interne ne fuit par
// inadvertance quand un include Prisma est élargi dans un service.
// ============================================
import { MARIN_STATUS } from "../../domain/status.js";

// Forme minimale attendue en entrée. Volontairement structurelle plutôt
// que liée aux types Prisma : le sérialiseur accepte aussi un objet partiel.
export interface MarinSerialisable {
  id: string;
  matricule: string | null;
  phone: string;
  email: string | null;
  firstName: string;
  lastName: string;
  birthDate: Date;
  birthPlace: string;
  nationality: string;
  idNumber: string;
  photoUrl: string | null;
  region: string | null;
  shipCategory: string | null;
  status: string;
  registrationSource: string;
  isCadet: boolean;
  notifySms: boolean;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
  createdAt: Date;
  fonction?: { id: string; code: string; label: string } | null;
}

export const serialiserMarin = (marin: MarinSerialisable) => ({
  id: marin.id,
  matricule: marin.matricule,
  phone: marin.phone,
  email: marin.email,
  firstName: marin.firstName,
  lastName: marin.lastName,
  fullName: `${marin.firstName} ${marin.lastName}`,
  birthDate: marin.birthDate,
  birthPlace: marin.birthPlace,
  nationality: marin.nationality,
  idNumber: marin.idNumber,
  photoUrl: marin.photoUrl,
  region: marin.region,
  shipCategory: marin.shipCategory,
  status: marin.status,
  isActive: marin.status === MARIN_STATUS.ACTIVE,
  registrationSource: marin.registrationSource,
  isCadet: marin.isCadet,
  fonction: marin.fonction
    ? { id: marin.fonction.id, code: marin.fonction.code, label: marin.fonction.label }
    : null,
  preferences: {
    sms: marin.notifySms,
    whatsapp: marin.notifyWhatsapp,
    email: marin.notifyEmail,
  },
  createdAt: marin.createdAt,
});

// Version réduite pour les listes agent : pas de données de contact complètes
export const serialiserMarinResume = (marin: MarinSerialisable) => ({
  id: marin.id,
  matricule: marin.matricule,
  fullName: `${marin.firstName} ${marin.lastName}`,
  status: marin.status,
  registrationSource: marin.registrationSource,
  isCadet: marin.isCadet,
  fonction: marin.fonction?.label ?? null,
  region: marin.region,
  createdAt: marin.createdAt,
});
