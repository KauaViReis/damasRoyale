const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'js', 'firebase-config.js');

const apiKey = process.env.FIREBASE_API_KEY;
const authDomain = process.env.FIREBASE_AUTH_DOMAIN;
const projectId = process.env.FIREBASE_PROJECT_ID;
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID;
const appId = process.env.FIREBASE_APP_ID;
const measurementId = process.env.FIREBASE_MEASUREMENT_ID;

let content = '';

if (apiKey && apiKey !== 'COLE_SUA_API_KEY') {
  content = `/* Gerado automaticamente durante o deploy no Vercel */
export const firebaseConfig = {
  apiKey: "${apiKey}",
  authDomain: "${authDomain}",
  projectId: "${projectId}",
  storageBucket: "${storageBucket}",
  messagingSenderId: "${messagingSenderId}",
  appId: "${appId}",
  measurementId: "${measurementId || ''}"
};

export const isFirebaseConfigured = true;
`;
  console.log('✓ Configuração do Firebase injetada com sucesso a partir das variáveis de ambiente.');
} else {
  // Se rodar localmente ou sem variáveis, garante que o arquivo exista a partir do exemplo
  const examplePath = path.join(__dirname, 'js', 'firebase-config.example.js');
  if (fs.existsSync(examplePath)) {
    content = fs.readFileSync(examplePath, 'utf8');
    console.log('! Variáveis de ambiente ausentes. Gerando firebase-config.js a partir do modelo de exemplo.');
  } else {
    console.error('✗ Erro: Arquivo de exemplo firebase-config.example.js não encontrado.');
    process.exit(1);
  }
}

fs.writeFileSync(configPath, content);
