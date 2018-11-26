FROM node:10.13.0-alpine as base

# Create working dir
RUN mkdir -p /home/app
WORKDIR /home/app

RUN apk add --update --no-cache libc6-compat

# ---------------------------------

FROM base as builder

ADD package.json package-lock.json /home/app/

# Install npm deps
RUN npm install --production --unsafe-perm --quiet

# ---------------------------------

FROM base as runtime

COPY index.js package.json /home/app/
COPY --from=builder /home/app/node_modules /home/app/node_modules

ENTRYPOINT [ "npm", "--loglevel=silent", "run" ]

EXPOSE 80
