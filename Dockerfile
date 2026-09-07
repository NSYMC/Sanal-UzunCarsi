# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY index.html vite.config.js ./
COPY src ./src
COPY scripts ./scripts
COPY tests ./tests
COPY public ./public
# Büyük sahne GLB'leri depoda parçalar hâlinde durur; prebuild bu parçalardan
# birleştirir, dolayısıyla parçalar build context'te bulunmak zorunda.
COPY runtime-assets ./runtime-assets

# Runtime assets are assembled and validated by the Vite prebuild pipeline.
RUN npm run build \
    && npm run check \
    && test -f dist/models/selection/selection-world.glb \
    && test -f dist/models/world/outside.glb \
    && test -f dist/models/nisantasi/store-raw.glb \
    && test -f dist/models/telefon/store-raw.glb \
    && test -f dist/models/products/guzel-optik/yesil-camli-gozluk.glb

FROM nginx:1.30-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
