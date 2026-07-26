# Build de produccion multi-stage. Tag inmutable en CI, ej:
#   docker build -t manufactoo-backend:0.1.0 -f backend/Dockerfile backend
FROM maven:3.9-eclipse-temurin-25 AS build
WORKDIR /build
COPY pom.xml ./
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN addgroup --system manufactoo && adduser --system --ingroup manufactoo manufactoo
COPY --from=build /build/target/manufactoo-backend.jar app.jar
USER manufactoo
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
