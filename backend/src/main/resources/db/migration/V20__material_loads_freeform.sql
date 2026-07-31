-- Permite cargar un lote sin que exista (o siga existiendo) un widget
-- MATERIAL_LOT: name/data_source_type/lookup_column se guardan en la propia
-- fila en vez de sacarse siempre del widget, para que una ranura creada desde
-- el popup de Materiales (sin widget en el lienzo) sepa contra que campo de
-- Odoo se valida en la siguiente carga, y para que quitar el widget del
-- lienzo despues no deje la ranura huerfana (ver MaterialLoadService.listSlots).
ALTER TABLE station_material_loads
    ADD COLUMN name VARCHAR(255),
    ADD COLUMN data_source_type VARCHAR(50),
    ADD COLUMN lookup_column VARCHAR(100);
