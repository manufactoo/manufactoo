-- El alto de fila del grid del editor de estaciones baja de 64px a 32px (a
-- peticion del usuario: poder ajustar el alto de un widget de 0.5 en 0.5 en
-- vez de 1 en 1). Para que ningun widget ya diseñado cambie de tamano en
-- pantalla, se duplican "y" y "h" de cada layout: lo que antes era "1" ahora
-- es "2" en la nueva unidad, misma altura fisica de siempre.
UPDATE screen_widgets
SET layout = jsonb_set(
        jsonb_set(layout, '{y}', to_jsonb(COALESCE((layout->>'y')::numeric, 0) * 2)),
        '{h}', to_jsonb(COALESCE((layout->>'h')::numeric, 1) * 2)
    )
WHERE layout ? 'y'
   OR layout ? 'h';
