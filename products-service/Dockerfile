# Stage 1: Build fat JAR
FROM eclipse-temurin:25-jdk AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl bash \
    && rm -rf /var/lib/apt/lists/*

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -q -DskipTests dependency:go-offline

COPY src ./src
RUN ./mvnw -q -DskipTests package

# Stage 2: Minimal runtime image
FROM eclipse-temurin:25-jre

WORKDIR /app

COPY --from=builder /app/target/products-service-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
