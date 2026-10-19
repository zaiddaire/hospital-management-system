package com.hospital.service;

import com.hospital.dto.DashboardStats;
import com.hospital.entity.AppointmentStatus;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final DepartmentRepository departmentRepository;

    public DashboardStats getStats() {
        return DashboardStats.builder()
                .totalDoctors(doctorRepository.count())
                .totalPatients(patientRepository.count())
                .totalAppointments(appointmentRepository.count())
                .pendingAppointments(
                        appointmentRepository.findByStatus(AppointmentStatus.PENDING).size())
                .completedAppointments(
                        appointmentRepository.findByStatus(AppointmentStatus.COMPLETED).size())
                .totalDepartments(departmentRepository.count())
                .build();
    }
}
