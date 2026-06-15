# 👑 DAMAS ROYALE — Damas Brasileiras 3D

<p align="center">
  <img src="https://img.shields.io/badge/Three.js-black?style=for-the-badge&logo=three.js&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript" />
  <img src="https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white" alt="HTML5" />
  <img src="https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white" alt="CSS3" />
</p>

<p align="center">
  <img src="assets/svg/anim_crown.svg" alt="Animação Coroa Flutuante" width="150" style="margin-top: 10px;"/>
</p>

Damas Royale é um jogo de damas 3D moderno com regras oficiais brasileiras. Desenvolvido em **Three.js** puro usando módulos ES nativos (sem necessidade de processos de build complexos) e integrado com o **Google Firebase** para partidas em tempo real, sistema de Elo e ranking global.

A interface conta com uma estética premium em *glassmorphism* escuro e detalhes dourados reais.

---

## 🏆 Top 3 Grandes Mestres (Ao Vivo)

<!-- TOP_RANKING_START -->
*O ranking será atualizado automaticamente em breve pelo GitHub Actions!*
<!-- TOP_RANKING_END -->

---

## 🎮 Modos de Jogo

| Modo | Descrição |
| :--- | :--- |
| **LOCAL** | 2 jogadores no mesmo dispositivo, com rotação automática da câmera 3D. |
| **MÁQUINA** | Jogue contra o computador (IA Minimax com poda Alfa-Beta + busca Quiescence) em 3 dificuldades. Inclui botões para desfazer lances e pedir dicas táticas. |
| **ONLINE** | Partida rápida com fila de pareamento inteligente por faixa de Elo ou criação de salas privadas (convite via código de 6 letras ou link de acesso direto). |
| **ESPECTADOR** | Assista a partidas de outros jogadores ativos na nuvem em tempo real sem interferir no jogo. |
| **REPLAY** | Analise e reproduza jogada a jogada (com timeline 3D deslizante) qualquer partida anterior do seu histórico. |

---

## ⚡ Recursos Adicionais Premium

*   **Arenas Imersivas e Clima Dinâmico**: Jogue em ambientes 3D como Taverna Medieval, Jardim Zen, Cyberpunk ou Vulcão. A neblina e as partículas de clima (chuva, poeira, folhas de cerejeira, fagulhas) reagem ao tema escolhido em tempo real.
*   **Menu de Personalização (Loadout)**: Escolha sua Arena (renderizada localmente para máxima performance) e as Skins do seu exército (sincronizadas com o oponente) antes da batalha.
*   **Finalizações Cinematográficas**: O motor do jogo prevê o lance final da partida, aplicando **Câmera Lenta (Bullet-Time)** no último movimento, seguido de uma chuva de confetes/fogos de artifício 3D na cor do exército vencedor.
*   **Otimização Mobile**: Botões dedicados de Zoom in/out e centralização de câmera inteligente garantem a melhor experiência em telas pequenas.
*   **Sistema de Desafios Diretos**: Visualize jogadores online ativos na nuvem e envie um desafio imediato.
*   **Recuperação de Sessão (Session Recovery)**: Em caso de queda de conexão, a partida é retomada automaticamente de onde parou.
*   **Relógio de Jogo Sincronizado**: Controle de tempo online competitivo (Blitz) no formato Fischer (tempo base + acréscimo por lance).
*   **Reações e Emotes Rápidos**: Comunique-se usando balões flutuantes em 3D sobre o tabuleiro.
*   **Google Sign-In**: Login integrado para persistir estatísticas, taxa de vitória e histórico em múltiplos dispositivos.
*   **Som Sintetizado**: Feedback de áudio sintetizado em tempo real via Web Audio API.

---

## 📜 Regras Oficiais Brasileiras Implementadas

*   **Tabuleiro 8x8**: 12 peças para cada lado. As claras começam.
*   **Captura Obrigatória & Lei da Maioria**: Se houver mais de uma opção de captura, o jogador deve obrigatoriamente escolher a linha que captura o maior número de peças adversárias.
*   **Pedra**: Captura tanto para frente quanto para trás.
*   **Dama Voadora**: Move-se e captura em diagonal a qualquer distância, podendo escolher onde parar após a última peça capturada.
*   **Promoção**: A pedra só se torna Dama se o movimento terminar na última linha adversária.
*   **Sem Salto Duplo**: Uma peça capturada não pode ser saltada duas vezes na mesma jogada (ela só é removida do tabuleiro após o término do movimento completo).
*   **Critérios de Empate**: Repetição de posição por 3 vezes ou 20 lances seguidos de Damas sem captura ou avanço de pedras.

---

## 🛠️ Como Rodar Localmente

Por utilizar módulos ES puros para o carregamento do Three.js e Firebase, o jogo não pode ser aberto diretamente pelo sistema de arquivos (`file://`). Ele precisa de um servidor estático local.

### Usando XAMPP (Windows):
1. Coloque a pasta do projeto dentro de `C:\xampp\htdocs\damas\`.
2. Inicie o servidor Apache no painel do XAMPP.
3. Acesse `http://localhost/damas/` no navegador.

### Usando extensões ou outros servidores rápidos:
*   Se usar o VS Code, utilize a extensão **Live Server** para rodar com um clique.
*   Ou use o Python no terminal da pasta:
    ```bash
    python -m http.server 8000
    ```
    Em seguida, acesse `http://localhost:8000`.

---

## ☁️ Ativando o Modo Online (Configuração do Firebase)

Para habilitar as partidas online e o ranking global:

1. Crie um projeto gratuito em [Firebase Console](https://console.firebase.google.com).
2. Adicione um **App Web** (ícone `</>`), copie o objeto de configuração `firebaseConfig`.
3. Cole as chaves em [js/firebase-config.js](js/firebase-config.js).
4. No menu lateral do Firebase:
   *   Vá em **Authentication -> Sign-in Method** e ative o provedor **Anônimo** e o **Google**.
   *   Crie o banco **Firestore Database** e insira as seguintes regras de segurança na aba **Rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{uid} {
      allow read: if true;
      allow create, update: if request.auth != null && request.auth.uid == uid;
    }
    match /lobby/{uid} {
      allow read, create, update, delete: if request.auth != null;
    }
    match /games/{id} {
      allow read, create, update: if request.auth != null;
    }
    match /challenges/{id} {
      allow read, write: if request.auth != null;
    }
    match /match_history/{id} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null;
    }
  }
}
```

---

## 📂 Estrutura do Código

| Arquivo | Descrição |
| :--- | :--- |
| `js/rules.js` | Motor lógico puro do jogo de damas (geração e validação de lances, notação, serialização). |
| `js/ai.js` | Inteligência Artificial baseada em algoritmo Minimax (poda alfa-beta, quiescence e dicas). |
| `js/elo.js` | Lógica de cálculo de rating Elo e distribuição de patentes/títulos de rank. |
| `js/online.js` | Integração Firebase: matchmaking, salas privadas, desafios, reconexão de sessão e histórico. |
| `js/main.js` | Orquestrador principal (máquina de estados, loop de turnos, inputs 3D e integrações). |
| `js/scene.js` | Configuração da cena, renderização, iluminação e materiais em Three.js. |
| `js/board3d.js` | Renderização e montagem do modelo 3D do tabuleiro. |
| `js/pieces3d.js` | Criação geométrica das peças, coroas de Damas e suas animações físicas de movimento. |
| `js/fx.js` | Gerenciamento de partículas, grids de movimento, tremor de câmera e marcadores 3D. |
| `js/input.js` | Controles de órbita da câmera 3D, picking de cliques e comportamento de drag & drop. |
| `js/ui.js` | Manipulação e atualização do DOM (placar, menus flutuantes, histórico na tela, modais). |
| `js/audio.js` | Síntese e reprodução de efeitos sonoros usando a Web Audio API (sem arquivos de áudio pesados). |
| `js/history.js` | Registro das jogadas em notação algébrica esportiva tradicional. |
| `js/themes.js` | Definição de paletas de cores, materiais e temas para o tabuleiro e peças. |
| `js/utils.js` | Funções utilitárias auxiliares de suporte. |
