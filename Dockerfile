# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY index.html vite.config.js ./
COPY src ./src
COPY scripts ./scripts
COPY public ./public

# The active scene is a single validated Blender GLB. Do not split or rebuild
# it in the image, which could break embedded material and texture references.
RUN npm run build \
    && test -f dist/models/tour-v2/uzuncarsi-ktx2.glb

FROM nginx:1.30-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
