package com.manufactoo.players.release;

/** Nombre de fichero de canal que espera electron-updater para cada SO (provider "generic"). */
public enum PlayerReleasePlatform {
    WINDOWS("latest.yml"),
    MAC("latest-mac.yml"),
    LINUX("latest-linux.yml");

    private final String manifestFilename;

    PlayerReleasePlatform(String manifestFilename) {
        this.manifestFilename = manifestFilename;
    }

    public String manifestFilename() {
        return manifestFilename;
    }

    public static PlayerReleasePlatform fromManifestFilename(String filename) {
        for (PlayerReleasePlatform p : values()) {
            if (p.manifestFilename.equals(filename)) {
                return p;
            }
        }
        return null;
    }
}
