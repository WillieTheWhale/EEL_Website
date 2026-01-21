# E.E.L. Application Portal
# Optimized for Red Hat OpenShift deployment

FROM node:20-alpine

# Create app directory
WORKDIR /app

# OpenShift runs containers as non-root by default
# Create directories and set permissions
RUN mkdir -p /app/backend/data /app/backend/uploads && \
    chown -R node:node /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY --chown=node:node backend/ ./backend/
COPY --chown=node:node frontend/ ./frontend/

# Switch to non-root user
USER node

# Expose port (OpenShift typically uses 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "backend/server.js"]
