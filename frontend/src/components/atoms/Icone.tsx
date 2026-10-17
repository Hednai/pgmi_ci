// ============================================
// atoms/Icone.tsx
// Jeu d'icônes de l'application.
//
// Les composants n'importent jamais lucide-react directement : ils demandent
// une icône par son nom métier. Changer de bibliothèque, ou remplacer une
// icône par un pictogramme officiel de la DGAM, ne touche que ce fichier.
// ============================================
import {
  Anchor,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Bell,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Minus,
  Plus,
  QrCode,
  Scale,
  ScrollText,
  Search,
  Settings,
  Ship,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  TriangleAlert,
  Upload,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Catalogue des icônes disponibles, nommées par leur rôle dans le produit.
const CATALOGUE = {
  accueil: Home,
  documents: FileText,
  serviceMer: Anchor,
  conformite: ListChecks,
  profil: User,
  qrCode: QrCode,
  nouvelleDemande: Plus,
  retour: ArrowLeft,
  suivant: ChevronRight,
  valide: Check,
  verifie: BadgeCheck,
  alerte: TriangleAlert,
  manquant: X,
  neutre: Minus,
  horloge: Clock,
  medical: Stethoscope,
  navire: Ship,
  livret: ScrollText,
  paiement: Wallet,
  especes: Banknote,
  mobile: Smartphone,
  televerser: Upload,
  tableauBord: LayoutDashboard,
  marins: Users,
  demandes: ClipboardList,
  verifications: ShieldCheck,
  referentiels: Settings,
  journal: ScrollText,
  formations: Building2,
  dossier: FolderOpen,
  recherche: Search,
  deconnexion: LogOut,
  notifications: Bell,
  autorite: Scale,
} satisfies Record<string, LucideIcon>;

export type NomIcone = keyof typeof CATALOGUE;

interface ProprietesIcone {
  nom: NomIcone;
  // Taille en pixels, alignée sur les cibles tactiles de la charte
  taille?: number;
  epaisseur?: number;
  className?: string;
}

export function Icone({ nom, taille = 20, epaisseur = 1.8, className = "" }: ProprietesIcone) {
  const Composant = CATALOGUE[nom];

  return (
    <Composant size={taille} strokeWidth={epaisseur} className={className} aria-hidden="true" />
  );
}
