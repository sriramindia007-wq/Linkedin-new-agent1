FROM mcr.microsoft.com/playwright:v1.42.0-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=3000
ENV NODE_ENV=production
ENV HEADLESS_BROWSER=true

EXPOSE 3000

CMD ["node", "server_standalone.js"]
