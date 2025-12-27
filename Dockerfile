# Usar una versión específica de Node que funciona mejor con Angular
FROM node:20.15.1 AS build

WORKDIR /app

# Instalar npm específico
RUN npm install -g npm@10.7.0

COPY package*.json ./

# Configurar npm para manejar dependencias conflictivas

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Build con verbose para ver más detalles si falla
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist/finanzas-mf/browser/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
