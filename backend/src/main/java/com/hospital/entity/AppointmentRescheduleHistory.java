package com.hospital.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "appointment_reschedule_history")
@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class AppointmentRescheduleHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "appointment_id", nullable = false)
    private Long appointmentId;

    @Column(name = "patient_id", nullable = false)
    private Long patientId;

    @Column(name = "doctor_id", nullable = false)
    private Long doctorId;

    @Column(name = "old_appointment_date", nullable = false)
    private LocalDate oldAppointmentDate;

    @Column(name = "old_appointment_time", nullable = false)
    private LocalTime oldAppointmentTime;

    @Column(name = "new_appointment_date", nullable = false)
    private LocalDate newAppointmentDate;

    @Column(name = "new_appointment_time", nullable = false)
    private LocalTime newAppointmentTime;

    @Column(name = "changed_by_user_id", nullable = false)
    private Long changedByUserId;

    @Column(name = "changed_by_role", nullable = false, length = 50)
    private String changedByRole;

    @Column(name = "changed_by_name")
    private String changedByName;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(name = "previous_status", length = 30)
    private String previousStatus;

    @Column(name = "new_status", length = 30)
    private String newStatus;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
