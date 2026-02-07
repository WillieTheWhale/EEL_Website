FROM nginx:1.27-alpine

# Copy custom nginx config for OpenShift compatibility (non-root, port 8080)
COPY nginx.conf /etc/nginx/nginx.conf

# Copy website files to nginx html directory
COPY website/ /usr/share/nginx/html/

# Remove dev-only files that shouldn't be served
RUN rm -rf /usr/share/nginx/html/node_modules \
           /usr/share/nginx/html/package.json \
           /usr/share/nginx/html/package-lock.json \
           /usr/share/nginx/html/.DS_Store \
           /usr/share/nginx/html/scale-test*.png

# OpenShift runs containers as an arbitrary non-root UID.
# Adjust file ownership and directory permissions so nginx can
# write its pid file, cache, and temp files under any UID.
RUN chown -R 1001:0 /usr/share/nginx/html && \
    chmod -R g=u /usr/share/nginx/html && \
    chown -R 1001:0 /var/cache/nginx && \
    chmod -R g=u /var/cache/nginx && \
    chown -R 1001:0 /var/log/nginx && \
    chmod -R g=u /var/log/nginx && \
    # nginx.pid needs to be writable
    touch /var/run/nginx.pid && \
    chown 1001:0 /var/run/nginx.pid && \
    chmod g=u /var/run/nginx.pid

EXPOSE 8080

USER 1001

CMD ["nginx", "-g", "daemon off;"]
