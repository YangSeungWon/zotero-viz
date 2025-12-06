FROM nginx:alpine

# Copy static files
COPY index.html /usr/share/nginx/html/
COPY papers.json /usr/share/nginx/html/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
