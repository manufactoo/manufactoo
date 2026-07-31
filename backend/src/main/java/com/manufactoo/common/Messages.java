package com.manufactoo.common;

import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.stereotype.Component;

/**
 * Mensajes de error/aviso del backend, en el idioma de quien hace la
 * peticion (ver I18nConfig -- resuelto de la cabecera Accept-Language).
 * Deliberadamente NO usa java.text.MessageFormat (que exige escapar cada
 * comilla simple como '' para que no se interprete como delimitador de cita,
 * un detalle facil de olvidar y muy presente en estos mensajes, p. ej. "el
 * widget 'X' necesita..."): en vez de eso, las plantillas usan %s de
 * String.format, sin ninguna regla de escape especial.
 */
@Component
public class Messages {

    private final MessageSource messageSource;

    public Messages(MessageSource messageSource) {
        this.messageSource = messageSource;
    }

    public String get(String code, Object... args) {
        String template = messageSource.getMessage(code, null, LocaleContextHolder.getLocale());
        return args.length == 0 ? template : String.format(template, args);
    }
}
