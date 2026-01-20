# Life Coach Frontend

A modern, responsive web application for the multi-agent life coaching platform.

## Features

### 🎯 **Multi-Agent Dashboard**
- Real-time insights from specialist AI agents
- Unified progress tracking across all life domains
- Interactive goal management and achievement system
- Personalized recommendations and actionable insights

### 📸 **Smart Receipt Scanning**
- AI-powered OCR and receipt analysis
- Automatic categorization and spending insights
- Budget tracking and financial recommendations
- Cross-agent intelligence (Financial + Dietitian integration)

### 🎯 **Progress Tracking**
- Comprehensive progress visualization and analytics
- Achievement celebrations and milestone tracking
- AI-powered insights and trend analysis
- Goal completion rate optimization

### 👤 **User Profile & Settings**
- Comprehensive profile management
- Granular notification preferences
- Agent configuration and privacy controls
- Personalized theme and accessibility options

## Technology Stack

### Frontend
- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **Tailwind CSS** for utility-first styling
- **Framer Motion** for smooth animations
- **Recharts** for data visualization
- **React Query** for server state management
- **React Router** for navigation

### UI/UX
- **Mobile-first responsive design**
- **Dark/Light theme support**
- **Accessibility WCAG 2.1 compliant**
- **Real-time updates** with WebSocket integration
- **Loading states** and smooth transitions
- **Error boundaries** and error handling

### Key Components
- **Layout System**: Responsive sidebar navigation
- **Card System**: Flexible content containers
- **Form Components**: Form inputs with validation
- **Modal System**: Overlays and popups
- **Progress Components**: Visual progress indicators
- **Badge System**: Status indicators
- **Table Components**: Data presentation

## Pages

### Main Features
1. **Dashboard** - Overview with quick stats and activity
2. **Agents** - View and configure specialist AI agents
3. **Receipts** - Upload, scan, and analyze expenses
4. **Goals** - Create and track life improvement goals
5.## Progress** - Visualize progress and achievements
6. **Profile** - User settings and preferences

### Navigation Structure
- Public routes: Login, Register
- Protected routes: All main features
- Responsive sidebar navigation
- Breadcrumb navigation for deep pages
- User authentication with token management

## Development Setup

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```

### Production Build
```bash
npm run build
```

## Key Integrations

### Backend Integration
- **API Proxy**: Routes to backend services
- **Authentication**: JWT-based authentication
- **Real-time**: WebSocket connection for live updates
- **File Upload**: Receipt scanning with progress tracking

### API Endpoints Used
- `/api/user` - User profile and preferences
- `/api/agents` - Agent status and configuration
- `/api/receipts` - Receipt management and analysis
- `/api/goals` - Goal CRUD operations
- `/api/progress` - Progress tracking and analytics
- `/api/auth` - Authentication endpoints

## Responsive Design
- **Mobile-First**: Optimized for mobile experience
- **Adaptive Layout**: Works seamlessly across all screen sizes
- **Touch-Friendly**: Large touch targets for mobile devices
- **Performance**: Optimized loading and smooth interactions

## State Management
- **React Query**: Server state with automatic refetching
- **Zustand**: Client state for UI state
- **React Context**: Authentication and user data sharing
- **Error Boundaries**: Graceful error handling