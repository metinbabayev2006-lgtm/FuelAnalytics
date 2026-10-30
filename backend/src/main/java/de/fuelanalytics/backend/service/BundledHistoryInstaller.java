package de.fuelanalytics.backend.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.GZIPInputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Installs the versioned presentation snapshot once, never replacing existing histories. */
@Component
public class BundledHistoryInstaller implements ApplicationRunner {
    private static final Logger LOG=LoggerFactory.getLogger(BundledHistoryInstaller.class);
    private static final String ROOT="bundled-history/";
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transaction;
    private final boolean enabled;
    private final ObjectMapper json=new ObjectMapper();
    private record Table(String columns,String types,boolean station) { }
    private static final Map<String,Table> TABLES=Map.of(
        "archive_station",new Table("id,name,city,address","usss",true),
        "archive_import",new Table("id,period_start,period_end,source_url,license_url,manifest_sha256,downloaded_days,cities","iddsssis",false),
        "archive_daily_price",new Table("station_id,reference_day,fuel_type,price_seconds,known_seconds,total_seconds","udsnii",false),
        "historical_station",new Table("id,name,city,address","usss",true),
        "historical_monthly_import",new Table("import_year,source_url,dataset_version,license_url,prices_sha256,stations_sha256,excluded_values,unmatched_rows,outside_year_rows","isisssiii",false),
        "historical_monthly_price",new Table("station_id,reference_month,fuel_type,mean_price,import_year","udsni",false)
    );
    public BundledHistoryInstaller(JdbcTemplate jdbc,PlatformTransactionManager manager,
            @Value("${fuelanalytics.bundled-history.enabled:true}") boolean enabled) {
        this.jdbc=jdbc; this.transaction=new TransactionTemplate(manager); this.enabled=enabled;
    }
    @Override public void run(ApplicationArguments args) { if(enabled) install(); }
    public void install() {
        transaction.executeWithoutResult(status -> {
            jdbc.queryForObject("SELECT id FROM bundled_history_state WHERE id=1 FOR UPDATE",Integer.class);
            boolean archive=jdbc.queryForObject("SELECT COUNT(*) FROM archive_import",Long.class)==0;
            boolean monthly=jdbc.queryForObject("SELECT COUNT(*) FROM historical_monthly_import WHERE import_year=2022",Long.class)==0;
            if(!archive && !monthly) { LOG.info("Existing historical data retained; bundled snapshot not needed"); return; }
            try(var input=new ClassPathResource(ROOT+"manifest.json").getInputStream()) {
                var manifest=json.readTree(input);
                if(manifest.path("format").asInt()!=1) throw new IllegalStateException("Unsupported bundled history format");
                if(archive) importDataset(manifest.path("archive"),"archive.jsonl.gz",true);
                if(monthly) importDataset(manifest.path("monthly"),"kaggle-2022.jsonl.gz",false);
                LOG.info("Bundled historical data ready; personal observations unchanged");
            } catch(Exception e) { throw new IllegalStateException("Bundled history import failed and was rolled back. Check the package and restart the backend.",e); }
        });
    }
    private void importDataset(JsonNode metadata,String filename,boolean archive) throws Exception {
        if(!filename.equals(metadata.path("file").asText())) throw new IllegalStateException("Unexpected snapshot filename");
        var resource=new ClassPathResource(ROOT+filename);
        var digest=MessageDigest.getInstance("SHA-256");
        try(var input=new DigestInputStream(resource.getInputStream(),digest)) { input.transferTo(java.io.OutputStream.nullOutputStream()); }
        String checksum=HexFormat.of().formatHex(digest.digest());
        if(!checksum.equals(metadata.path("sha256").asText())) throw new IllegalStateException("Snapshot checksum mismatch");
        LOG.info("Installing {} (first start only; this can take a moment)",filename);
        var counts=new HashMap<String,Integer>();
        String current=null; var batch=new ArrayList<List<String>>(1000);
        try(var reader=new BufferedReader(new InputStreamReader(new GZIPInputStream(resource.getInputStream()),StandardCharsets.UTF_8))) {
            String line;
            while((line=reader.readLine())!=null) {
                var entry=json.readTree(line);
                if(!entry.isArray() || entry.size()!=2 || !entry.get(1).isArray()) throw new IllegalStateException("Malformed snapshot record");
                String table=entry.get(0).asText(); var definition=TABLES.get(table);
                if(definition==null || archive!=table.startsWith("archive_")) throw new IllegalStateException("Unexpected snapshot table");
                if(entry.get(1).size()!=definition.types().length()) throw new IllegalStateException("Unexpected snapshot columns");
                if(current!=null && !current.equals(table)) { write(current,batch); batch.clear(); }
                current=table; var values=new ArrayList<String>();
                for(var value:entry.get(1)) { if(!value.isTextual()) throw new IllegalStateException("Expected snapshot text field"); values.add(value.asText()); }
                batch.add(values); counts.merge(table,1,Integer::sum);
                if(batch.size()==1000) { write(current,batch); batch.clear(); }
            }
        }
        if(current!=null) write(current,batch);
        if(counts.size()!=3) throw new IllegalStateException("Incomplete snapshot tables");
        for(var entry:counts.entrySet()) if(entry.getValue()!=metadata.path("rows").path(entry.getKey()).asInt(-1)) throw new IllegalStateException("Snapshot row count mismatch");
        jdbc.update("UPDATE bundled_history_state SET "+(archive?"archive_sha256":"monthly_sha256")+"=?,installed_at=CURRENT_TIMESTAMP WHERE id=1",checksum);
        LOG.info("Installed {}: {}",filename,counts);
    }
    private void write(String name,List<List<String>> rows) {
        if(rows.isEmpty()) return;
        var table=TABLES.get(name);
        String placeholders=String.join(",",java.util.Collections.nCopies(table.types().length(),"?"));
        String sql="INSERT INTO "+name+" ("+table.columns()+") "+(table.station()?"SELECT "+placeholders+" WHERE NOT EXISTS (SELECT 1 FROM "+name+" WHERE id=?)":"VALUES ("+placeholders+")");
        jdbc.batchUpdate(sql,rows,1000,(statement,row)-> {
            for(int i=0;i<row.size();i++) bind(statement,i+1,row.get(i),table.types().charAt(i));
            if(table.station()) statement.setObject(row.size()+1,UUID.fromString(row.getFirst()));
        });
    }
    private void bind(PreparedStatement statement,int index,String value,char type) throws SQLException {
        switch(type) {
            case 'u' -> statement.setObject(index,UUID.fromString(value));
            case 'd' -> statement.setDate(index,Date.valueOf(value));
            case 'i' -> statement.setInt(index,Integer.parseInt(value));
            case 'n' -> statement.setBigDecimal(index,new BigDecimal(value));
            default -> statement.setString(index,value);
        }
    }
}
