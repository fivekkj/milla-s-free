# Milla's Free — Gerenciamento de Tempo para Equipes

![Status](https://img.shields.io/badge/status-em%90desenvolvimento-yellow)
![Linguagem](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E.svg)
![Estilo](https://img.shields.io/badge/Styled%20with-TailwindCSS-38B2AC.svg)
![Backend](https://img.shields.io/badge/Backend-Firebase-orange.svg)
![Licença](https://img.shields.io/badge/license-MIT-blue.svg)
![PRs](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

---

> **Nota:** Este projeto foi desenvolvido como um Trabalho de Conclusão de Curso (TCC) e está em constante evolução.

## Descrição

O **Milla's Free** é uma plataforma web para gerenciamento de tempo, desenvolvida como projeto de TCC no [SENAI](https://www.fiemg.com.br/senai/) — CTTI. A solução foi proposta pela [3AQ Tecnologia](https://plataforma.gpinovacao.senai.br/plataforma/demandas-da-industria/interna/11183) com o objetivo de otimizar o **rastreamento do tempo gasto por colaboradores e freelancers** em tarefas e projetos.

O sistema permite que gestores de empresas gerenciem suas equipes e tarefas, enquanto os colaboradores registram o tempo trabalhado em tempo real, de forma simples, intuitiva e não invasiva.

---

## Visualização
*Painel do Gestor*
![Painel do Gestor](millasdash.png)

---

## Objetivos

- **Reduzir conflitos:** Garantir clareza sobre o tempo investido em cada tarefa.
- **Aumentar a produtividade:** Identificar gargalos e melhorar a alocação de recursos.
- **Prover transparência:** Facilitar a comunicação entre gestores e colaboradores.
- **Reduzir custos:** Evitar retrabalho com base em dados concretos de desempenho.
- **Criar um novo produto:** Desenvolver uma ferramenta escalável para o mercado.

---

## Funcionalidades

### Painel Principal (Gestor/Empresa)
- **Autenticação Segura:** Cadastro e login com e-mail/senha, verificação de e-mail e recuperação de senha.
- **Gerenciamento de Colaboradores:** Adicionar, editar e remover membros da equipe.
- **Tokens de Acesso:** Geração e gerenciamento de tokens de login únicos para colaboradores (login sem senha).
- **Gerenciamento de Tarefas:** Crie tarefas pré-definidas para facilitar o apontamento da equipe.
- **Aprovação de Horas:** Visualize, aproveite ou rejeite as entradas de tempo submetidas pelos colaboradores.
- **Visualização de Dados:**
    - Filtro de entradas de tempo por colaborador.
    - Gráfico em tempo real com o tempo total gasto por projeto.
    - Paginação para lidar com grandes volumes de dados.
- **Tema:** Suporte a modo claro e escuro (Dark/Light Mode).

### Painel do Colaborador
- **Login Simplificado:** Acesso rápido e seguro utilizando o token fornecido pela empresa.
- **Time Tracker:** Cronômetro para iniciar e parar o rastreamento de tempo em uma tarefa.
- **Listagem de Horas:** Visualize seu histórico de horas trabalhadas.
- **Relatório Visual:** Gráfico com a distribuição do seu tempo entre os projetos.

---

## Restrições e Requisitos

- Compatível com **Windows**, **macOS** e **Linux**.
- Em conformidade com a **Lei Geral de Proteção de Dados (LGPD)**.
- Interface simples e não burocrática para freelancers.
- Deve ser viável para implementação em até 6 meses.

---

##  Tecnologias Utilizadas

O projeto foi construído com uma abordagem moderna e escalável, utilizando tecnologias serverless.

- **Frontend:**
    - **HTML5**
    - **Tailwind CSS:** Para uma estilização rápida e responsiva.
    - **Vanilla JavaScript (ES Modules):** Para toda a lógica e interatividade da interface.
- **Backend (BaaS - Backend as a Service):**
    - **Google Firebase:**
        - **Firestore:** Banco de dados NoSQL em tempo real para armazenar todas as informações.
        - **Authentication:** Gerenciamento completo de autenticação de usuários (e-mail/senha e custom tokens).
        - **Cloud Functions:** Para lógica de backend segura, como a troca de tokens de acesso.
- **Bibliotecas:**
    - **Chart.js:** Para a criação de gráficos dinâmicos e interativos.
- **Controle de Versão:**
    - **Git & GitHub**

---

##  Estrutura do Projeto

O projeto é organizado da seguinte forma para facilitar a manutenção e o desenvolvimento:

```
milla-s-free/
├── css/              # Arquivos de estilização CSS
│   └── styles.css
├── html/             # Páginas HTML da aplicação
│   ├── index.html    # Painel do gestor
│   └── profile.html  # Painel do colaborador
│   └── ...
├── imagens/          # Imagens e logos
├── js/               # Lógica em JavaScript (módulos ES6)
│   ├── auth.js       # Funções de autenticação
│   ├── firebase-config.js.example # Exemplo de configuração do Firebase
│   └── ...
└── README.md
```

---

## 🚀 Como Rodar o Projeto (Desenvolvimento)

Para configurar e rodar o projeto localmente para desenvolvimento, siga os passos abaixo:

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/seu-usuario/milla-s-free.git
    cd milla-s-free
    ```

2.  **Configure o Firebase:**
    *   Acesse o Firebase Console e crie um novo projeto.
    *   Na seção **Build**, ative o **Firestore Database** e a **Authentication** (com o provedor E-mail/Senha).
    *   Vá para as configurações do projeto (`Project Settings`) e crie um novo aplicativo da Web (`Web App`).
    *   Copie o objeto de configuração do Firebase (`firebaseConfig`).

3.  **Crie o arquivo de configuração local:**
    *   No diretório `js/`, crie um arquivo chamado `firebase-config.js`.
    *   Cole a configuração copiada e exporte-a. O arquivo deve ficar assim:
        ```javascript
        // js/firebase-config.js
        const firebaseConfig = {
          apiKey: "SUA_API_KEY",
          authDomain: "SEU_AUTH_DOMAIN",
          projectId: "SEU_PROJECT_ID",
          storageBucket: "SEU_STORAGE_BUCKET",
          messagingSenderId: "SEU_MESSAGING_SENDER_ID",
          appId: "SEU_APP_ID"
        };
        export default firebaseConfig;
        ```
    *   **Importante:** Adicione `js/firebase-config.js` ao seu arquivo `.gitignore` para não expor suas credenciais.

4.  **Inicie um servidor local:**
    Como o projeto usa Módulos ES6, você precisa servi-lo a partir de um servidor web local. A extensão **Live Server** do VS Code é uma ótima opção.

    Alternativamente, você pode usar um servidor via Node.js:
    ```bash
    npm install -g http-server
    http-server .
    ```
    Abra seu navegador e acesse `http://localhost:8080/html/`.

---

## Equipe

- **Equipe de Desenvolvimento:** Alunos do curso técnico do SENAI  
- **Empresa Parceira:** 3AQ Tecnologia

---

## Como Contribuir

Contribuições são bem-vindas! Se você tem alguma ideia para melhorar o projeto, siga os passos abaixo:

1.  **Faça um Fork** do projeto.
2.  **Crie uma Branch** para sua feature (`git checkout -b feature/MinhaFeature`).
3.  **Faça o Commit** de suas mudanças (`git commit -m 'Adiciona MinhaFeature'`).
4.  **Faça o Push** para a Branch (`git push origin feature/MinhaFeature`).
5.  **Abra um Pull Request**.

---

## Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais informações.

---

Feito com ❤️ pela equipe do TCC SENAI.
