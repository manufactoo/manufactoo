-- Work Center de Odoo (opcional) al que pertenece fisicamente la estacion --
-- mismo patron que manufacturing_routes.product_id/product_name (id +
-- etiqueta cacheada, sin FK real hacia Odoo). Ver conversacion 2026-08-04
-- sobre integracion de Work Center/Operacion/Workorder.
ALTER TABLE stations ADD COLUMN odoo_workcenter_id BIGINT;
ALTER TABLE stations ADD COLUMN odoo_workcenter_name VARCHAR(255);
