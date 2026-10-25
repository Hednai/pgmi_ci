-- Mot de passe du marin
--
-- Les deux colonnes sont nullables : les dossiers déjà enregistrés n'ont pas
-- de mot de passe tant que leur titulaire n'en a pas défini un, et aucune
-- valeur par défaut ne doit être écrite à leur place.
ALTER TABLE "Marin" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "Marin" ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3);

-- Les codes à usage unique ne servent plus qu'à la réinitialisation d'un mot
-- de passe oublié. La valeur par défaut suit cet usage.
ALTER TABLE "OtpCode" ALTER COLUMN "purpose" SET DEFAULT 'PASSWORD_RESET';