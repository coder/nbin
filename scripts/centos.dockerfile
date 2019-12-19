FROM centos:7

RUN yum install -y centos-release-scl
RUN yum-config-manager --enable rhel-server-rhscl-7-rpms
RUN yum install -y devtoolset-6
RUN yum install -y gcc-c++
RUN yum install -y git
RUN rpm -Uvh http://dl.fedoraproject.org/pub/epel/7/x86_64/Packages/c/ccache-3.3.4-1.el7.x86_64.rpm

RUN mkdir /root/node
RUN cd /root/node && curl https://nodejs.org/dist/v12.14.0/node-v12.14.0-linux-x64.tar.xz | tar xJ --strip-components=1 --
RUN ln -s /root/node/bin/node /usr/bin/node
ENV PATH "$PATH:/root/node/bin"
RUN npm install -g yarn
