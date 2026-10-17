// ============================================
// main.tsx
// Point de montage de l'application React.
// ============================================
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

const racine = document.getElementById("root");
if (!racine) throw new Error("Élément racine introuvable dans index.html.");

createRoot(racine).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
