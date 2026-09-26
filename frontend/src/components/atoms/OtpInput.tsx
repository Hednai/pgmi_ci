// ============================================
// atoms/OtpInput.tsx
// Saisie du code SMS à six chiffres.
//
// Le champ avance tout seul et accepte le collage d'un code complet : sur un
// téléphone d'entrée de gamme, ces deux détails évitent la moitié des
// abandons à la connexion.
// ============================================
import { useRef } from "react";
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from "react";

interface ProprietesOtp {
  valeur: string;
  onChange: (valeur: string) => void;
  longueur?: number;
  desactive?: boolean;
}

export const OtpInput = ({ valeur, onChange, longueur = 6, desactive }: ProprietesOtp) => {
  const champs = useRef<(HTMLInputElement | null)[]>([]);

  const majChiffre = (index: number, chiffre: string) => {
    const propre = chiffre.replace(/\D/g, "").slice(-1);
    const caracteres = valeur.padEnd(longueur, " ").split("");
    caracteres[index] = propre || " ";
    onChange(caracteres.join("").trimEnd());

    if (propre && index < longueur - 1) champs.current[index + 1]?.focus();
  };

  // Retour arrière sur une case vide : le curseur remonte d'une case
  const gererTouche = (index: number, evenement: KeyboardEvent<HTMLInputElement>) => {
    if (evenement.key === "Backspace" && !valeur[index] && index > 0) {
      champs.current[index - 1]?.focus();
    }
  };

  const gererCollage = (evenement: ClipboardEvent<HTMLInputElement>) => {
    evenement.preventDefault();
    const colle = evenement.clipboardData.getData("text").replace(/\D/g, "").slice(0, longueur);
    onChange(colle);
    champs.current[Math.min(colle.length, longueur - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: longueur }).map((_, index) => (
        <input
          key={index}
          ref={(element) => {
            champs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={desactive}
          aria-label={`Chiffre ${index + 1}`}
          value={valeur[index]?.trim() ?? ""}
          onChange={(evenement: ChangeEvent<HTMLInputElement>) =>
            majChiffre(index, evenement.target.value)
          }
          onKeyDown={(evenement) => gererTouche(index, evenement)}
          onPaste={gererCollage}
          className="h-14 w-full rounded-xl border border-bordure bg-white text-center text-xl font-semibold text-navy outline-none focus:border-navy-light focus:ring-2 focus:ring-navy-light/20 disabled:bg-fond"
        />
      ))}
    </div>
  );
};
