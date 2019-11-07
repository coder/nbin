# WARNING: This requires qemu-user-static.
# Please grab that docker image first before building it on a x86 host!

FROM raspbian/jessie:latest

ENV PATH "$PATH:/root/node/bin"

RUN apt-get update && \
    apt-get install build-essential;

RUN mkdir -p /root/node && \
    cd /root/node && curl https://nodejs.org/dist/v10.15.3/node-v10.15.3-linux-x64.tar.xz | tar xJ --strip-components=1 -- && \
    ln -s /root/node/bin/node /usr/bin/node && \
    npm i -g yarn;