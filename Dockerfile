# E.E.L. Application Portal
# Optimized for Red Hat OpenShift deployment

FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files from website directory
COPY website/package*.json ./

# Install dependencies (production only)
RUN npm ci --omit=dev && npm cache clean --force

# Copy application code
COPY website/backend/ ./backend/
COPY website/index.html website/styles.css website/script.js website/mobile.js ./
COPY website/application.html website/application.css website/application.js ./
COPY website/EEL_Logo.png website/EEL_Logo.svg ./
COPY website/favicon.ico website/favicon.png website/apple-touch-icon.png ./
COPY website/headshots/ ./headshots/
COPY website/modules/ ./modules/
COPY website/vision-pro.html ./

# OpenShift runs containers as an arbitrary non-root UID in group 0.
# Set ownership and group-write permissions AFTER all COPY steps so
# the writable directories (data, uploads) are accessible at runtime.
RUN chown -R node:0 /app && \
    chmod -R g=u /app/backend/data && \
    chmod -R g=u /app/backend/uploads

# Switch to non-root user
USER node

# Expose port (OpenShift typically uses 8080)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["node", "backend/server.js"]
