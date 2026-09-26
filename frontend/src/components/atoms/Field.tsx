// ============================================
// atoms/Field.tsx
// Champs de formulaire : libellé, aide et erreur au même endroit.
//
// Regrouper ces trois éléments garantit que chaque champ reste accessible
// (le libellé est toujours associé au contrôle) sans y penser à chaque écran.
// ============================================
import type { InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

interface ProprietesCommunes {
  label: string;
  aide?: string;
  erreur?: string;
  obligatoire?: boolean;
}

const Enveloppe = ({
  label,
  aide,
  erreur,
  obligatoire,
  identifiant,
  children,
}: ProprietesCommunes & { identifiant: string; children: ReactNode }) => (
  <div className="space-y-1.5">
    <label htmlFor={identifiant} className="block text-sm font-medium text-navy">
      {label}
      {obligatoire && <span className="ml-1 text-erreur">*</span>}
    </label>
    {children}
    {aide && !erreur && <p className="text-xs text-ardoise">{aide}</p>}
    {erreur && <p className="text-xs font-medium text-erreur">{erreur}</p>}
  </div>
);

const CLASSES_CONTROLE =
  "w-full rounded-xl border border-bordure bg-white px-3.5 py-2.5 text-sm text-navy outline-none transition-colors placeholder:text-ardoise/70 focus:border-navy-light focus:ring-2 focus:ring-navy-light/20 disabled:bg-fond";

export const InputField = ({
  label,
  aide,
  erreur,
  obligatoire,
  ...reste
}: ProprietesCommunes & InputHTMLAttributes<HTMLInputElement>) => {
  const identifiant = useId();
  return (
    <Enveloppe
      label={label}
      aide={aide}
      erreur={erreur}
      obligatoire={obligatoire}
      identifiant={identifiant}
    >
      <input
        id={identifiant}
        className={`${CLASSES_CONTROLE} ${erreur ? "border-erreur" : ""}`}
        aria-invalid={Boolean(erreur)}
        {...reste}
      />
    </Enveloppe>
  );
};

export const SelectField = ({
  label,
  aide,
  erreur,
  obligatoire,
  children,
  ...reste
}: ProprietesCommunes & SelectHTMLAttributes<HTMLSelectElement>) => {
  const identifiant = useId();
  return (
    <Enveloppe
      label={label}
      aide={aide}
      erreur={erreur}
      obligatoire={obligatoire}
      identifiant={identifiant}
    >
      <select id={identifiant} className={CLASSES_CONTROLE} {...reste}>
        {children}
      </select>
    </Enveloppe>
  );
};

export const TextAreaField = ({
  label,
  aide,
  erreur,
  obligatoire,
  ...reste
}: ProprietesCommunes & InputHTMLAttributes<HTMLTextAreaElement>) => {
  const identifiant = useId();
  return (
    <Enveloppe
      label={label}
      aide={aide}
      erreur={erreur}
      obligatoire={obligatoire}
      identifiant={identifiant}
    >
      <textarea id={identifiant} rows={3} className={CLASSES_CONTROLE} {...reste} />
    </Enveloppe>
  );
};
