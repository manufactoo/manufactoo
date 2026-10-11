package com.manufactoo.masterdata;

import com.manufactoo.odoo.connector.OdooMasterDataEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Solo lectura: expone en vivo (sin persistir) los datos maestros de Odoo
 * que necesita el MES. Cada endpoint hace una llamada JSON-RPC search_read
 * distinta contra el modelo Odoo correspondiente (ver AbstractOdooConnector).
 */
@RestController
@RequestMapping("/api/master-data")
public class MasterDataController {

    private final MasterDataService service;

    public MasterDataController(MasterDataService service) {
        this.service = service;
    }

    @GetMapping("/products")
    public List<Map<String, Object>> products(@RequestParam(defaultValue = "50") int limit,
                                                @RequestParam(defaultValue = "0") int offset) {
        return service.list(OdooMasterDataEntity.PRODUCT, limit, offset);
    }

    @GetMapping("/boms")
    public List<Map<String, Object>> boms(@RequestParam(defaultValue = "50") int limit,
                                           @RequestParam(defaultValue = "0") int offset) {
        return service.list(OdooMasterDataEntity.BOM, limit, offset);
    }

    @GetMapping("/manufacturing-orders")
    public List<Map<String, Object>> manufacturingOrders(@RequestParam(defaultValue = "50") int limit,
                                                           @RequestParam(defaultValue = "0") int offset) {
        return service.list(OdooMasterDataEntity.MANUFACTURING_ORDER, limit, offset);
    }

    @GetMapping("/operators")
    public List<Map<String, Object>> operators(@RequestParam(defaultValue = "50") int limit,
                                                 @RequestParam(defaultValue = "0") int offset) {
        return service.list(OdooMasterDataEntity.OPERATOR, limit, offset);
    }

    @GetMapping("/serials")
    public List<Map<String, Object>> serials(@RequestParam(defaultValue = "50") int limit,
                                               @RequestParam(defaultValue = "0") int offset) {
        return service.list(OdooMasterDataEntity.SERIAL, limit, offset);
    }

    @GetMapping("/workcenters")
    public List<Map<String, Object>> workcenters(@RequestParam(defaultValue = "50") int limit,
                                                   @RequestParam(defaultValue = "0") int offset) {
        return service.list(OdooMasterDataEntity.WORKCENTER, limit, offset);
    }

    @GetMapping("/workorders")
    public List<Map<String, Object>> workorders(@RequestParam(defaultValue = "50") int limit,
                                                  @RequestParam(defaultValue = "0") int offset) {
        return service.list(OdooMasterDataEntity.WORKORDER, limit, offset);
    }
}
