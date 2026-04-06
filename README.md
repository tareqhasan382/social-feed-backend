# Social Feed Application - Backend

A high-performance, scalable, and secure NestJS-based backend service powering the Social Feed Application. Built with Clean Architecture principles, it provides a robust set of features including secure authentication, real-time feed caching, and advanced media management.

📸 Preview:
![API Preview](./api-overview.png)

---

## 🚀 Key Features

- **Hybrid Real-Time Engine**: Atomic Redis-backed counts for likes and comments with immediate WebSocket broadcasts.
- **Scalable Background Jobs**: BullMQ integration for asynchronous post state synchronization and eventual consistency.
- **Advanced Authentication**: JWT-based auth with access and refresh token rotation, including Redis-backed session management.
- **Scalable Feed Engine**: Cursor-based pagination for high-volume data and infinite scroll support.
- **Caching Layer**: Redis-powered caching for user feeds and real-time statistics (HINCRBY).
- **Media Management**: Secure Cloudinary integration for image and video uploads with automatic resource type detection.
- **Social Graph**: Nested comment systems (replies), transactional like/unlike operations, and dynamic "liked by" user previews.
- **Security First**: Input validation (class-validator), rate limiting (@nestjs/throttler), and ownership-based authorization.
- **Documentation**: Fully interactive Swagger UI for API exploration and testing.

---

## 🛠 Technology Stack

- **Framework**: [NestJS](https://nestjs.com/) (Node.js)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Caching & Real-time Stats**: [Redis](https://redis.io/)
- **Background Jobs**: [BullMQ](https://docs.bullmq.io/)
- **Real-time Communication**: [Socket.io](https://socket.io/)
- **Documentation**: [Swagger / OpenAPI](https://swagger.io/)
- **Media**: [Cloudinary](https://cloudinary.com/)
- **Infrastructure**: Docker & Docker Compose

---

## 📦 Getting Started

### **Prerequisites**
- Node.js (v20 or higher)
- Docker & Docker Compose (Redis & PostgreSQL)
- npm or yarn

### **Installation**

1. **Clone the repo and navigate to the backend directory:**
   ```bash
   cd buddy-script-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   DATABASE_URL="postgresql://user:password@localhost:5432/social_db"
   REDIS_HOST="localhost"
   REDIS_PORT=6379
   REDIS_PASSWORD=""
   JWT_ACCESS_SECRET="your_access_secret"
   JWT_REFRESH_SECRET="your_refresh_secret"
   JWT_EXPIRES_IN=3600
   CLOUDINARY_CLOUD_NAME="your_name"
   CLOUDINARY_API_KEY="your_key"
   CLOUDINARY_API_SECRET="your_secret"
   ```

4. **Spin up Infrastructure:**
   ```bash
   docker-compose up -d
   ```

5. **Run Migrations:**
   ```bash
   npx prisma migrate dev
   ```

6. **Start the Server:**
   ```bash
   npm run start:dev
   ```

---

## 📖 System Architecture: Real-Time & Consistency

The system uses a **Hybrid Consistency Model** to ensure counts are always accurate:
1. **Immediate (Atomic)**: When a user likes/comments, Redis `HINCRBY` atomically updates the count, and a WebSocket broadcast is sent immediately.
2. **Persistent**: The primary interaction is saved in PostgreSQL within a transaction.
3. **Eventual (Self-Healing)**: A BullMQ worker runs after a short delay to fetch the absolute count from the DB and synchronize it back to Redis and all connected clients.

---

## 📖 API Endpoints Summary

### **Auth Module**
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/refresh-token` - Renew access token

### **Posts Module**
- `GET /api/v1/posts` - Get paginated feed (Cursor-based, merged with Redis stats)
- `POST /api/v1/posts` - Create new post (Optional media)
- `GET /api/v1/posts/:id` - Get single post (With real-time stats)
- `PATCH /api/v1/posts/:id` - Update post content
- `DELETE /api/v1/posts/:id` - Remove post

### **Comments Module**
- `GET /api/v1/comments/post/:postId` - List comments for a post
- `POST /api/v1/comments` - Create comment or reply
- `DELETE /api/v1/comments/:id` - Delete comment

### **Likes Module**
- `POST /api/v1/likes/toggle` - Atomic like/unlike toggle

### **Upload Module**
- `POST /api/v1/upload` - Secure Cloudinary media upload (Optional file support)

---

## 🧪 Testing & Deployment

- **Swagger Documentation**: Access `http://localhost:3000/docs` while the server is running.
- **Unit Tests**: `npm run test`
- **E2E Tests**: `npm run test:e2e`
- **Build**: `npm run build`

---

## 🛡 Security & Reliability
- **Rate Limiting**: 100 requests per 60 seconds (Global).
- **Global Filters**: Standardized error responses to prevent sensitive data leakage.
- **Transaction Safety**: All social interactions (likes/counts) are wrapped in database transactions.

---

## 🤝 Contributing
Please read the root `CONTRIBUTING.md` for details on our code of conduct and the process for submitting pull requests.

---

## 📄 License
This project is licensed under the MIT License.
