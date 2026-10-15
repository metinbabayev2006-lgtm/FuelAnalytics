package de.fuelanalytics.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest
class BackendApplicationTests {

	@Autowired
	JdbcTemplate jdbc;

	@Test
	void contextLoads() {
		assertEquals(0L, jdbc.queryForObject("SELECT COUNT(*) FROM station", Long.class));
	}

}
