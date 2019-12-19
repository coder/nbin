FROM balenalib/armv7hf-debian-node:12.14-jessie-build

RUN ["cross-build-start"]

RUN apt-get update && apt-get -y install build-essential linux-headers-3.16.0-6-all-armhf linux-headers-3.16.0-6-common gcc g++ ccache git make

RUN ["cross-build-end"]
