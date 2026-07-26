package com.manufactoo.crypto;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermission;
import java.nio.file.attribute.PosixFilePermissions;
import java.security.SecureRandom;
import java.util.Set;

/**
 * Carga la clave maestra de 256 bits usada para cifrar credenciales de Odoo.
 *
 * En produccion, la clave se distribuye via Docker Compose Secrets, montada
 * de solo lectura en manufactoo.crypto.master-key-path (por defecto
 * /run/secrets/manufactoo_master_key) y debe generarse ANTES del primer
 * arranque con scripts/generate-master-key.sh. Este provider nunca escribe
 * en esa ruta.
 *
 * Solo si se configura manufactoo.crypto.master-key-init-path (activo por
 * defecto en el perfil dev) y la clave aun no existe en ningun lado, se
 * genera una nueva y se persiste ahi, para facilitar arrancar en local sin
 * pasos manuales previos.
 */
@Component
public class MasterKeyProvider {

    public static final int KEY_LENGTH_BYTES = 32; // 256 bits

    private static final Logger log = LoggerFactory.getLogger(MasterKeyProvider.class);

    private final CryptoProperties properties;
    private volatile byte[] cachedKey;

    public MasterKeyProvider(CryptoProperties properties) {
        this.properties = properties;
    }

    public synchronized byte[] getKey() {
        if (cachedKey != null) {
            return cachedKey;
        }

        Path primary = blankToNull(properties.masterKeyPath()) != null ? Path.of(properties.masterKeyPath()) : null;
        if (primary != null && Files.exists(primary)) {
            cachedKey = readKey(primary);
            log.info("Clave maestra cargada desde {}", primary);
            return cachedKey;
        }

        Path initPath = blankToNull(properties.masterKeyInitPath()) != null ? Path.of(properties.masterKeyInitPath()) : null;
        if (initPath != null) {
            if (Files.exists(initPath)) {
                cachedKey = readKey(initPath);
                log.info("Clave maestra cargada desde {}", initPath);
                return cachedKey;
            }
            cachedKey = generateAndPersist(initPath);
            log.warn("No existia clave maestra: se ha generado una nueva en {}. " +
                    "En produccion, genera la clave de antemano con scripts/generate-master-key.sh " +
                    "y NO dependas de este bootstrap automatico.", initPath);
            return cachedKey;
        }

        throw new IllegalStateException(
                "No se encuentra la clave maestra de cifrado (manufactoo.crypto.master-key-path=" +
                        properties.masterKeyPath() + ") y no hay master-key-init-path configurado. " +
                        "Ejecuta scripts/generate-master-key.sh antes de arrancar en produccion.");
    }

    private byte[] readKey(Path path) {
        try {
            byte[] bytes = Files.readAllBytes(path);
            if (bytes.length != KEY_LENGTH_BYTES) {
                throw new IllegalStateException(
                        "La clave maestra en " + path + " no tiene 256 bits (" + bytes.length + " bytes leidos).");
            }
            return bytes;
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer la clave maestra desde " + path, e);
        }
    }

    private byte[] generateAndPersist(Path path) {
        byte[] key = new byte[KEY_LENGTH_BYTES];
        new SecureRandom().nextBytes(key);
        try {
            if (path.getParent() != null) {
                Files.createDirectories(path.getParent());
            }
            Files.write(path, key);
            trySetOwnerOnlyPermissions(path);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo generar la clave maestra en " + path, e);
        }
        return key;
    }

    private void trySetOwnerOnlyPermissions(Path path) {
        try {
            Set<PosixFilePermission> perms = PosixFilePermissions.fromString("rw-------");
            Files.setPosixFilePermissions(path, perms);
        } catch (UnsupportedOperationException | IOException e) {
            // Sistema de ficheros sin soporte POSIX (ej. Windows en dev): se ignora.
            log.debug("No se pudieron restringir permisos POSIX de {}: {}", path, e.getMessage());
        }
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value;
    }
}
