# Đón Hộ — ảnh Docker chạy production. Hướng dẫn: ../HuongDan_Deploy_DonHo_27-10-2026.md
# Debian slim (không dùng alpine) để Prisma engine chạy ổn định.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# "tools": đủ mã nguồn + devDependencies — dùng để đẩy schema và nạp dữ liệu mẫu (chạy một lần rồi thoát)
FROM deps AS tools
COPY . .
RUN npx prisma generate

FROM tools AS build
ENV NEXT_TELEMETRY_DISABLED=1 BUILD_STANDALONE=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
  && useradd --system --uid 1001 donho
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=donho /app/.next/standalone ./
COPY --from=build --chown=donho /app/.next/static ./.next/static
USER donho
EXPOSE 3000
CMD ["node", "server.js"]
