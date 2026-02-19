# Social Media Stack

A comprehensive full-stack social media application platform built with React Native, Node.js, PostgreSQL, WorkOS, Azure Storage, and Redis.

## Features

- 🔐 **Authentication**: WorkOS OAuth with multiple providers
- 👤 **User Profiles**: Customizable profiles with bio, images, location
- ❤️ **Social Following**: Follow/unfollow users, view followers and following
- 📝 **Posts**: Create posts with images, like/unlike
- 📰 **Feed**: Personalized feed from followed users
- 💬 **Real-time Messaging**: Live chat with Socket.IO and Redis
- 📸 **Image Uploads**: Profile, cover, and post images via Azure Blob Storage
- 💪 **TypeScript**: Full type safety across frontend and backend

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- WorkOS account
- Azure account (Storage + Redis)
- Expo CLI for mobile development

### Setup

1. **Clone and Install**
   ```bash
   cd social_stack
   npm install # Root dependencies
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Configure Environment Variables**
   
   Copy `.env.example` files and update with your credentials:
   - `backend/.env` - WorkOS, Azure Storage, Azure Redis
   - `frontend/.env` - API URL

   See `WORKOS_SETUP.md` and `AZURE_SETUP.md` for detailed configuration.

3. **Start Infrastructure**
   ```bash
   docker-compose up -d
   ```

4. **Run Backend**
   ```bash
   cd backend
   npm run dev
   ```

5. **Run Frontend**
   ```bash
   cd frontend
   npm start
   ```

## Project Structure

```
social_stack/
├── backend/
│   ├── src/
│   │   ├── config/          # WorkOS, Azure, Redis configuration
│   │   ├── middleware/      # Auth, upload middleware
│   │   ├── routes/          # API endpoints
│   │   ├── services/        # Business logic (images, messaging)
│   │   └── server.ts        # Express + Socket.IO server
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/            # REST client, Socket.IO
│   │   ├── store/          # Zustand state management
│   │   ├── types/          # TypeScript definitions
│   │   └── screens/        # React Native screens (to be implemented)
│   └── package.json
├── database/
│   └── schemas/
│       └── social_schema.sql  # PostgreSQL schema
├── docker-compose.yml
├── WORKOS_SETUP.md
└── AZURE_SETUP.md
```

## API Endpoints

### Authentication
- `GET /api/v1/auth/login` - Initiate OAuth
- `GET /api/v1/auth/callback` - OAuth callback
- `GET /api/v1/auth/me` - Current user
- `POST /api/v1/auth/logout` - Logout

### Profiles
- `GET /api/v1/profiles/:userId` - Get profile
- `PUT /api/v1/profiles/:userId` - Update profile
- `GET /api/v1/profiles/:userId/followers` - List followers
- `POST /api/v1/profiles/:userId/follow` - Follow user

### Posts
- `POST /api/v1/posts` - Create post
- `GET /api/v1/posts/feed/timeline` - Get feed
- `GET /api/v1/posts/user/:userId` - User posts
- `POST /api/v1/posts/:postId/like` - Like post

### Messages
- `GET /api/v1/messages` - Get conversations
- `GET /api/v1/messages/:id/messages` - Message history
- `POST /api/v1/messages/:id/messages` - Send message

### Uploads
- `POST /api/v1/uploads/profile-image` - Upload profile pic
- `POST /api/v1/uploads/post-image` - Upload post image

## Technologies

**Backend:**
- Express.js
- TypeScript
- PostgreSQL
- WorkOS (Auth)
- Azure Blob Storage
- Azure Cache for Redis
- Socket.IO
- Multer (file uploads)

**Frontend:**
- React Native
- Expo
- TypeScript
- Zustand (state)
- React Navigation
- Axios
- Socket.IO Client

**Infrastructure:**
- Docker
- PostgreSQL
- Azure Cloud Services

## Next Steps

The backend is fully implemented. To complete the application:

1. Implement frontend screens (Feed, Profile, Chat, etc.)
2. Add your actual WorkOS and Azure credentials
3. Test authentication flow
4. Test image uploads
5. Test real-time messaging

See `walkthrough.md` for detailed implementation guide.

## License

Proprietary
