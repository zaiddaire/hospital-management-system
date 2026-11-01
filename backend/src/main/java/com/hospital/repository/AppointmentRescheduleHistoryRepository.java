package com.hospital.repository;

import com.hospital.entity.AppointmentRescheduleHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AppointmentRescheduleHistoryRepository extends JpaRepository<AppointmentRescheduleHistory, Long> {
    List<AppointmentRescheduleHistory> findByAppointmentIdOrderByCreatedAtDesc(Long appointmentId);
    List<AppointmentRescheduleHistory> findByPatientIdOrderByCreatedAtDesc(Long patientId);
    List<AppointmentRescheduleHistory> findByDoctorIdOrderByCreatedAtDesc(Long doctorId);
}
