# WAB - WhatsApp Business Dashboard

A real-time WhatsApp Business messaging dashboard built with React, Express, MongoDB, and Socket.IO.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Shadcn/UI, TanStack Query, Socket.IO Client
- **Backend:** Node.js, Express, TypeScript, Mongoose, Socket.IO, JWT Auth
- **Database:** MongoDB
- **Process Manager:** PM2
- **Reverse Proxy:** Nginx

## Prerequisites

- Node.js v20+
- npm v10+
- MongoDB 7.0+
- Nginx (for production)
- PM2 (for production)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/visaduk/WAB.git
cd WAB
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Server
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/wab
JWT_SECRET=replace-with-a-secure-random-string-32-chars-min
JWT_EXPIRES_IN=7d

# WhatsApp Business API
WA_PHONE_NUMBER_ID=your_phone_number_id
WA_BUSINESS_ACCOUNT_ID=your_business_account_id
WA_ACCESS_TOKEN=your_access_token
WA_API_VERSION=v22.0
WA_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# CORS - comma-separated origins
CLIENT_URL=http://localhost:5173
```

Create `chatclone-react/.env` for the frontend:

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

> **For production** behind a reverse proxy (e.g. at `/elwtapp/`), use relative paths instead:
> ```env
> VITE_API_URL=/elwtapp/api
> VITE_SOCKET_URL=https://your-domain.com
> ```
> And add your domain to `CLIENT_URL` in the root `.env`:
> ```env
> CLIENT_URL=http://localhost:5173,https://your-domain.com
> ```

### 4. Start MongoDB

```bash
sudo systemctl start mongod
sudo systemctl enable mongod   # auto-start on boot
```

## Running

### Development

```bash
npm run dev
```

This starts both the backend (port 3001) and frontend (port 5173) concurrently.

You can also run them individually:

```bash
npm run server   # backend only
npm run client   # frontend only
```

### Production

Build and start with PM2:

```bash
npm run build
pm2 start ecosystem.config.cjs
```

### Nginx Configuration (Production)

Example config for serving at `/elwtapp/` behind Nginx with SSL:

```nginx
server {
    server_name your-domain.com;
    client_max_body_size 20M;

    location /elwtapp/ {
        proxy_pass http://localhost:5173/elwtapp/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /elwtapp/api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /elwtapp/socket.io/ {
        proxy_pass http://localhost:3001/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

## Project Structure

```
WAB/
├── chatclone-react/     # React frontend (Vite + Shadcn/UI)
│   └── src/
├── server/              # Express backend
│   └── src/
│       ├── config/      # DB, env, socket config
│       ├── controllers/ # Route handlers
│       ├── middleware/   # Auth, error middleware
│       ├── models/      # Mongoose models
│       ├── routes/      # API routes
│       └── utils/       # Logger, helpers
├── ecosystem.config.cjs # PM2 config
├── nginx.conf           # Nginx reference config
└── package.json         # Workspace root
```

## API Routes

| Route | Description |
|---|---|
| `/api/auth` | Authentication (register, login) |
| `/api/conversations` | Conversation management |
| `/api/messages` | Send/receive messages |
| `/api/contacts` | Contact management |
| `/api/templates` | WhatsApp message templates |
| `/api/media` | Media upload/download |
| `/api/webhook` | WhatsApp webhook endpoint |
| `/api/users` | User management |
| `/api/health` | Health check |
