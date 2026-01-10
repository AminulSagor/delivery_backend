# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY tsconfig*.json ./
COPY nest-cli.json ./
COPY src ./src
COPY scripts ./scripts

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Copy CSV file for coverage areas
COPY finalcsv-area.csv ./

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000), (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start with migration runner script
CMD ["node", "scripts/start-with-migrations.js"]
