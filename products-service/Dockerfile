FROM eclipse-temurin:25-jdk

WORKDIR /app

# Optional, but helpful tools

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl bash \
    && rm -rf /var/lib/apt/lists/*

# First, copy only the Maven wrapper + pom file (for better layer caching)
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Pre-fetch deps (speeds up first run; will use cache volume too)
RUN chmod +x mvnw && ./mvnw -q -DskipTests dependency:go-offline

# Copy source (bind mount will override in dev)
COPY /src /src

EXPOSE 8080

CMD [ "./mvnw", "spring-boot:run" ]