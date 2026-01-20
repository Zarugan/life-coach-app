# Life Coach App - Production Dockerfile
# Multi-stage build for optimal image size and security

# Build Stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production Stage
FROM nginx:alpine AS production

# Install additional tools for monitoring
RUN apk add --no-cache curl

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

# Expose port 80
EXPOSE 80

# Set labels for metadata
LABEL maintainer="Life Coach App Team"
LABEL version="1.0.0"
LABEL description="AI-powered multi-agent life coaching platform"

# Start nginx
CMD ["nginx", "-g", "daemon off;"]