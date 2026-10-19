package com.hospital.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BillDTO {

    private Long id;
    private String billNumber;

    @NotNull(message = "Patient ID is required")
    private Long patientId;
    private String patientName;

    private Long appointmentId;

    private String description;

    @NotNull(message = "Amount is required")
    private BigDecimal amount;

    private LocalDate billDate;
    private String paymentStatus;
}
