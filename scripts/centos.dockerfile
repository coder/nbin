FROM centos:6

RUN yum update -y \
	&& yum install -y epel-release yum-utils centos-release-scl-rh \
	&& yum-config-manager --enable rhel-server-rhscl-6-rpms \
	&& yum update -y

RUN yum install -y \
		devtoolset-6 \
    gcc-c++ \
    python27 \
    xz \
    ccache \
		git

RUN mkdir /root/node \
  && cd /root/node \
  && curl https://nodejs.org/dist/v10.15.1/node-v10.15.1-linux-x64.tar.xz | tar xJ --strip-components=1 -- \
  && ln -s /root/node/bin/node /usr/bin/node

ENV PATH "$PATH:/root/node/bin"

RUN npm install -g yarn
