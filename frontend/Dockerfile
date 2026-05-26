# Stage 1: Build React SPA
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY index.html ./
COPY src ./src

RUN npm run build

# Stage 2: Serve static files with nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
