<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Social Feed Application

This repository contains a full-stack social feed application built with **React.js/Next.js** for the frontend and **NestJS + Prisma + PostgreSQL** for the backend. The system supports authentication, posts, comments, likes, and private/public post visibility, designed for scalability and performance.

---

## Features

### Authentication
- User registration and login (JWT-based authentication)
- Profile management
- Protected routes for feed access

### Feed
- Create, update, and delete posts
- Upload text and images with posts
- Private and public posts
- View posts from all users with newest first
- Like/unlike posts, comments, and replies
- Nested comments and replies with like/unlike system
- Shows which users liked a post, comment, or reply

### Backend
- Scalable service design with Redis caching for feed
- Optimized for high read/write performance
- Proper validation and authorization
- Comprehensive Swagger API documentation

---

## Project Structure


---

## Deliverables

- **GitHub Repository:** [Insert your repository link here]  
- **Video Walkthrough:** [Insert YouTube link here, unlisted/private]  
- **Live Deployment (if available):** [Insert live app URL here]  

---

## Decisions & Notes

- Used **Redis caching** for feed to reduce DB load and improve performance.  
- Implemented **per-user caching** for first page of feed for scalability.  
- Nested replies and likes designed for efficient aggregation and minimal API calls.  
- All routes protected with JWT; authorization enforced at service level.  
- Database modeled for millions of posts and interactions, optimized for reads/writes.  

---

## Getting Started

### Backend
```bash
cd backend
npm install
npm run start:dev