// ============================================
// utils/pagination.ts
// Pagination uniforme de toutes les listes de l'API.
// Un plafond est appliqué côté serveur : le client ne peut pas demander
// dix mille lignes en une requête.
// ============================================
import { PAGINATION } from "../config/constants.js";

export interface OptionsPagination {
  page: number;
  taille: number;
  skip: number;
}

export const lirePagination = (query: unknown): OptionsPagination => {
  const source = (query ?? {}) as Record<string, unknown>;

  const pageBrute = Number(source.page ?? 1);
  const tailleBrute = Number(source.taille ?? PAGINATION.TAILLE_DEFAUT);

  const page = Number.isFinite(pageBrute) && pageBrute > 0 ? Math.floor(pageBrute) : 1;
  const taille =
    Number.isFinite(tailleBrute) && tailleBrute > 0
      ? Math.min(Math.floor(tailleBrute), PAGINATION.TAILLE_MAX)
      : PAGINATION.TAILLE_DEFAUT;

  return { page, taille, skip: (page - 1) * taille };
};

export interface ReponsePaginee<T> {
  items: T[];
  page: number;
  taille: number;
  total: number;
  pages: number;
}

export const construireReponse = <T>(
  items: T[],
  total: number,
  options: OptionsPagination,
): ReponsePaginee<T> => ({
  items,
  page: options.page,
  taille: options.taille,
  total,
  pages: Math.max(Math.ceil(total / options.taille), 1),
});
