FROM nginx:alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx config
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf

# Copy static frontend files
COPY map-app/ /usr/share/nginx/html/map/
COPY libraries/rhpl/findit-rhpl.js /usr/share/nginx/html/widget.js
COPY maps/ /usr/share/nginx/html/maps/

# Copy entrypoint script
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
