FROM centos:7

RUN yum update -y \
  && yum install -y epel-release centos-release-scl \
  && yum-config-manager --enable rhel-server-rhscl-7-rpms \
  && yum update -y

RUN yum install -y \
  devtoolset-6 \
  gcc-c++ \
  xz \
  ccache \
  git \
  wget

RUN mkdir /root/node \
  && cd /root/node \
  && curl https://nodejs.org/dist/v12.14.0/node-v12.14.0-linux-x64.tar.xz | tar xJ --strip-components=1 -- \
  && ln -s /root/node/bin/node /usr/bin/node

ENV PATH "$PATH:/root/node/bin"

RUN npm install -g yarn
