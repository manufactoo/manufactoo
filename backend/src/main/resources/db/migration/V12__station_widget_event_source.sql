-- Un widget de dato puede alimentarse tambien de un EVENTO (topic MQTT de
-- suscripcion definido en la app Eventos): la estacion "espera" a recibir ese
-- topic y el valor rellena el campo. Es el equivalente MQTT de source_device_id.
-- La recepcion real la realiza el Player/servidor (broker MQTT embebido); esto
-- guarda la asociacion.
ALTER TABLE screen_widgets
    ADD COLUMN source_event_id BIGINT REFERENCES events(id) ON DELETE SET NULL;
