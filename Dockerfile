FROM node:18-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# These are public, non-secret API endpoints inlined at build time via
# $env/static/public - override with --build-arg if Real-Debrid/Torrentio
# ever change their URLs.
ARG PUBLIC_BASE_URI="https://api.real-debrid.com/rest/1.0"
ARG PUBLIC_BASE_AUTH_URI="https://api.real-debrid.com"
ARG PUBLIC_CLIENT_ID="X245A4XAIBGVM"
ARG PUBLIC_TORRENTIO_BASE_URI="https://torrentio.strem.fun"
ENV PUBLIC_BASE_URI=$PUBLIC_BASE_URI
ENV PUBLIC_BASE_AUTH_URI=$PUBLIC_BASE_AUTH_URI
ENV PUBLIC_CLIENT_ID=$PUBLIC_CLIENT_ID
ENV PUBLIC_TORRENTIO_BASE_URI=$PUBLIC_TORRENTIO_BASE_URI

RUN pnpm run build
RUN pnpm prune --prod

FROM node:18-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

EXPOSE 3000
CMD ["node", "build/index.js"]
