# Stage 1: Build the application with Node.js
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build   # Creates optimized static assets in /app/build

CMD ["sh", "-c", "cp -r /app/dist/* /dist && echo Build completed"]