# Stage 1: Build the application with Node.js
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build   # Creates optimized static assets in /app/build

# Stage 2: Serve the application with a tiny Nginx image
FROM scratch
COPY --from=builder /app/dist /dist