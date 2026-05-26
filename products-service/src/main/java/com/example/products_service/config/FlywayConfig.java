package com.example.products_service.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.jpa.autoconfigure.EntityManagerFactoryDependsOnPostProcessor;

@Configuration
@ConditionalOnProperty(name = "spring.flyway.enabled", havingValue = "true", matchIfMissing = true)
public class FlywayConfig {

    @Bean(initMethod = "migrate")
    @ConditionalOnMissingBean(Flyway.class)
    public Flyway flyway(DataSource dataSource) {
        return Flyway.configure().dataSource(dataSource).load();
    }

    @Bean
    public static EntityManagerFactoryDependsOnPostProcessor entityManagerFactoryDependsOnFlyway() {
        return new EntityManagerFactoryDependsOnPostProcessor("flyway");
    }
}
