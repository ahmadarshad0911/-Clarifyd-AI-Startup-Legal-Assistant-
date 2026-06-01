FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

# Production server: build once, serve the optimized output (not `next dev`).
CMD ["npm", "run", "start"]

