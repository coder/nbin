FROM balenalib/armv7hf-alpine-node:10.15-edge-build

RUN ["cross-build-start"]

RUN apk update
RUN apk add bash
RUN apk add gcc
RUN apk add g++
RUN apk add ccache
RUN apk add git
RUN apk add make
RUN apk add python
RUN apk add linux-headers

RUN ["cross-build-end"]