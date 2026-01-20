# Life Coach App

A comprehensive multi-agent life coaching platform that provides personalized guidance across finance, health, fitness, nutrition, chores, and digital wellness.

## 🚀 Features

### Multi-Agent Architecture
- **Lead Coordinator**: Central orchestrator managing all specialist agents
- **Financial Advisor**: Budget tracking, receipt scanning, investment guidance
- **Dietitian**: Meal planning, recipe recommendations, nutritional analysis
- **Fitness Trainer**: Workout plans, progress tracking, exercise guidance
- **Chore Manager**: Task organization, scheduling, efficiency tips
- **Digital Wellness Coach**: Screen time management, focus training, habit formation

### Core Capabilities
- 🤖 **AI-Powered Agents**: GPT-4 driven specialist agents with cross-agent collaboration
- 📊 **Progress Tracking**: Comprehensive changelog and analytics dashboard
- 🧾 **Receipt Scanning**: OCR-powered expense tracking and budget analysis
- 🍽️ **Meal Planning**: Personalized nutrition plans with recipe recommendations
- 💪 **Fitness Programs**: Custom workout plans adapted to your goals
- 🏠 **Chore Management**: Smart task breakdown and scheduling optimization
- 📱 **Digital Wellness**: Screen time monitoring and distraction management
- 🎯 **Goal Setting**: Unified goal management with agent coordination
- 🏆 **Reward System**: Behavioral reinforcement through achievement tracking

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   User Interface│◄──►│  Lead Coordinator  │◄──►│ Agent Hub       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │                        │
                                ▼                        ▼
                    ┌─────────────────────┐    ┌─────────────────────┐
                    │   Specialist Agents │    │   Communication     │
                    │                     │    │   Protocols         │
                    │ • Financial         │    └─────────────────────┘
                    │ • Dietitian         │              │
                    │ • Fitness           │              ▼
                    │ • Chore Manager     │    ┌─────────────────────┐
                    │ • Digital Wellness  │    │   Data Layer        │
                    └─────────────────────┘    │                     │
                                                │ • PostgreSQL       │
                                                │ • Redis             │
                                                │ • File Storage      │
                                                └─────────────────────┘
```

## 🛠️ Technology Stack

### Backend
- **Node.js/TypeScript**: Primary development environment
- **Express.js**: API framework
- **PostgreSQL**: Primary database
- **Redis**: Caching and session management
- **Socket.io**: Real-time communication

### AI/ML
- **OpenAI GPT-4**: Agent reasoning and NLP
- **Tesseract.js**: OCR for receipt scanning
- **TensorFlow.js**: Custom ML models for behavior prediction

### Frontend (Planned)
- **React/Next.js**: Web application
- **React Native**: Mobile applications
- **Tailwind CSS**: Styling framework

### Integrations
- **Plaid API**: Financial data aggregation
- **Google Fit/Apple Health**: Fitness data
- **Screen Time APIs**: Digital wellness monitoring

## 📦 Installation

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- OpenAI API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd life-coach-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**
   ```bash
   # Create database
   createdb life_coach
   
   # Run schema
   psql life_coach < database/schema.sql
   ```

5. **Start the application**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 🔧 Configuration

### Environment Variables

```bash
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=life_coach
DB_USER=postgres
DB_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# External APIs
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret
```

## 📚 API Documentation

### Authentication
All endpoints require JWT authentication in the `Authorization` header:
```
Authorization: Bearer <token>
```

### Core Endpoints

#### User Management
- `POST /api/user/goals` - Create new goal
- `GET /api/user/goals` - Get user goals
- `GET /api/user/progress` - Get progress data
- `GET /api/user/changelog` - Get changelog entries

#### Agent Communication
- `POST /api/agents/message` - Send message to agent
- `GET /api/agents` - List all agents
- `GET /api/agents/:id/status` - Get agent status

#### Financial Advisor
- `POST /api/financial/receipt` - Process receipt
- `GET /api/financial/spending` - Get spending analysis
- `GET /api/financial/budget` - Get budget information

#### Dietitian
- `GET /api/dietitian/meal-plan` - Get meal plan
- `POST /api/dietitian/meal-plan` - Create meal plan
- `GET /api/dietitian/recipes` - Search recipes

#### Fitness Trainer
- `GET /api/fitness/workout-plan` - Get workout plan
- `POST /api/fitness/workout-plan` - Create workout plan
- `POST /api/fitness/activity` - Log activity

#### Chore Manager
- `GET /api/chores/tasks` - Get chore tasks
- `POST /api/chores/tasks` - Create task
- `PUT /api/chores/tasks/:id` - Update task

#### Digital Wellness
- `GET /api/wellness/metrics` - Get wellness metrics
- `POST /api/wellness/focus-session` - Log focus session
- `POST /api/wellness/screen-time-limit` - Set screen time limit

## 🔄 Real-time Communication

The app uses Socket.io for real-time features:

### Client Events
- `agent-message` - Send message to agent
- `progress-update` - Update progress
- `receipt-upload` - Upload receipt for processing

### Server Events
- `agent-response` - Receive agent response
- `progress-updated` - Progress update notification
- `receipt-processed` - Receipt processing result

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run linting
npm run lint

# Type checking
npm run typecheck
```

## 📊 Analytics & Monitoring

### Agent Performance
- Response times
- Success rates
- User satisfaction scores
- Cross-agent collaboration metrics

### User Progress
- Goal completion rates
- Habit formation tracking
- Overall life improvement scores
- Engagement metrics

## 🔒 Security

- **End-to-end encryption** for sensitive data
- **GDPR compliance** with user consent management
- **Rate limiting** to prevent abuse
- **Input validation** and sanitization
- **Secure authentication** with JWT tokens

## 🌱 Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Multi-agent architecture
- [x] Lead coordinator implementation
- [x] Basic communication protocols
- [x] Database schema

### Phase 2: Specialist Agents (In Progress)
- [ ] Financial advisor with receipt scanning
- [ ] Dietitian with meal planning
- [ ] Cross-agent collaboration
- [ ] Basic UI implementation

### Phase 3: Advanced Features
- [ ] Fitness trainer agent
- [ ] Chore management system
- [ ] Digital wellness agent
- [ ] Mobile applications

### Phase 4: Enhancement
- [ ] Advanced analytics
- [ ] Localization support
- [ ] Integration with external services
- [ ] Premium features

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- OpenAI for GPT-4 API
- Tesseract.js for OCR capabilities
- Plaid for financial data integration
- The open-source community for inspiration and tools

## 📞 Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Join our community Discord (coming soon)

---

**Built with ❤️ by the Life Coach App team**