package com.manufactoo.config;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.AcceptHeaderLocaleResolver;

import java.util.List;
import java.util.Locale;

/**
 * Idioma de los mensajes de error del backend (com.manufactoo.common.Messages):
 * lo decide la cabecera Accept-Language que manda el frontend (api-client.ts,
 * calculada del idioma actual de la interfaz -- ver setAppLanguage en
 * frontend/src/i18n/index.ts). Espanol por defecto si no llega cabecera (o
 * llega un idioma no soportado), igual que el fallback del propio frontend.
 */
@Configuration
public class I18nConfig {

    @Bean
    public LocaleResolver localeResolver() {
        AcceptHeaderLocaleResolver resolver = new AcceptHeaderLocaleResolver();
        resolver.setDefaultLocale(Locale.forLanguageTag("es"));
        resolver.setSupportedLocales(List.of(Locale.forLanguageTag("es"), Locale.forLanguageTag("en")));
        return resolver;
    }

    @Bean
    public MessageSource messageSource() {
        ResourceBundleMessageSource source = new ResourceBundleMessageSource();
        source.setBasenames("messages");
        source.setDefaultEncoding("UTF-8");
        // Si falta una clave, mejor enseñar el propio codigo (deja claro que
        // falta traducir) que reventar con NoSuchMessageException.
        source.setUseCodeAsDefaultMessage(true);
        // Por defecto Spring cae al Locale del SISTEMA (el de la JVM/contenedor,
        // normalmente en_US) cuando el candidato pedido no tiene bundle propio,
        // ANTES de usar el bundle raiz (messages.properties, espanol) como
        // fallback -- asi que con este flag en true, pedir "es" (que no tiene
        // messages_es.properties, solo el raiz) acababa sirviendo ingles.
        // Lo desactivamos para que el fallback sea siempre el bundle raiz.
        source.setFallbackToSystemLocale(false);
        return source;
    }
}
