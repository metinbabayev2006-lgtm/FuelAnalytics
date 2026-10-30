package de.fuelanalytics.backend.service;

import de.fuelanalytics.backend.model.FuelType;
import de.fuelanalytics.backend.repository.ArchiveHistoryRepository;
import java.util.List;
import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import com.zaxxer.hikari.HikariDataSource;
import static org.junit.jupiter.api.Assertions.*;

class BundledHistoryInstallerTests {
    @Test void fullPresentationBundleWorksOnAnEmptyDatabaseAndSecondStartPreservesExistingData() {
        verify(false);
    }
    @Test @EnabledIfSystemProperty(named="bundle.postgres",matches="true")
    void fullBundleWorksOnRealPostgresInAnIsolatedDisposableSchema() { verify(true); }
    private void verify(boolean postgres) {
        var source=new HikariDataSource();
        String schema="bundle_check_"+UUID.randomUUID().toString().replace("-","");
        if(postgres) {
            var properties=new java.util.Properties();
            try(var reader=java.nio.file.Files.newBufferedReader(java.nio.file.Path.of("../.env"))) { properties.load(reader); }
            catch(java.io.IOException e) { throw new IllegalStateException("Local PostgreSQL test requires the ignored .env",e); }
            String url=properties.getProperty("DB_URL","jdbc:postgresql://127.0.0.1:5433/fuelanalytics");
            source.setJdbcUrl(url+(url.contains("?")?"&":"?")+"currentSchema="+schema+"&reWriteBatchedInserts=true");
            source.setUsername(properties.getProperty("DB_USER","fuelanalytics"));
            source.setPassword(properties.getProperty("POSTGRES_PASSWORD"));
        } else {
            source.setJdbcUrl("jdbc:h2:mem:bundle-"+UUID.randomUUID()+";MODE=PostgreSQL;DB_CLOSE_DELAY=-1");
            source.setUsername("sa"); source.setPassword("");
        }
        source.setMaximumPoolSize(4);
        var jdbc=new JdbcTemplate(source);
        if(postgres) jdbc.execute("CREATE SCHEMA "+schema);
        var flyway=Flyway.configure().dataSource(source);
        if(postgres) flyway.schemas(schema).defaultSchema(schema);
        flyway.load().migrate();
        var installer=new BundledHistoryInstaller(jdbc,new DataSourceTransactionManager(source),true);
        try {
            installer.install();
            assertEquals(734607,jdbc.queryForObject("SELECT COUNT(*) FROM archive_daily_price",Integer.class));
            assertEquals(673,jdbc.queryForObject("SELECT COUNT(*) FROM archive_station",Integer.class));
            assertEquals(21461,jdbc.queryForObject("SELECT COUNT(*) FROM historical_monthly_price",Integer.class));
            assertEquals(0,jdbc.queryForObject("SELECT COUNT(*) FROM price_observation",Integer.class));
            var repository=new ArchiveHistoryRepository(jdbc);
            assertEquals("2025-10-01",repository.status().periodStart().toString());
            for(String city:List.of("Berlin","München","Frankfurt am Main","Köln","Detmold")) {
                var stations=repository.stations(city,FuelType.e10,0);
                assertFalse(stations.entries().isEmpty(),city);
                var series=repository.history(FuelType.e10,List.of(stations.entries().getFirst().id()));
                assertEquals(12,series.series().getFirst().points().size());
            }
            jdbc.update("UPDATE archive_station SET name='Local preserved name'");
            installer.install();
            assertEquals(673,jdbc.queryForObject("SELECT COUNT(*) FROM archive_station WHERE name='Local preserved name'",Integer.class));
            assertEquals(734607,jdbc.queryForObject("SELECT COUNT(*) FROM archive_daily_price",Integer.class));
        } finally { jdbc.execute(postgres?"DROP SCHEMA "+schema+" CASCADE":"DROP ALL OBJECTS"); source.close(); }
    }
}
