FROM mcr.microsoft.com/dotnet/sdk:8.0 AS rules
WORKDIR /src
COPY UnityCard_demo/Assets/Scripts/Core/ UnityCard_demo/Assets/Scripts/Core/
COPY UnityCard_demo/Tools/GachaService/ UnityCard_demo/Tools/GachaService/
RUN dotnet publish UnityCard_demo/Tools/GachaService -c Release -o /rules

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM mcr.microsoft.com/dotnet/runtime:8.0-bookworm-slim
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
COPY package.json railway-server.js db.js db-postgres.js account-routes.js gacha-service.js ./
COPY *.html *.css *.js ./
COPY UnityCard_demo/Assets/Resources/Config/gacha-demo.json ./UnityCard_demo/Assets/Resources/Config/gacha-demo.json
COPY UnityCard_demo/Assets/Resources/Data/web-card-catalog.json ./UnityCard_demo/Assets/Resources/Data/web-card-catalog.json
COPY UnityCard_demo/Tools/GachaDemo/wwwroot ./UnityCard_demo/Tools/GachaDemo/wwwroot
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=rules /rules /app/gacha-runtime
ENV GACHA_SERVICE_DLL=/app/gacha-runtime/GachaService.dll
CMD ["node", "railway-server.js"]
