# Debian Target - only for ARM builds.
# DO NOT USE THIS AS A TARGET FOR x86!
FROM ubuntu:18.04

RUN apt update && \
    apt install -y build-essential g++ gcc linux-headers-generic
