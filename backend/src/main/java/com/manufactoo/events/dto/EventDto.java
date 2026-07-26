package com.manufactoo.events.dto;

import com.manufactoo.events.Event;

import java.time.Instant;

public record EventDto(
        Long id,
        String name,
        String topic,
        String direction,
        boolean enabled,
        Instant createdAt,
        Instant updatedAt
) {
    public static EventDto from(Event event) {
        return new EventDto(
                event.getId(),
                event.getName(),
                event.getTopic(),
                event.getDirection().name(),
                event.isEnabled(),
                event.getCreatedAt(),
                event.getUpdatedAt()
        );
    }
}
