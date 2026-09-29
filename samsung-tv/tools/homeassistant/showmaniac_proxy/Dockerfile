# set by the Supervisor from build.yaml, the default is for a Raspberry Pi
ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM $BUILD_FROM

# ffmpeg repackages fMP4 streams to MPEG-TS, which the TV can play
RUN apk add --no-cache nodejs ffmpeg

# proxy.mjs is copied here from samsung-tv/tools by tools/homeassistant/install.sh
COPY proxy.mjs /proxy.mjs

CMD ["node", "/proxy.mjs"]
