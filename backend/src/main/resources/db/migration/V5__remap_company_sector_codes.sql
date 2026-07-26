-- El listado de sectores se amplia y los codigos pasan a ser neutros de
-- idioma (antes usaban raices en espanol). Remapeo de datos, no destructivo:
-- ninguna fila se borra, solo se actualiza el valor de sector si coincide
-- con uno de los codigos antiguos.
UPDATE company_settings SET sector = 'AUTOMOTIVE'     WHERE sector = 'AUTOMOCION';
UPDATE company_settings SET sector = 'FOOD_BEVERAGE'  WHERE sector = 'ALIMENTACION';
UPDATE company_settings SET sector = 'PLASTICS'       WHERE sector = 'PLASTICO';
UPDATE company_settings SET sector = 'OTHER'          WHERE sector = 'OTRO';
