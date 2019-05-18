# Very basic image for building nbin target for alpine
# Eventually should be automated within the CI
FROM node:10.15.1-alpine

RUN apk add --no-cache --no-progress bash gcc g++ ccache git make python linux-headers
