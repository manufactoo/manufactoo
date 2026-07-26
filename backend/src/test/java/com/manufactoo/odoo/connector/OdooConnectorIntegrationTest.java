package com.manufactoo.odoo.connector;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Se ejecuta en CI contra Odoo 18 Y 19 (ver .github/workflows/ci.yml,
 * matrix.odoo-version), nunca solo contra una version. En local, se
 * salta automaticamente si no hay una instancia Odoo de pruebas
 * configurada via variables de entorno ODOO_TEST_*.
 */
class OdooConnectorIntegrationTest {

    @Test
    void detectsExpectedVersionAndAuthenticates() {
        String host = System.getenv("ODOO_TEST_HOST");
        assumeTrue(host != null && !host.isBlank(), "ODOO_TEST_HOST no configurado, se salta el test de integracion");

        int port = Integer.parseInt(System.getenv().getOrDefault("ODOO_TEST_PORT", "8069"));
        String database = System.getenv("ODOO_TEST_DATABASE");
        String username = System.getenv("ODOO_TEST_USERNAME");
        String password = System.getenv("ODOO_TEST_PASSWORD");
        String expectedMajor = System.getenv().getOrDefault("ODOO_TEST_EXPECTED_MAJOR_VERSION", "")
                .replace(".0", "");

        OdooConnectorFactory factory = new OdooConnectorFactory();
        OdooConnector connector = factory.connect(host, port);

        assertNotNull(connector.version());
        if (!expectedMajor.isBlank()) {
            assertEquals(Integer.parseInt(expectedMajor), connector.version().majorVersion());
        }

        Integer uid = connector.authenticate(database, username, password);
        assertNotNull(uid, "La autenticacion contra Odoo " + connector.version().serverSerie() + " deberia devolver un uid");
    }
}
