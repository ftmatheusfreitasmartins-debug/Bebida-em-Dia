# Bebida em Dia - Sistema de Rodízio v2.0

Sistema moderno e completo para gerenciar o rodízio de bebidas entre amigos, colegas ou familiares.

## 🚀 Características

### ✨ Melhorias da Versão 2.0

- **Arquitetura Modular**: Código organizado em módulos reutilizáveis
- **Segurança Aprimorada**: Autenticação JWT e variáveis de ambiente
- **Interface Moderna**: Design responsivo com 13 temas disponíveis
- **API Robusta**: Tratamento de erros e validações melhoradas
- **Experiência do Usuário**: Notificações toast e loading states
- **Acessibilidade**: Suporte completo para navegação por teclado
- **Responsividade**: Funciona perfeitamente em dispositivos móveis

### 🎯 Funcionalidades Principais

#### Para Usuários
- **Seleção de Perfil**: Interface intuitiva para escolher seu perfil
- **Registro de Bebidas**: Um clique para registrar sua contribuição
- **Ranking Dinâmico**: Veja quem mais contribuiu com o grupo
- **Histórico Pessoal**: Acompanhe suas próprias contribuições
- **Calendário Visual**: Visualize todo o histórico em formato de calendário
- **Personalização**: 13 temas, fundos personalizados e fotos de perfil
- **Configurações**: Salvas por perfil individual

#### Para Administradores
- **Dashboard Completo**: Estatísticas e gráficos em tempo real
- **Gerenciamento de Pessoas**: Adicionar/remover participantes
- **Controle de Pagamentos**: Editar registros diretamente no calendário
- **Configurações do Sistema**: Modo de rotação (sequencial/aleatório)
- **Zona de Perigo**: Reset seguro com backup automático
- **Múltiplos Temas**: Personalização da interface administrativa

## 🛠️ Tecnologias Utilizadas

### Backend
- **Node.js** com Express.js
- **JWT** para autenticação segura
- **bcryptjs** para hash de senhas (futuro)
- **CORS** para requisições cross-origin
- **dotenv** para variáveis de ambiente

### Frontend
- **HTML5** semântico e acessível
- **CSS3** moderno com variáveis CSS e grid/flexbox
- **JavaScript ES6+** com classes e módulos
- **Chart.js** para gráficos interativos
- **Font Awesome** para ícones

### Arquitetura
- **Modular**: Separação clara de responsabilidades
- **RESTful API**: Endpoints bem definidos
- **Responsive Design**: Mobile-first approach
- **Progressive Enhancement**: Funciona sem JavaScript básico

## 📦 Instalação

### Pré-requisitos
- Node.js 16+ 
- npm ou yarn

### Passos

1. **Clone ou extraia o projeto**
```bash
cd bebida-em-dia-melhorado
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**
```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. **Inicie o servidor**
```bash
npm start
# ou para desenvolvimento:
npm run dev
```

5. **Acesse a aplicação**
- Site principal: http://localhost:3000
- Painel admin: http://localhost:3000/admin

## ⚙️ Configuração

### Variáveis de Ambiente (.env)

```env
# Porta do servidor
PORT=3000

# Senha do administrador
ADMIN_PASSWORD=sua_senha_segura

# Chave secreta para JWT
JWT_SECRET=sua_chave_jwt_muito_secreta

# Ambiente
NODE_ENV=production
```

### Estrutura de Arquivos

```
coca/
├── public/                # Arquivos estáticos
│   ├── assets/
│   │   └── coca-logo.png  # Logo
│   │   └── top1.jpg  # Top 1 ranking
│   │   └── top2.jpg  # Top 2 ranking
│   │   └── top3.jpg  # Top 3 ranking
│   ├── css/
│   │   └── styles.css     # Estilos principais
│   ├── js/
│   │   ├── utils.js       # Utilitários gerais
│   │   ├── api.js         # Cliente da API
│   │   ├── theme.js       # Gerenciamento de temas
│   │   ├── modal.js       # Sistema de modais
│   │   ├── main.js        # Aplicação principal
│   │   └── admin.js       # Painel administrativo
│   ├── index.html         # Página principal
│   └── admin.html         # Página administrativa
├── server.js              # Servidor Express
├── data.json              # Banco de dados JSON
├── package.json           # Dependências do projeto
├── .env                   # Variáveis de ambiente
└── README.md              # Esta documentação
```

## 🎨 Temas Disponíveis

1. **Dark** - Tema escuro padrão
2. **Light** - Tema claro
3. **Nord** - Paleta Nord
4. **Cyberpunk** - Neon e futurista
5. **Dracula** - Baseado no tema Dracula
6. **Solarized Light** - Solarized claro
7. **Gruvbox Dark** - Gruvbox escuro
8. **Oceanic** - Tons de azul oceânico
9. **Monokai** - Baseado no Monokai
10. **Synthwave** - Estilo anos 80
11. **Forest** - Tons de verde
12. **Aura** - Tema Aura
13. **Midnight** - Azul meia-noite

## 🔐 Segurança

### Melhorias Implementadas

- **Autenticação JWT**: Tokens seguros com expiração
- **Variáveis de Ambiente**: Senhas não ficam no código
- **Validação de Entrada**: Sanitização de dados do usuário
- **CORS Configurado**: Controle de origem das requisições
- **Rate Limiting**: Proteção contra ataques (recomendado para produção)

### Recomendações para Produção

1. Use HTTPS sempre
2. Configure um proxy reverso (nginx)
3. Implemente rate limiting
4. Use um banco de dados real (PostgreSQL/MongoDB)
5. Configure logs de auditoria
6. Faça backups regulares

## 📱 Responsividade

O sistema foi desenvolvido com abordagem mobile-first:

- **Mobile** (< 768px): Layout em coluna única, menu hambúrguer
- **Tablet** (768px - 1024px): Layout adaptado para telas médias
- **Desktop** (> 1024px): Layout completo com todas as funcionalidades

## 🔧 API Endpoints

### Públicos
- `GET /api/data` - Dados gerais do sistema
- `PATCH /api/paid/toggle-today` - Alternar pagamento de hoje
- `GET /api/next-person` - Próxima pessoa na rotação
- `POST /api/chat` - Enviar mensagem (futuro)

### Administrativos (requer autenticação)
- `POST /api/admin/login` - Login do administrador
- `GET /api/admin/data` - Dados completos do sistema
- `POST /api/admin/people` - Adicionar pessoa
- `DELETE /api/admin/people` - Remover pessoa
- `PATCH /api/admin/paid` - Atualizar pagamento
- `DELETE /api/admin/reset` - Resetar histórico
- `PATCH /api/admin/settings` - Atualizar configurações

## 🐛 Solução de Problemas

### Problemas Comuns

1. **Erro de conexão**
   - Verifique se o servidor está rodando
   - Confirme a porta no arquivo .env

2. **Login admin não funciona**
   - Verifique a senha no arquivo .env
   - Limpe o localStorage do navegador

3. **Temas não carregam**
   - Verifique se o CSS está sendo carregado
   - Limpe o cache do navegador

4. **Dados não salvam**
   - Verifique permissões de escrita no data.json
   - Confirme se o servidor tem acesso ao arquivo

## 🚀 Deploy

### Opções de Deploy

1. **Servidor VPS**
   - Use PM2 para gerenciar o processo
   - Configure nginx como proxy reverso
   - Use certificado SSL (Let's Encrypt)

2. **Heroku**
   - Configure as variáveis de ambiente
   - Use PostgreSQL addon para dados
   - Configure domínio customizado

3. **Docker**
   - Crie Dockerfile baseado em node:alpine
   - Use docker-compose para orquestração
   - Configure volumes para persistência

## 🤝 Contribuição

### Como Contribuir

1. Faça um fork do projeto
2. Crie uma branch para sua feature
3. Implemente as mudanças
4. Teste thoroughly
5. Envie um pull request

### Padrões de Código

- Use ESLint para JavaScript
- Siga convenções de nomenclatura
- Documente funções complexas
- Mantenha commits atômicos

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

## 🆘 Suporte

Para suporte e dúvidas:

1. Verifique a documentação
2. Procure em issues existentes
3. Crie uma nova issue se necessário
4. Entre em contato com a equipe

## 🎉 Agradecimentos

- Equipe de desenvolvimento
- Usuários que testaram a versão beta
- Comunidade open source
- Bibliotecas e frameworks utilizados

---

**Bebida em Dia v2.0** - Tornando o rodízio de bebidas mais organizado e divertido! 🍻

