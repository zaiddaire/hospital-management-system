package com.hospital.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppointmentRescheduleDTO {

    @NotNull(message = "New appointment date is required")
    private LocalDate newDate;

    @NotNull(message = "New appointment time is required")
    private LocalTime newTime;

    private String reason;
}
