package com.hospital.config;

import com.hospital.entity.*;
import com.hospital.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final DepartmentRepository departmentRepository;
    private final DoctorRepository doctorRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final MedicalRecordRepository medicalRecordRepository;
    private final PrescriptionRepository prescriptionRepository;
    private final BillRepository billRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Database already seeded. Skipping initial data load.");
            return;
        }

        log.info("Seeding initial Hospital Management System data...");

        // 1. Departments
        Department cardiology = createDept("Cardiology", "Heart and cardiovascular system diagnosis and treatment");
        Department neurology = createDept("Neurology", "Brain, spinal cord and nervous system disorders");
        Department orthopedics = createDept("Orthopedics", "Musculoskeletal system - bones, joints, ligaments and muscles");
        Department pediatrics = createDept("Pediatrics", "Medical care for infants, children and adolescents");
        Department dermatology = createDept("Dermatology", "Skin, hair and nail conditions diagnosis and treatment");
        Department generalMedicine = createDept("General Medicine", "Primary care and internal medicine services");
        createDept("ENT", "Ear, Nose and Throat disorders and treatment");
        createDept("Gynecology", "Female reproductive system health and care");

        // 2. Admin User
        User admin = new User();
        admin.setUsername("admin");
        admin.setEmail("admin@hospital.com");
        admin.setPassword(passwordEncoder.encode("admin123"));
        admin.setRole(Role.ADMIN);
        admin.setActive(true);
        userRepository.save(admin);

        // 3. Doctors
        Doctor doc1 = createDoctor("dr.sharma", "dr.sharma@hospital.com", "doctor123", "Arun Sharma",
                cardiology, "Interventional Cardiology", "MD, DM Cardiology (AIIMS)",
                22, new BigDecimal("800.00"), "9876543210", Gender.MALE, "Mon-Fri 9AM-1PM, 3PM-5PM", LocalDate.of(1975, 3, 15));

        Doctor doc2 = createDoctor("dr.patel", "dr.patel@hospital.com", "doctor123", "Neha Patel",
                neurology, "Clinical Neurology", "MD, DM Neurology (CMC Vellore)",
                17, new BigDecimal("700.00"), "9876543211", Gender.FEMALE, "Mon-Sat 10AM-2PM", LocalDate.of(1980, 7, 22));

        Doctor doc3 = createDoctor("dr.gupta", "dr.gupta@hospital.com", "doctor123", "Rajiv Gupta",
                orthopedics, "Joint Replacement Surgery", "MS Ortho, MCh (PGI Chandigarh)",
                19, new BigDecimal("750.00"), "9876543212", Gender.MALE, "Mon-Fri 9AM-5PM", LocalDate.of(1978, 11, 5));

        Doctor doc4 = createDoctor("dr.mehta", "dr.mehta@hospital.com", "doctor123", "Priya Mehta",
                pediatrics, "Pediatric Intensive Care", "MD Pediatrics, Fellowship (Boston)",
                15, new BigDecimal("600.00"), "9876543213", Gender.FEMALE, "Mon-Fri 10AM-4PM", LocalDate.of(1982, 1, 18));

        createDoctor("dr.reddy", "dr.reddy@hospital.com", "doctor123", "Suresh Reddy",
                dermatology, "Cosmetic Dermatology", "MD Dermatology (KEM Mumbai)",
                18, new BigDecimal("650.00"), "9876543214", Gender.MALE, "Tue-Sat 11AM-3PM", LocalDate.of(1979, 6, 30));

        createDoctor("dr.singh", "dr.singh@hospital.com", "doctor123", "Kavita Singh",
                generalMedicine, "Internal Medicine", "MD Medicine (Maulana Azad MC)",
                14, new BigDecimal("500.00"), "9876543215", Gender.FEMALE, "Mon-Sat 9AM-5PM", LocalDate.of(1983, 9, 12));

        // 4. Patients
        Patient pat1 = createPatient("rahul.kumar", "rahul.kumar@email.com", "patient123", "Rahul Kumar",
                Gender.MALE, BloodGroup.B_POSITIVE, "9123456780", "42 MG Road, Bengaluru 560001", "9123456700", LocalDate.of(1990, 5, 14));

        Patient pat2 = createPatient("priya.sharma", "priya.sharma@email.com", "patient123", "Priya Sharma",
                Gender.FEMALE, BloodGroup.A_POSITIVE, "9123456781", "15 Linking Road, Mumbai 400050", "9123456701", LocalDate.of(1988, 9, 28));

        Patient pat3 = createPatient("amit.verma", "amit.verma@email.com", "patient123", "Amit Verma",
                Gender.MALE, BloodGroup.O_POSITIVE, "9123456782", "78 Civil Lines, Delhi 110054", "9123456702", LocalDate.of(1985, 2, 10));

        createPatient("sneha.das", "sneha.das@email.com", "patient123", "Sneha Das",
                Gender.FEMALE, BloodGroup.AB_POSITIVE, "9123456783", "23 Park Street, Kolkata 700016", "9123456703", LocalDate.of(1992, 12, 3));

        // 5. Sample Appointments
        Appointment appt1 = createAppointment(pat1, doc1, LocalDate.now().minusDays(5), LocalTime.of(9, 0), "Chest tightness and palpitations", AppointmentStatus.COMPLETED);
        Appointment appt2 = createAppointment(pat2, doc2, LocalDate.now().minusDays(3), LocalTime.of(10, 0), "Recurring migraines", AppointmentStatus.COMPLETED);
        Appointment appt3 = createAppointment(pat3, doc3, LocalDate.now().plusDays(1), LocalTime.of(11, 0), "Knee ligament pain follow-up", AppointmentStatus.CONFIRMED);
        createAppointment(pat1, doc4, LocalDate.now().plusDays(2), LocalTime.of(14, 0), "Child routine immunization", AppointmentStatus.PENDING);

        // 6. Medical Records & Prescriptions
        MedicalRecord rec1 = new MedicalRecord();
        rec1.setPatient(pat1);
        rec1.setDoctor(doc1);
        rec1.setAppointment(appt1);
        rec1.setVisitDate(LocalDate.now().minusDays(5));
        rec1.setSymptoms("Chest tightness, mild dyspnea upon climbing stairs");
        rec1.setDiagnosis("Mild Angina Pectoris / Hypertensive strain");
        rec1.setTreatmentNotes("Prescribed beta-blockers and nitrates. Recommended stress reduction and low sodium diet.");
        rec1 = medicalRecordRepository.save(rec1);

        createPrescription(rec1, pat1, doc1, "Metoprolol Tartrate", "25mg", "Once daily", "30 days", "Take morning with breakfast");
        createPrescription(rec1, pat1, doc1, "Sorbitrate (Isosorbide Dinitrate)", "5mg", "As needed", "15 days", "Place under tongue if chest pain occurs");

        MedicalRecord rec2 = new MedicalRecord();
        rec2.setPatient(pat2);
        rec2.setDoctor(doc2);
        rec2.setAppointment(appt2);
        rec2.setVisitDate(LocalDate.now().minusDays(3));
        rec2.setSymptoms("Throbbing unilateral headache, photophobia");
        rec2.setDiagnosis("Migraine with Visual Aura");
        rec2.setTreatmentNotes("Prescribed triptan therapy. Advised trigger diary and adequate sleep schedule.");
        rec2 = medicalRecordRepository.save(rec2);

        createPrescription(rec2, pat2, doc2, "Sumatriptan", "50mg", "At migraine onset", "10 days", "Maximum 2 tablets in 24 hours");

        // 7. Bills
        createBill("BILL-2024-001", pat1, appt1, "Cardiology Consultation & ECG - Dr. Arun Sharma", new BigDecimal("800.00"), LocalDate.now().minusDays(5), PaymentStatus.PAID);
        createBill("BILL-2024-002", pat2, appt2, "Neurology Consultation - Dr. Neha Patel", new BigDecimal("700.00"), LocalDate.now().minusDays(3), PaymentStatus.PAID);
        createBill("BILL-2024-003", pat3, appt3, "Orthopedic Pre-consultation - Dr. Rajiv Gupta", new BigDecimal("750.00"), LocalDate.now(), PaymentStatus.PENDING);

        log.info("Database seeding successfully completed with sample doctors, patients, appointments, and bills!");
    }

    private Department createDept(String name, String desc) {
        Department d = new Department();
        d.setName(name);
        d.setDescription(desc);
        d.setActive(true);
        return departmentRepository.save(d);
    }

    private Doctor createDoctor(String username, String email, String rawPw, String name,
                               Department dept, String spec, String qual, int exp, BigDecimal fee,
                               String phone, Gender gender, String avail, LocalDate dob) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPassword(passwordEncoder.encode(rawPw));
        u.setRole(Role.DOCTOR);
        u.setActive(true);
        userRepository.save(u);

        Doctor doc = new Doctor();
        doc.setUser(u);
        doc.setDepartment(dept);
        doc.setFullName(name);
        doc.setSpecialization(spec);
        doc.setQualification(qual);
        doc.setExperienceYears(exp);
        doc.setConsultationFee(fee);
        doc.setPhone(phone);
        doc.setGender(gender);
        doc.setAvailability(avail);
        doc.setDateOfBirth(dob);
        doc.setActive(true);
        return doctorRepository.save(doc);
    }

    private Patient createPatient(String username, String email, String rawPw, String name,
                                 Gender gender, BloodGroup bg, String phone, String address, String emergency, LocalDate dob) {
        User u = new User();
        u.setUsername(username);
        u.setEmail(email);
        u.setPassword(passwordEncoder.encode(rawPw));
        u.setRole(Role.PATIENT);
        u.setActive(true);
        userRepository.save(u);

        Patient p = new Patient();
        p.setUser(u);
        p.setFullName(name);
        p.setGender(gender);
        p.setBloodGroup(bg);
        p.setPhone(phone);
        p.setAddress(address);
        p.setEmergencyContact(emergency);
        p.setDateOfBirth(dob);
        return patientRepository.save(p);
    }

    private Appointment createAppointment(Patient p, Doctor d, LocalDate date, LocalTime time, String reason, AppointmentStatus status) {
        Appointment a = new Appointment();
        a.setPatient(p);
        a.setDoctor(d);
        a.setAppointmentDate(date);
        a.setAppointmentTime(time);
        a.setReason(reason);
        a.setStatus(status);
        return appointmentRepository.save(a);
    }

    private void createPrescription(MedicalRecord rec, Patient p, Doctor d, String med, String dose, String freq, String dur, String inst) {
        Prescription px = new Prescription();
        px.setMedicalRecord(rec);
        px.setPatient(p);
        px.setDoctor(d);
        px.setMedicineName(med);
        px.setDosage(dose);
        px.setFrequency(freq);
        px.setDuration(dur);
        px.setInstructions(inst);
        px.setPrescriptionDate(rec.getVisitDate());
        prescriptionRepository.save(px);
    }

    private void createBill(String billNum, Patient p, Appointment a, String desc, BigDecimal amount, LocalDate date, PaymentStatus status) {
        Bill b = new Bill();
        b.setBillNumber(billNum);
        b.setPatient(p);
        b.setAppointment(a);
        b.setDescription(desc);
        b.setAmount(amount);
        b.setBillDate(date);
        b.setPaymentStatus(status);
        billRepository.save(b);
    }
}
