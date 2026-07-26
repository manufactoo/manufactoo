package com.manufactoo.masterdata;

import com.manufactoo.crypto.CryptoService;
import com.manufactoo.odoo.OdooConnection;
import com.manufactoo.odoo.OdooConnectionRepository;
import com.manufactoo.odoo.connector.OdooConnector;
import com.manufactoo.odoo.connector.OdooConnectorFactory;
import com.manufactoo.odoo.connector.OdooJsonRpcException;
import com.manufactoo.odoo.connector.OdooMasterDataEntity;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Lee datos maestros (productos, BOMs, ordenes de trabajo, operarios)
 * directamente de Odoo via JSON-RPC en cada peticion. Manufactoo NUNCA
 * replica ni cachea esta informacion en su propia BBDD: Odoo es la unica
 * fuente de verdad, siempre se accede a traves de su interfaz RPC.
 */
@Service
public class MasterDataService {

    private final OdooConnectionRepository odooConnectionRepository;
    private final CryptoService cryptoService;
    private final OdooConnectorFactory connectorFactory;

    public MasterDataService(OdooConnectionRepository odooConnectionRepository, CryptoService cryptoService,
                              OdooConnectorFactory connectorFactory) {
        this.odooConnectionRepository = odooConnectionRepository;
        this.cryptoService = cryptoService;
        this.connectorFactory = connectorFactory;
    }

    public List<Map<String, Object>> list(OdooMasterDataEntity entity, int limit, int offset) {
        OdooConnection connection = odooConnectionRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No hay conexion Odoo configurada todavia. Completa Configuracion > Conexion Odoo."));

        String apiKeyOrPassword = cryptoService.decrypt(connection.getApiKeyEncrypted());

        OdooConnector connector;
        Integer uid;
        try {
            connector = connectorFactory.connect(connection.getHost(), connection.getPort());
            uid = connector.authenticate(connection.getDatabase(), connection.getUsername(), apiKeyOrPassword);
        } catch (OdooJsonRpcException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No se pudo conectar con Odoo: " + e.getMessage());
        }
        if (uid == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "No se pudo autenticar en Odoo con las credenciales guardadas. Revisa Configuracion > Conexion Odoo.");
        }

        try {
            return connector.listMasterData(entity, connection.getDatabase(), uid, apiKeyOrPassword, limit, offset);
        } catch (OdooJsonRpcException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Error leyendo datos de Odoo: " + e.getMessage());
        }
    }
}
