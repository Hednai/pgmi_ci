// ============================================
// components/atoms/ChampMotDePasse.tsx
// Champ mot de passe avec bascule afficher/masquer.
// Partagé par la connexion marin, l'inscription et la réinitialisation.
// ============================================
import { useState } from "react";
import { t } from "../../i18n/index.js";
import { Icone } from "./Icone.js";

interface ProprietesChampMotDePasse {
  label: string;
  aide?: string;
  value: string;
  autoComplete?: string;
  obligatoire?: boolean;
  onChange: (evenement: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (evenement: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function ChampMotDePasse({
  label,
  aide,
  value,
  autoComplete,
  obligatoire,
  onChange,
  onKeyDown,
}: ProprietesChampMotDePasse) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-sm font-semibold text-navy">
        {label} {obligatoire && <span className="text-erreur">*</span>}
      </label>

      <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-fond px-3.5 py-3">
        <input
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-sm font-medium text-navy outline-none"
        />
        <button
          type="button"
          onClick={function () {
            setVisible(!visible);
          }}
          className="shrink-0 text-ardoise transition-colors hover:text-navy"
          aria-label={visible ? t.auth.masquerMotDePasse : t.auth.afficherMotDePasse}
        >
          {/* L'icône seule : la phrase occupait la moitié du champ sur un
              écran de téléphone et poussait la saisie hors de vue. Le
              libellé reste porté par aria-label pour les lecteurs d'écran. */}
          <Icone nom={visible ? "oeilFerme" : "oeilOuvert"} taille={18} />
        </button>
      </div>

      {aide && <p className="mt-1.5 text-xs text-ardoise">{aide}</p>}
    </div>
  );
}