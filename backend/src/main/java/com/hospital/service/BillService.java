package com.hospital.service;

import com.hospital.dto.BillDTO;
import com.hospital.entity.*;
import com.hospital.exception.BadRequestException;
import com.hospital.exception.ResourceNotFoundException;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BillService {

    private final BillRepository billRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;

    public List<BillDTO> getAllBills() {
        return billRepository.findAll().stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    public BillDTO getBillById(Long id) {
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", "id", id));
        return toDTO(bill);
    }

    public List<BillDTO> getBillsByPatient(Long patientId) {
        return billRepository.findByPatientId(patientId).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional
    public BillDTO createBill(BillDTO dto) {
        Patient patient = patientRepository.findById(dto.getPatientId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Patient", "id", dto.getPatientId()));

        Bill bill = new Bill();
        bill.setBillNumber("BILL-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        bill.setPatient(patient);
        bill.setDescription(dto.getDescription());
        bill.setAmount(dto.getAmount());
        bill.setBillDate(dto.getBillDate() != null ? dto.getBillDate() : LocalDate.now());
        bill.setPaymentStatus(PaymentStatus.PENDING);

        if (dto.getAppointmentId() != null) {
            Appointment appointment = appointmentRepository.findById(dto.getAppointmentId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Appointment", "id", dto.getAppointmentId()));
            bill.setAppointment(appointment);
        }

        billRepository.save(bill);
        return toDTO(bill);
    }

    @Transactional
    public BillDTO updatePaymentStatus(Long id, String status) {
        Bill bill = billRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Bill", "id", id));

        try {
            bill.setPaymentStatus(PaymentStatus.valueOf(status.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Invalid payment status: " + status);
        }

        billRepository.save(bill);
        return toDTO(bill);
    }

    private BillDTO toDTO(Bill bill) {
        return BillDTO.builder()
                .id(bill.getId())
                .billNumber(bill.getBillNumber())
                .patientId(bill.getPatient().getId())
                .patientName(bill.getPatient().getFullName())
                .appointmentId(bill.getAppointment() != null ?
                        bill.getAppointment().getId() : null)
                .description(bill.getDescription())
                .amount(bill.getAmount())
                .billDate(bill.getBillDate())
                .paymentStatus(bill.getPaymentStatus().name())
                .build();
    }
}
