// ============================================
// components/molecules/FormulaireBareme.tsx
// Création et modification d'un tarif depuis l'écran Référentiels.
//
// La route POST existait déjà, mais un administrateur de la DGAM ne tape
// pas de commande : sans cet écran, aucun tarif de service ne pouvait être
// créé. Le composant ne connaît ni la route ni le magasin, il reçoit une
// fonction d'enregistrement : la même carte sert la création et la
// modification.
// ============================================
import { useState } from "react";
import { t } from "../../i18n/index.js";
import { Card } from "../atoms/Card.js";
import { Button } from "../atoms/Button.js";
import { InputField, SelectField } from "../atoms/Field.js";
import { Alerte } from "../atoms/Feedback.js";
import {
  CODES_SERVICE,
  FORME_BAREME,
  NATURES_DEMANDE,
  corpsBareme,
  saisieDepuis,
  verifierSaisie,
} from "../../lib/baremes.js";
import type { CorpsBareme, FormeBareme } from "../../lib/baremes.js";
import { repartirErreurs, AUCUNE_ERREUR } from "../../lib/erreursFormulaire.js";
import type { ErreursFormulaire } from "../../lib/erreursFormulaire.js";
import type { Bareme, TypeCertificat } from "../../types/api.js";

interface ProprietesFormulaireBareme {
  certificats: TypeCertificat[];
  // Ligne à modifier. Absente, le formulaire crée un tarif.
  bareme?: Bareme;
  onEnregistrer: (corps: CorpsBareme) => Promise<void>;
  onFermer: () => void;
}

export function FormulaireBareme({
  certificats,
  bareme,
  onEnregistrer,
  onFermer,
}: ProprietesFormulaireBareme) {
  const [saisie, setSaisie] = useState(saisieDepuis(bareme));
  const [erreurs, setErreurs] = useState<ErreursFormulaire>(AUCUNE_ERREUR);
  const [envoi, setEnvoi] = useState(false);

  // La forme d'une ligne existante ne change pas : la modifier reviendrait
  // à tarifer un autre objet sous la même identité.
  const modification = Boolean(bareme);

  function changer(champ: keyof typeof saisie, valeur: string) {
    setSaisie({ ...saisie, [champ]: valeur });
  }

  function changerForme(valeur: string) {
    // Le passage d'une forme à l'autre remet à zéro les champs de l'autre
    // forme : une saisie restée en mémoire partirait au serveur.
    setSaisie({
      ...saisie,
      forme: valeur as FormeBareme,
      certificateTypeId: "",
      serviceCode: "",
      requestType: "",
    });
  }

  async function enregistrer() {
    const refus = verifierSaisie(saisie);
    if (Object.keys(refus).length > 0) {
      setErreurs({ parChamp: refus, global: "" });
      return;
    }

    setErreurs(AUCUNE_ERREUR);
    setEnvoi(true);

    try {
      await onEnregistrer(corpsBareme(saisie));
      onFermer();
    } catch (erreur) {
      setErreurs(repartirErreurs(erreur, t.commun.erreurReseau));
      setEnvoi(false);
    }
  }

  return (
    <Card className="space-y-4">
      <h3 className="text-sm font-semibold text-navy">
        {modification ? t.referentiels.modifierTarif : t.referentiels.nouveauTarif}
      </h3>

      {erreurs.global && <Alerte ton="erreur">{erreurs.global}</Alerte>}

      {/* La forme n'est choisie qu'à la création */}
      {!modification && (
        <SelectField
          label={t.referentiels.objetTarife}
          value={saisie.forme}
          onChange={function (evenement) {
            changerForme(evenement.target.value);
          }}
        >
          <option value={FORME_BAREME.CERTIFICAT}>{t.referentiels.formeCertificat}</option>
          <option value={FORME_BAREME.SERVICE}>{t.referentiels.formeService}</option>
        </SelectField>
      )}

      {saisie.forme === FORME_BAREME.SERVICE ? (
        <SelectField
          label={t.referentiels.prestationConcernee}
          value={saisie.serviceCode}
          erreur={erreurs.parChamp.serviceCode}
          obligatoire
          disabled={modification}
          onChange={function (evenement) {
            changer("serviceCode", evenement.target.value);
          }}
        >
          <option value="">{t.referentiels.choisir}</option>
          {CODES_SERVICE.map(function afficherService(code) {
            return (
              <option key={code} value={code}>
                {t.referentiels.services[code]}
              </option>
            );
          })}
        </SelectField>
      ) : (
        <>
          <SelectField
            label={t.referentiels.certificatConcerne}
            value={saisie.certificateTypeId}
            erreur={erreurs.parChamp.certificateTypeId}
            obligatoire
            disabled={modification}
            onChange={function (evenement) {
              changer("certificateTypeId", evenement.target.value);
            }}
          >
            <option value="">{t.referentiels.choisir}</option>
            {certificats.map(function afficherCertificat(certificat) {
              return (
                <option key={certificat.id} value={certificat.id}>
                  {certificat.label}
                </option>
              );
            })}
          </SelectField>

          <SelectField
            label={t.referentiels.natureDemande}
            value={saisie.requestType}
            erreur={erreurs.parChamp.requestType}
            obligatoire
            disabled={modification}
            onChange={function (evenement) {
              changer("requestType", evenement.target.value);
            }}
          >
            <option value="">{t.referentiels.choisir}</option>
            {NATURES_DEMANDE.map(function afficherNature(nature) {
              return (
                <option key={nature} value={nature}>
                  {t.demandes.type[nature]}
                </option>
              );
            })}
          </SelectField>
        </>
      )}

      {/* Clavier numérique sur téléphone, le champ reste une chaîne tant
          qu'il est édité pour qu'un effacement ne vaille pas zéro. */}
      <InputField
        label={t.referentiels.montantLabel}
        aide={t.referentiels.montantAide}
        erreur={erreurs.parChamp.amount}
        obligatoire
        type="text"
        inputMode="numeric"
        value={saisie.amount}
        onChange={function (evenement) {
          changer("amount", evenement.target.value);
        }}
      />

      <div className="flex gap-2">
        <Button variante="discret" onClick={onFermer}>
          {t.commun.annuler}
        </Button>
        <Button pleineLargeur chargement={envoi} onClick={enregistrer}>
          {t.commun.enregistrer}
        </Button>
      </div>
    </Card>
  );
}