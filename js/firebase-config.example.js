/* ============================================================
   DAMAS ROYALE — Configuração do Firebase (Modelo de Exemplo)
   ------------------------------------------------------------
   COMO CONFIGURAR:
   1. Crie uma cópia deste arquivo e dê o nome de "firebase-config.js" na mesma pasta
   2. Crie um projeto no console do Firebase: https://console.firebase.google.com
   3. Adicione um App Web, copie o objeto "firebaseConfig" e preencha as chaves abaixo
   ============================================================ */

export const firebaseConfig = {
  apiKey: "COLE_SUA_API_KEY",
  authDomain: "COLE_SEU_AUTH_DOMAIN",
  projectId: "COLE_SEU_PROJECT_ID",
  storageBucket: "COLE_SEU_STORAGE_BUCKET",
  messagingSenderId: "COLE_SEU_MESSAGING_SENDER_ID",
  appId: "COLE_SEU_APP_ID",
  measurementId: "COLE_SEU_MEASUREMENT_ID"
};

/* O modo online só é habilitado quando a configuração é preenchida */
export const isFirebaseConfigured =
  firebaseConfig.apiKey !== "COLE_SUA_API_KEY" && 
  !firebaseConfig.apiKey.startsWith("COLE_");
