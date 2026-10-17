// ============================================
// layouts/FiletErreur.tsx
// Filet de sécurité du rendu.
//
// Sans lui, une erreur dans n'importe quel écran démonte tout l'arbre React
// et laisse une page blanche muette : l'utilisateur ne sait pas s'il doit
// attendre, recharger ou se reconnecter, et l'agent au guichet ne peut rien
// rapporter d'utile.
//
// React n'offre que la classe pour cet usage : componentDidCatch n'a pas
// d'équivalent en composant de fonction.
// ============================================
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { t } from "../../i18n/index.js";

interface ProprietesFiletErreur {
  children: ReactNode;
}

interface EtatFiletErreur {
  enErreur: boolean;
  // Conservée pour l'affichage technique, replié par défaut
  detail: string;
}

export class FiletErreur extends Component<ProprietesFiletErreur, EtatFiletErreur> {
  public state: EtatFiletErreur = { enErreur: false, detail: "" };

  public static getDerivedStateFromError(erreur: unknown): EtatFiletErreur {
    return {
      enErreur: true,
      detail: erreur instanceof Error ? erreur.message : String(erreur),
    };
  }

  public componentDidCatch(erreur: Error, infos: ErrorInfo): void {
    // La console reste la seule destination : aucun service de collecte
    // externe ne doit recevoir les données d'un dossier de marin.
    console.error("Erreur de rendu interceptée", erreur, infos.componentStack);
  }

  private recharger = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (!this.state.enErreur) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-navy-soft px-5">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
          <p className="font-titre text-lg font-semibold text-navy">{t.erreur.titre}</p>
          <p className="mt-2 text-sm text-ardoise">{t.erreur.explication}</p>

          <button
            type="button"
            onClick={this.recharger}
            className="mt-5 w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white"
          >
            {t.erreur.recharger}
          </button>

          {/* Le détail technique n'est affiché qu'en développement. En
              production, un message d'exception peut révéler une route, un
              champ de dossier ou une structure interne : il reste dans la
              console, pas à l'écran d'un marin. */}
          {import.meta.env.DEV && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-xs text-ardoise">
                {t.erreur.detailTechnique}
              </summary>
              <p className="matricule mt-2 break-words text-[11px] text-ardoise">
                {this.state.detail}
              </p>
            </details>
          )}
        </div>
      </div>
    );
  }
}