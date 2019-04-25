# Very basic image for building nbin target for alpine
# Eventually should be automated within the CI
FROM node:10.15.1-alpine

RUN apk update
RUN apk add bash
RUN apk add gcc
RUN apk add g++
RUN apk add ccache
RUN apk add git
RUN apk add make
RUN apk add python
RUN apk add linux-headers
