FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_NOWCAST_API_URL=http://localhost:8000/api/v1
ENV VITE_NOWCAST_API_URL=$VITE_NOWCAST_API_URL
RUN npm run build
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server { listen 80; root /usr/share/nginx/html; index index.html; location / { try_files $uri /index.html; } }
EOF
