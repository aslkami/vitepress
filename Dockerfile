FROM nginx
COPY docs/dist /etc/nginx/html
COPY conf /etc/nginx/
WORKDIR /etc/nginx/html