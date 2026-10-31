// ============================================
// public/verify.js
// Page publique de vérification d'un document par code court.
//
// Ce script vivait en ligne dans verify.html, ce qui obligeait la politique
// de sécurité du contenu à autoriser 'unsafe-inline' pour scriptSrc, sur la
// page la plus exposée de la plateforme. Sorti dans un fichier, il est servi
// par 'self' et la directive peut se refermer.
// ============================================
var code = window.location.pathname.split("/").filter(Boolean).pop() || "";
var contenu = document.getElementById("contenu");

// Échappement systématique : aucune donnée du serveur n'est injectée
// en HTML sans passer par ici.
function echapper(valeur) {
  return String(valeur === null || valeur === undefined ? "" : valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ligne(libelle, valeur, mono) {
  if (!valeur) return "";
  return (
    '<div class="ligne"><dt>' +
    echapper(libelle) +
    "</dt><dd" +
    (mono ? ' class="mono"' : "") +
    ">" +
    echapper(valeur) +
    "</dd></div>"
  );
}

function afficher(donnees) {
  var classe = donnees.valide
    ? "valide"
    : donnees.statut === "EXPIRED" || donnees.statut === "REPLACED"
      ? "attention"
      : "invalide";
  var pictogramme = donnees.valide ? "✓" : donnees.statut === "EXPIRED" ? "!" : "×";

  var html =
    '<div class="bandeau ' +
    classe +
    '"><div class="pictogramme">' +
    pictogramme +
    "</div><h2>" +
    echapper(donnees.libelleStatut) +
    "</h2><p>" +
    echapper(donnees.message) +
    "</p></div>";

  // Un code désigne un document ou un mouvement vérifié, jamais les deux.
  // Le mouvement porte ses propres lignes : navire, période et jours, qui
  // sont le contenu opposable d'un temps de mer (R26).
  if (donnees.mouvement) {
    var mouvement = donnees.mouvement;
    html += '<div class="carte"><dl>';
    html += ligne("Objet", "Temps de mer vérifié");
    html += ligne("Navire", mouvement.navire);
    html += ligne("Numéro IMO", mouvement.imo, true);
    html += ligne("Marin", mouvement.titulaire);
    html += ligne("Matricule", mouvement.matricule, true);
    html += ligne("Fonction à bord", mouvement.fonction);
    html += ligne("Embarqué le", mouvement.embarqueLe);
    html += ligne("Débarqué le", mouvement.debarqueLe);
    html += ligne("Jours comptabilisés", mouvement.jours);
    html += ligne("Autorité", mouvement.autorite);
    html += ligne("Code de vérification", mouvement.code, true);
    html += "</dl></div>";
  }

  if (donnees.document) {
    var doc = donnees.document;
    html += '<div class="carte">';
    if (doc.photoUrl) {
      html += '<img class="photo" alt="" src="' + echapper(doc.photoUrl) + '" />';
    }
    html += "<dl>";
    html += ligne("Document", doc.certificat);
    html += ligne("Titulaire", doc.titulaire);
    html += ligne("Matricule", doc.matricule, true);
    html += ligne("Fonction", doc.fonction);
    html += ligne("Numéro", doc.numero, true);
    html += ligne("Délivré le", doc.delivreLe);
    html += ligne("Expire le", doc.expireLe);
    html += ligne("Autorité", doc.autorite);
    html += ligne("Code de vérification", doc.code, true);
    if (donnees.remplacePar) {
      html += ligne("Remplacé par le code", donnees.remplacePar, true);
    }
    html += "</dl></div>";
  }

  contenu.className = "";
  contenu.innerHTML = html;
}

if (!code) {
  contenu.textContent = "Aucun code de vérification fourni.";
} else {
  fetch("/api/v/" + encodeURIComponent(code))
    .then(function (reponse) {
      // Le corps est lu dans tous les cas : le serveur renvoie un message
      // exploitable aussi bien en succès qu'en erreur.
      return reponse.json().then(function (corps) {
        return { statut: reponse.status, corps: corps };
      });
    })
    .then(function (reponse) {
      // Trop de vérifications depuis cette adresse : message dédié, pour
      // que l'utilisateur sache qu'il doit patienter et non réessayer.
      if (reponse.statut === 429) {
        contenu.textContent =
          "Trop de vérifications depuis cette connexion. Patientez une minute.";
        return;
      }

      // Toute réponse sans données exploitables aboutissait à un plantage
      // du script et à une page figée sur « Vérification en cours ».
      if (!reponse.corps || !reponse.corps.data) {
        contenu.textContent =
          (reponse.corps && reponse.corps.message) ||
          "Code de vérification inconnu.";
        return;
      }

      afficher(reponse.corps.data);
    })
    .catch(function () {
      contenu.textContent =
        "Vérification impossible. Contrôlez votre connexion et réessayez.";
    });
}