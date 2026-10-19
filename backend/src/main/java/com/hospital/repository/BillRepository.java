package com.hospital.repository;

import com.hospital.entity.Bill;
import com.hospital.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BillRepository extends JpaRepository<Bill, Long> {

    Optional<Bill> findByBillNumber(String billNumber);

    List<Bill> findByPatientId(Long patientId);

    List<Bill> findByPaymentStatus(PaymentStatus status);

    List<Bill> findByPatientIdAndPaymentStatus(Long patientId, PaymentStatus status);

    List<Bill> findByAppointmentId(Long appointmentId);
}
