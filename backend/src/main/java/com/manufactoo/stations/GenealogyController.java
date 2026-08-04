package com.manufactoo.stations;

import com.manufactoo.stations.dto.GenealogyRecentPageDto;
import com.manufactoo.stations.dto.GenealogySearchResultDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/genealogy")
public class GenealogyController {

    private final GenealogyService service;

    public GenealogyController(GenealogyService service) {
        this.service = service;
    }

    /** Busca un codigo (lote/serie de Odoo) en ambas direcciones: como unidad producida y como material consumido. */
    @GetMapping("/search")
    public GenealogySearchResultDto search(@RequestParam String code) {
        return service.searchByCode(code);
    }

    /** Ultimos registros de trazabilidad de toda la app, paginados -- para explorar sin conocer un codigo de antemano. */
    @GetMapping("/recent")
    public GenealogyRecentPageDto recent(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return service.listRecent(page, size);
    }
}
