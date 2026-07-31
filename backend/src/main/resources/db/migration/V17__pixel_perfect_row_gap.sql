-- El hueco visual entre widgets (8px) deja de salir del "gap" del grid CSS y
-- pasa a ser relleno propio de cada widget (necesario para que el ajuste
-- automatico de alto por tamano de fuente pueda encajar de forma exacta, sin
-- redondear al multiplo de 32 mas cercano). Eso cambia la relacion entre la
-- unidad logica (y/h) y los pixeles reales, y de forma DISTINTA para "y" y
-- para "h":
--
-- "y" (posicion): antes, 1 unidad = 40px (32 de fila + 8 de gap SIEMPRE, haya
-- o no otro widget encima). Ahora 1 unidad = 32px exactos (el gap ya no vive
-- ahi). Para que la posicion en pantalla no cambie: y_nuevo = y_viejo * 1.25
-- (40/32).
--
-- "h" (alto): antes, el gap SOLO se colaba en el alto real cuando el widget
-- ocupaba VARIAS filas (el gap queda "dentro" de su propia caja al abarcar
-- varias pistas de grid) -- un h=1 (una sola pista) no tenia ningun gap
-- interno, salia exacto a 32px; un h=2 salia a 2*32+1*8=72px (no 2*40=80).
-- Formula general vieja: alto_px = h*32 + (h-1)*8. Para que el alto en
-- pantalla no cambie con el nuevo alto_px = h_nuevo*32:
--   h_nuevo*32 = h_viejo*32 + (h_viejo-1)*8  =>  h_nuevo = h_viejo + (h_viejo-1)*0.25
-- (h=1 no cambia: h_nuevo=1. h=2 -> 2.25. h=3 -> 3.5. h=4 -> 4.75.)
UPDATE screen_widgets
SET layout = jsonb_set(
        jsonb_set(layout, '{y}', to_jsonb(COALESCE((layout->>'y')::numeric, 0) * 1.25)),
        '{h}', to_jsonb(1.25 * COALESCE((layout->>'h')::numeric, 1) - 0.25)
    )
WHERE layout ? 'y'
   OR layout ? 'h';
