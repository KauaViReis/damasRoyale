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
    // Busca contas logadas com Google e ordena no cliente.
    // (Filtro de igualdade + orderBy em outro campo exigiria índice composto;
    //  ordenando aqui, basta o índice automático de campo único.)
    const snapshot = await db.collection('players')
      .where('google', '==', true)
      .get();

    const top = snapshot.docs
      .map(doc => doc.data())
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 3);

    let rankingMarkdown = '| 🏆 Posição | Jogador | Elo |\n| :---: | :--- | :---: |\n';

    if (top.length === 0) {
      rankingMarkdown += '| - | *Ainda sem jogadores ranqueados* | - |\n';
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      top.forEach((data, i) => {
        const nome = data.name || data.displayName || 'Anônimo';
        const elo = Math.round(data.rating || 1200);
        rankingMarkdown += `| ${medals[i]} ${i + 1}º | **${nome}** | ${elo} |\n`;
      });
    }

    // Adiciona uma linha de quando foi a última atualização
    const dateOpts = { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' };
    const ultimaAtualizacao = new Date().toLocaleString('pt-BR', dateOpts);
    rankingMarkdown += `\n*Última atualização: ${ultimaAtualizacao} (Automático)*\n`;

    // Busca o total de partidas já disputadas
    // Assumindo que o histórico ou partidas estão na coleção 'match_history' ou 'games'
    const gamesSnapshot = await db.collection('match_history').count().get();
    const totalGames = gamesSnapshot.data().count;

    // Localiza e modifica o README.md na raiz do repositório
    const readmePath = path.join(__dirname, '..', '..', 'README.md');
    let readmeContent = fs.readFileSync(readmePath, 'utf8');

    // --- REPLACE RANKING ---
    const startTag = '<!-- TOP_RANKING_START -->';
    const endTag = '<!-- TOP_RANKING_END -->';
    const regexRanking = new RegExp(`(${startTag})[\\s\\S]*?(${endTag})`);
    
    if (!readmeContent.match(regexRanking)) {
      console.error("ERRO: As tags 'TOP_RANKING_START' e 'END' não foram encontradas no README.md");
      process.exit(1);
    }
    readmeContent = readmeContent.replace(regexRanking, `$1\n\n${rankingMarkdown}\n$2`);

    // --- REPLACE TOTAL MATCHES ---
    const startMatchTag = '<!-- TOTAL_MATCHES_START -->';
    const endMatchTag = '<!-- TOTAL_MATCHES_END -->';
    const regexMatches = new RegExp(`(${startMatchTag})[\\s\\S]*?(${endMatchTag})`);
    
    if (readmeContent.match(regexMatches)) {
      const matchText = `> 🔥 Já foram disputadas **${totalGames}** partidas épicas no Damas Royale!`;
      readmeContent = readmeContent.replace(regexMatches, `$1\n${matchText}\n$2`);
    }
    
    fs.writeFileSync(readmePath, readmeContent, 'utf8');
    console.log("SUCESSO: README.md atualizado com os últimos dados do Firebase!");
    
  } catch (err) {
    console.error("ERRO ao buscar dados do Firestore:", err);
    process.exit(1);
  }
}

updateReadme();
