package com.hospital.dto;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DoctorDTO {

    private Long id;
    private Long userId;
    private String username;
    private String email;
    private Long departmentId;
    private String departmentName;
    private String fullName;
    private LocalDate dateOfBirth;
    private String gender;
    private String phone;
    private String specialization;
    private String qualification;
    private int experienceYears;
    private BigDecimal consultationFee;
    private String availability;
    private boolean isActive;
}
