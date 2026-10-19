# 🏥 MedCore HMS - Hospital Management System

A full-stack, enterprise-grade Hospital Management System built with **Spring Boot 3**, **Spring Security (JWT)**, **MySQL**, and a modern **React + Vite** frontend.

---

## 🌟 Key Features

### 🔐 Multi-Role Authentication & Access Control
- **Role-Based Access**: Specialized interfaces and capabilities for `ADMIN`, `DOCTOR`, and `PATIENT`.
- **Stateless JWT Security**: Secure bearer token authentication with automatic token renewal and route guards.
- **Auto Data Initializer**: Automatically populates the database on first run with departments, staff, patients, appointments, and bills.

### 👑 Admin Portal
- **Executive Dashboard**: Real-time KPIs (Total Doctors, Registered Patients, Active Departments, Pending/Completed Visits).
- **Staff Directory**: Register and manage medical staff and specialists across departments.
- **Department Setup**: Configure clinical departments, wards, and services.
- **Financial & Billing**: Generate patient invoices, monitor receivables, and toggle payment statuses.

### 🩺 Doctor Workspace
- **Consultation Schedule**: View daily patient appointments with real-time status management (`CONFIRMED`, `COMPLETED`, `CANCELLED`).
- **Electronic Health Records (EHR)**: Record symptoms, diagnoses, and treatment notes.
- **Digital Prescriptions (Rx)**: Multi-line digital medication prescriptions with dosage, frequency, and instructions.
- **Patient History**: Access patient medical files, previous visits, and emergency contacts.

### 🧑‍⚕️ Patient Health Portal
- **Doctor Directory**: Search and browse doctors by specialization and department with fee transparency.
- **Online Booking**: Schedule appointments with chosen doctors and available time slots.
- **Medical Records**: Access digital prescriptions and clinical diagnoses anytime.
- **Invoices & Billing**: View itemized hospital bills and payment receipts with printable formatting.
- **Profile Management**: Update personal health records, blood group, address, and emergency contact details.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Spring Boot 3.4.1, Java 21, Spring Data JPA, Spring Security |
| **Authentication** | JSON Web Tokens (`jjwt` 0.12.6) + BCrypt |
| **Database** | MySQL 8.x (`hospital_management`) |
| **Frontend** | React 19, Vite, React Router v7, Axios, Lucide React, React Hot Toast |
| **Styling** | Custom Medical Glassmorphic Design System (Vanilla CSS tokens) |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Java**: JDK 21 or higher
- **Node.js**: v18+ or v20+
- **MySQL**: Running on port `3306`
- **Maven**: 3.9+ (or NetBeans bundled Maven)

### 2. Database Setup
Create the MySQL database:
```sql
CREATE DATABASE IF NOT EXISTS hospital_management;
```

Verify your database password in [backend/src/main/resources/application.properties](file:///c:/Users/zaidd/OneDrive/HOSPITAL-MANAGEMENT-SYSTEM/backend/src/main/resources/application.properties):
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/hospital_management?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
spring.datasource.username=root
spring.datasource.password=root
```
*(On first boot, JPA automatically creates all tables and the `DataInitializer` seeds test data).*

### 3. Start the Backend
Navigate to the `backend` folder and run:
```powershell
mvn spring-boot:run
```
*(Or run `HospitalApplication.java` from your IDE).*
The API server will listen on `http://localhost:8080`.

### 4. Start the Frontend
Navigate to the `frontend` folder and run:
```powershell
npm run dev
```
Open your browser at `http://localhost:5173`.

---

## 🔑 Default Test Accounts

All accounts are auto-seeded by `DataInitializer`:

| Role | Username | Password | Notes |
|---|---|---|---|
| **Admin** | `admin` | `admin123` | Full administrative privileges |
| **Doctor** | `dr.sharma` | `doctor123` | Cardiologist |
| **Doctor** | `dr.patel` | `doctor123` | Neurologist |
| **Doctor** | `dr.gupta` | `doctor123` | Orthopedics |
| **Doctor** | `dr.mehta` | `doctor123` | Pediatrics |
| **Doctor** | `dr.reddy` | `doctor123` | Dermatology |
| **Doctor** | `dr.singh` | `doctor123` | General Medicine |
| **Patient** | `rahul.kumar` | `patient123` | Sample patient |
| **Patient** | `priya.sharma` | `patient123` | Sample patient |
| **Patient** | `amit.verma` | `patient123` | Sample patient |
| **Patient** | `sneha.das` | `patient123` | Sample patient |

*New patients can also self-register at `/register`.*

---

## 📡 REST API Endpoints Overview

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register patient account |
| `POST` | `/api/auth/login` | Public | Authenticate & retrieve JWT token |
| `GET` | `/api/admin/dashboard` | ADMIN | Dashboard metrics & counts |
| `GET` | `/api/doctors` | Public | List active doctors |
| `POST` | `/api/doctors` | ADMIN | Register new doctor profile |
| `GET` | `/api/departments` | Public | List active hospital departments |
| `POST` | `/api/departments` | ADMIN | Create new department |
| `GET` | `/api/appointments` | ADMIN | All hospital appointments |
| `GET` | `/api/appointments/doctor/{id}` | Authenticated | Doctor's assigned appointments |
| `GET` | `/api/appointments/patient/{id}` | Authenticated | Patient's scheduled appointments |
| `POST` | `/api/appointments` | Authenticated | Schedule an appointment |
| `PATCH`| `/api/appointments/{id}/status` | ADMIN, DOCTOR | Update appointment status |
| `GET` | `/api/medical-records` | ADMIN | All clinical records |
| `POST` | `/api/medical-records` | ADMIN, DOCTOR | Create diagnosis & prescriptions |
| `GET` | `/api/bills` | ADMIN | All billing invoices |
| `PATCH`| `/api/bills/{id}/payment` | ADMIN | Toggle bill payment status |

---

## ☁️ Vercel One-Click Deployment (Single Public URL)

You can deploy the entire application (React Frontend + Serverless REST API) directly to **Vercel** with a single public URL.

### 1. Import to Vercel
1. Push this repository to your GitHub account.
2. In Vercel, click **Add New...** -> **Project** and select this repository.
3. Keep the **Root Directory** as `./` (default).
4. Vercel automatically detects the build command (`npm run build --prefix frontend`) and output directory (`frontend/dist`).

### 2. Environment Variables in Vercel
In your Vercel Project Settings -> **Environment Variables**, add:

| Variable | Description | Example |
|---|---|---|
| `DB_URL` | MySQL Connection URL | `jdbc:mysql://<host>:4000/<database>?useSSL=true` |
| `DB_USERNAME` | MySQL Username | `xxxxxx.root` |
| `DB_PASSWORD` | MySQL Password | `your_mysql_password` |
| `JWT_SECRET` | 32+ char secret key | `HospitalManagementSystemSecretKeyForJWTTokenGeneration2024SecureKey` |

*(Note: If `DB_URL` is not yet configured, the system gracefully runs with a persistent pre-seeded demo dataset so you can preview the app immediately).*

