package com.hospital.service;

import com.hospital.dto.AppointmentDTO;
import com.hospital.dto.AppointmentRescheduleDTO;
import com.hospital.dto.AppointmentRescheduleHistoryDTO;
import com.hospital.entity.*;
import com.hospital.exception.BadRequestException;
import com.hospital.exception.ResourceNotFoundException;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRescheduleHistoryRepository rescheduleHistoryRepository;

    public List<AppointmentDTO> getAllAppointments() {
        return appointmentRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public AppointmentDTO getAppointmentById(Long id) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", id));
        return toDTO(appointment);
    }

    public List<AppointmentDTO> getAppointmentsByPatient(Long patientId) {
        return appointmentRepository.findByPatientId(patientId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<AppointmentDTO> getAppointmentsByDoctor(Long doctorId) {
        return appointmentRepository.findByDoctorId(doctorId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public AppointmentDTO createAppointment(AppointmentDTO dto) {
        Patient patient = patientRepository.findById(dto.getPatientId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient", "id", dto.getPatientId()));

        Doctor doctor = doctorRepository.findById(dto.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Doctor", "id", dto.getDoctorId()));

        // Check slot availability
        boolean slotTaken = appointmentRepository
                .existsByDoctorIdAndAppointmentDateAndAppointmentTime(
                        dto.getDoctorId(), dto.getAppointmentDate(), dto.getAppointmentTime());
        if (slotTaken) {
            throw new BadRequestException(
                    "This time slot is already booked for the selected doctor");
        }

        Appointment appointment = new Appointment();
        appointment.setPatient(patient);
        appointment.setDoctor(doctor);
        appointment.setAppointmentDate(dto.getAppointmentDate());
        appointment.setAppointmentTime(dto.getAppointmentTime());
        appointment.setReason(dto.getReason());
        appointment.setStatus(AppointmentStatus.PENDING);

        appointmentRepository.save(appointment);
        return toDTO(appointment);
    }

    @Transactional
    public AppointmentDTO rescheduleAppointment(Long id, AppointmentRescheduleDTO dto, Long currentUserId, String currentRole, String currentName) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", id));

        if (appointment.getStatus() == AppointmentStatus.COMPLETED) {
            throw new BadRequestException("Completed appointments cannot be rescheduled");
        }
        if (appointment.getStatus() == AppointmentStatus.CANCELLED) {
            throw new BadRequestException("Cancelled appointments cannot be rescheduled");
        }

        LocalDate today = LocalDate.now();
        if (dto.getNewDate().isBefore(today)) {
            throw new BadRequestException("Cannot reschedule to a past date");
        }
        if (dto.getNewDate().isEqual(today) && dto.getNewTime().isBefore(LocalTime.now())) {
            throw new BadRequestException("Cannot reschedule to a past time slot today");
        }

        boolean slotTaken = appointmentRepository
                .existsByDoctorIdAndAppointmentDateAndAppointmentTime(
                        appointment.getDoctor().getId(), dto.getNewDate(), dto.getNewTime());
        if (slotTaken) {
            throw new BadRequestException("This time slot is already booked for the selected doctor");
        }

        LocalDate oldDate = appointment.getAppointmentDate();
        LocalTime oldTime = appointment.getAppointmentTime();

        appointment.setAppointmentDate(dto.getNewDate());
        appointment.setAppointmentTime(dto.getNewTime());
        appointmentRepository.save(appointment);

        AppointmentRescheduleHistory history = new AppointmentRescheduleHistory();
        history.setAppointmentId(id);
        history.setPatientId(appointment.getPatient().getId());
        history.setDoctorId(appointment.getDoctor().getId());
        history.setOldAppointmentDate(oldDate);
        history.setOldAppointmentTime(oldTime);
        history.setNewAppointmentDate(dto.getNewDate());
        history.setNewAppointmentTime(dto.getNewTime());
        history.setChangedByUserId(currentUserId != null ? currentUserId : 1L);
        history.setChangedByRole(currentRole != null ? currentRole : "PATIENT");
        history.setChangedByName(currentName != null ? currentName : "User");
        history.setReason(dto.getReason());
        history.setPreviousStatus(appointment.getStatus().name());
        history.setNewStatus(appointment.getStatus().name());

        rescheduleHistoryRepository.save(history);

        return toDTO(appointment);
    }

    public List<AppointmentRescheduleHistoryDTO> getAppointmentHistory(Long appointmentId) {
        return rescheduleHistoryRepository.findByAppointmentIdOrderByCreatedAtDesc(appointmentId)
                .stream()
                .map(this::toHistoryDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public AppointmentDTO updateAppointmentStatus(Long id, String status) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", id));

        try {
            appointment.setStatus(AppointmentStatus.valueOf(status.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid status: " + status);
        }

        appointmentRepository.save(appointment);
        return toDTO(appointment);
    }

    @Transactional
    public void deleteAppointment(Long id) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment", "id", id));
        appointment.setStatus(AppointmentStatus.CANCELLED);
        appointmentRepository.save(appointment);
    }

    private AppointmentDTO toDTO(Appointment appointment) {
        return AppointmentDTO.builder()
                .id(appointment.getId())
                .patientId(appointment.getPatient().getId())
                .patientName(appointment.getPatient().getFullName())
                .doctorId(appointment.getDoctor().getId())
                .doctorName(appointment.getDoctor().getFullName())
                .departmentName(appointment.getDoctor().getDepartment().getName())
                .appointmentDate(appointment.getAppointmentDate())
                .appointmentTime(appointment.getAppointmentTime())
                .reason(appointment.getReason())
                .status(appointment.getStatus().name())
                .build();
    }

    private AppointmentRescheduleHistoryDTO toHistoryDTO(AppointmentRescheduleHistory h) {
        return AppointmentRescheduleHistoryDTO.builder()
                .id(h.getId())
                .appointmentId(h.getAppointmentId())
                .patientId(h.getPatientId())
                .doctorId(h.getDoctorId())
                .oldAppointmentDate(h.getOldAppointmentDate())
                .oldAppointmentTime(h.getOldAppointmentTime())
                .newAppointmentDate(h.getNewAppointmentDate())
                .newAppointmentTime(h.getNewAppointmentTime())
                .changedByUserId(h.getChangedByUserId())
                .changedByRole(h.getChangedByRole())
                .changedByName(h.getChangedByName())
                .reason(h.getReason())
                .previousStatus(h.getPreviousStatus())
                .newStatus(h.getNewStatus())
                .createdAt(h.getCreatedAt())
                .build();
    }
}
