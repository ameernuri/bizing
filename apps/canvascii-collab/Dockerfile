FROM node:20-bookworm-slim

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/canvascii-collab/package.json ./apps/canvascii-collab/package.json
COPY packages/canvascii-core/package.json ./packages/canvascii-core/package.json

RUN pnpm install --frozen-lockfile

COPY apps/canvascii-collab ./apps/canvascii-collab
COPY packages/canvascii-core ./packages/canvascii-core

CMD ["pnpm", "--filter", "@bizing/canvascii-collab", "start"]
