package com.hospital.dto;

import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AppointmentRescheduleHistoryDTO {
    private Long id;
    private Long appointmentId;
    private Long patientId;
    private Long doctorId;
    private LocalDate oldAppointmentDate;
    private LocalTime oldAppointmentTime;
    private LocalDate newAppointmentDate;
    private LocalTime newAppointmentTime;
    private Long changedByUserId;
    private String changedByRole;
    private String changedByName;
    private String reason;
    private String previousStatus;
    private String newStatus;
    private LocalDateTime createdAt;
}
