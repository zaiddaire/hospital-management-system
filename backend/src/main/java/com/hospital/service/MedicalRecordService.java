package com.hospital.service;

import com.hospital.dto.MedicalRecordDTO;
import com.hospital.dto.PrescriptionDTO;
import com.hospital.entity.*;
import com.hospital.exception.ResourceNotFoundException;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MedicalRecordService {

    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final PatientRepository patientRepository;
    private final DoctorRepository doctorRepository;
    private final AppointmentRepository appointmentRepository;

    public List<MedicalRecordDTO> getAllRecords() {
        return medicalRecordRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public MedicalRecordDTO getRecordById(Long id) {
        MedicalRecord record = medicalRecordRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("MedicalRecord", "id", id));
        return toDTO(record);
    }

    public List<MedicalRecordDTO> getRecordsByPatient(Long patientId) {
        return medicalRecordRepository.findByPatientIdOrderByVisitDateDesc(patientId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public List<MedicalRecordDTO> getRecordsByDoctor(Long doctorId) {
        return medicalRecordRepository.findByDoctorId(doctorId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public MedicalRecordDTO createRecord(MedicalRecordDTO dto) {
        Patient patient = patientRepository.findById(dto.getPatientId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient", "id", dto.getPatientId()));

        Doctor doctor = doctorRepository.findById(dto.getDoctorId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Doctor", "id", dto.getDoctorId()));

        MedicalRecord record = new MedicalRecord();
        record.setPatient(patient);
        record.setDoctor(doctor);
        record.setVisitDate(dto.getVisitDate());
        record.setSymptoms(dto.getSymptoms());
        record.setDiagnosis(dto.getDiagnosis());
        record.setTreatmentNotes(dto.getTreatmentNotes());

        if (dto.getAppointmentId() != null) {
            Appointment appointment = appointmentRepository.findById(dto.getAppointmentId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Appointment", "id", dto.getAppointmentId()));
            record.setAppointment(appointment);
            // Mark appointment as completed
            appointment.setStatus(AppointmentStatus.COMPLETED);
            appointmentRepository.save(appointment);
        }

        medicalRecordRepository.save(record);

        // Create prescriptions if provided
        if (dto.getPrescriptions() != null && !dto.getPrescriptions().isEmpty()) {
            for (PrescriptionDTO presDto : dto.getPrescriptions()) {
                Prescription prescription = new Prescription();
                prescription.setMedicalRecord(record);
                prescription.setPatient(patient);
                prescription.setDoctor(doctor);
                prescription.setMedicineName(presDto.getMedicineName());
                prescription.setDosage(presDto.getDosage());
                prescription.setFrequency(presDto.getFrequency());
                prescription.setDuration(presDto.getDuration());
                prescription.setInstructions(presDto.getInstructions());
                prescription.setPrescriptionDate(dto.getVisitDate());
                prescriptionRepository.save(prescription);
            }
        }

        return toDTO(record);
    }

    private MedicalRecordDTO toDTO(MedicalRecord record) {
        List<PrescriptionDTO> prescriptions = prescriptionRepository
                .findByMedicalRecordId(record.getId()).stream()
                .map(this::toPrescriptionDTO)
                .collect(Collectors.toList());

        return MedicalRecordDTO.builder()
                .id(record.getId())
                .patientId(record.getPatient().getId())
                .patientName(record.getPatient().getFullName())
                .doctorId(record.getDoctor().getId())
                .doctorName(record.getDoctor().getFullName())
                .appointmentId(record.getAppointment() != null ?
                        record.getAppointment().getId() : null)
                .visitDate(record.getVisitDate())
                .symptoms(record.getSymptoms())
                .diagnosis(record.getDiagnosis())
                .treatmentNotes(record.getTreatmentNotes())
                .prescriptions(prescriptions)
                .build();
    }

    private PrescriptionDTO toPrescriptionDTO(Prescription prescription) {
        return PrescriptionDTO.builder()
                .id(prescription.getId())
                .medicalRecordId(prescription.getMedicalRecord().getId())
                .patientId(prescription.getPatient().getId())
                .patientName(prescription.getPatient().getFullName())
                .doctorId(prescription.getDoctor().getId())
                .doctorName(prescription.getDoctor().getFullName())
                .medicineName(prescription.getMedicineName())
                .dosage(prescription.getDosage())
                .frequency(prescription.getFrequency())
                .duration(prescription.getDuration())
                .instructions(prescription.getInstructions())
                .prescriptionDate(prescription.getPrescriptionDate())
                .build();
    }
}
