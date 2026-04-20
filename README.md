# Tailor Management System

This is now a proper JavaScript full-stack project based on your PDF requirements:

- frontend: React + Vite
- backend: Node.js + Express
- database: MongoDB + Mongoose

## Features

- basic tailor login
- customer management
- digital measurements
- order creation
- order status tracking
- delivery queue
- payment history and balance tracking
- seeded demo data

## Project Structure

- [package.json](/Users/sachintanuboddi/Documents/New project/tms/package.json:1): root scripts and dependencies
- [server/index.js](/Users/sachintanuboddi/Documents/New project/tms/server/index.js:1): Express server and API setup
- [server/data/seed.js](/Users/sachintanuboddi/Documents/New project/tms/server/data/seed.js:1): demo data seeding
- [client/src/App.jsx](/Users/sachintanuboddi/Documents/New project/tms/client/src/App.jsx:1): main React UI
- [client/src/styles.css](/Users/sachintanuboddi/Documents/New project/tms/client/src/styles.css:1): app styling

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start MongoDB in one terminal:

```bash
npm run mongo
```

3. Start the app in another terminal:

```bash
npm run dev
```

4. Open:

```text
http://127.0.0.1:5173
```

## Demo Login

- username: `admin`
- password: `admin123`

## Environment

Copy `.env.example` to `.env` if you want to override defaults.

Default Mongo URL:

```text
mongodb://127.0.0.1:27017/tailor_management_system
```
