const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// A chave será passada via Secrets do GitHub
const serviceAccountJson = process.env.FIREBASE_ADMIN_CREDENTIALS;

if (!serviceAccountJson) {
  console.error("ERRO: A Secret 'FIREBASE_ADMIN_CREDENTIALS' não foi definida!");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(serviceAccountJson);
} catch (e) {
  console.error("ERRO: A Secret não é um JSON válido.");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateReadme() {
  try {
    // Busca os 3 maiores Elos do banco de dados
    const snapshot = await db.collection('players')
      .orderBy('elo', 'desc')
      .limit(3)
      .get();
      
    let rankingMarkdown = '| 🏆 Posição | Jogador | Elo |\n| :---: | :--- | :---: |\n';
    
    if (snapshot.empty) {
      rankingMarkdown += '| - | *Ainda sem jogadores ranqueados* | - |\n';
    } else {
      let rank = 1;
      const medals = ['🥇', '🥈', '🥉'];
      snapshot.forEach(doc => {
        const data = doc.data();
        const nome = data.displayName || 'Anônimo';
        const elo = Math.round(data.elo || 1200);
        rankingMarkdown += `| ${medals[rank-1]} ${rank}º | **${nome}** | ${elo} |\n`;
        rank++;
      });
    }

    // Adiciona uma linha de quando foi a última atualização
    const dateOpts = { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' };
    const ultimaAtualizacao = new Date().toLocaleString('pt-BR', dateOpts);
    rankingMarkdown += `\n*Última atualização: ${ultimaAtualizacao} (Automático)*\n`;

    // Localiza e modifica o README.md na raiz do repositório
    const readmePath = path.join(__dirname, '..', '..', 'README.md');
    const readmeContent = fs.readFileSync(readmePath, 'utf8');

    const startTag = '<!-- TOP_RANKING_START -->';
    const endTag = '<!-- TOP_RANKING_END -->';

    const regex = new RegExp(`(${startTag})[\\s\\S]*?(${endTag})`);
    
    if (!readmeContent.match(regex)) {
      console.error("ERRO: As tags 'TOP_RANKING_START' e 'END' não foram encontradas no README.md");
      process.exit(1);
    }

    const newContent = readmeContent.replace(regex, `$1\n\n${rankingMarkdown}\n$2`);
    
    fs.writeFileSync(readmePath, newContent, 'utf8');
    console.log("SUCESSO: README.md atualizado com os últimos dados do Firebase!");
    
  } catch (err) {
    console.error("ERRO ao buscar dados do Firestore:", err);
    process.exit(1);
  }
}

updateReadme();
