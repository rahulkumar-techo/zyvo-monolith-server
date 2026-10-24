# Rider & Driver Authentication API Documentation

This document covers the authentication endpoints, workflows, security practices, and request/response specifications for **Riders and Driver Partners** in the ZYVO ride-hailing backend.

---

## 1. Authentication Flow Overview

Drivers and Riders operate on high-frequency mobile terminals, vehicle tablets, and navigation hardware. The authentication flow supports both **Phone Number + OTP** (primary for quick on-duty sign-in) and **Email / Password** registration for drivers registered through fleet portals:

```text
[Driver Mobile App / Vehicle Device]                     [ZYVO Backend]
                 |                                             |
                 |  1. POST /api/v1/auth/otp/request           |
                 |     { phone: "+919876543210" }              |
                 |-------------------------------------------->|
                 |                                             |-- Rate-limit & generate OTP
                 |  2. Returns OTP sent confirmation           |
                 |<--------------------------------------------|
                 |                                             |
                 |  3. POST /api/v1/auth/otp/verify            |
                 |     { phone, code, deviceId: "veh-tab-01" } |
                 |-------------------------------------------->|
                 |                                             |-- Authenticate Rider / Driver
                 |                                             |-- Issue JWT & store session with deviceId
                 |  4. Returns Access Token + Refresh Token    |
                 |<--------------------------------------------|
```

---

## 2. Base URL & Security Considerations

- **Base URL**: `https://<api-host>/api/v1/auth` (or `http://localhost:10000/api/v1/auth`)
- **Token Expiry**:
  - Access Token: `15 minutes` (short-lived, passed in `Authorization: Bearer <token>`)
  - Refresh Token: `30 days` (rotating refresh token stored in secure device storage / keychain)
- **Device Identification**: Always transmit `deviceId` during verify/login to ensure driver hardware sessions are tracked for fraud prevention.

---

## 3. Endpoints

### 3.1 Driver OTP Request (`POST /otp/request`)
Requests a 6-digit verification code to the registered driver phone.

- **URL**: `/api/v1/auth/otp/request`
- **Method**: `POST`
- **Auth**: Public

#### Request Body
```json
{
  "phone": "+919876543210",
  "purpose": "LOGIN"
}
```

#### Example cURL
```bash
curl -X POST "http://localhost:10000/api/v1/auth/otp/request" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "purpose": "LOGIN"}'
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "OTP sent successfully",
    "phone": "+919876543210",
    "expiresIn": 300,
    "otp": "654321"
  },
  "requestId": "req-r1"
}
```

---

### 3.2 Driver OTP Verification (`POST /otp/verify`)
Authenticates the driver, verifies the hardware `deviceId`, and issues tokens.

- **URL**: `/api/v1/auth/otp/verify`
- **Method**: `POST`
- **Auth**: Public

#### Request Body
```json
{
  "phone": "+919876543210",
  "code": "654321",
  "deviceId": "samsung-tab-active4-imei-98765"
}
```

#### Example cURL
```bash
curl -X POST "http://localhost:10000/api/v1/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "code": "654321",
    "deviceId": "samsung-tab-active4-imei-98765"
  }'
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "7a94bf321d...",
    "user": {
      "id": "driver-uuid-456",
      "phone": "+919876543210",
      "email": "driver.rajesh@zyvo.in",
      "name": "Rajesh Kumar",
      "role": "DRIVER",
      "status": "ACTIVE",
      "createdAt": "2026-08-10T08:30:00.000Z"
    }
  },
  "requestId": "req-r2"
}
```

---

### 3.3 Driver Registration / Onboarding (`POST /register`)
For onboarding driver partners registered through partner fleets or web onboarding portals.

- **URL**: `/api/v1/auth/register`
- **Method**: `POST`
- **Auth**: Public

#### Request Body
```json
{
  "name": "Rajesh Kumar",
  "phone": "+919876543210",
  "email": "driver.rajesh@zyvo.in",
  "password": "StrongPassword123!"
}
```

#### Successful Response (`201 Created`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "8b05cf12...",
    "user": {
      "id": "driver-uuid-456",
      "phone": "+919876543210",
      "email": "driver.rajesh@zyvo.in",
      "name": "Rajesh Kumar",
      "role": "PASSENGER",
      "status": "ACTIVE",
      "createdAt": "2026-10-24T12:00:00.000Z"
    }
  },
  "requestId": "req-r3"
}
```
*Note: New registrations default to `PASSENGER`. Fleet admin verification upgrades the role to `DRIVER`/`RIDER` upon document approval.*

---

### 3.4 Email/Password Login (`POST /login`)
Alternative login for drivers with credentials configured.

- **URL**: `/api/v1/auth/login`
- **Method**: `POST`
- **Auth**: Public

#### Request Body
```json
{
  "email": "driver.rajesh@zyvo.in",
  "password": "StrongPassword123!"
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "9c12df34...",
    "user": {
      "id": "driver-uuid-456",
      "phone": "+919876543210",
      "email": "driver.rajesh@zyvo.in",
      "name": "Rajesh Kumar",
      "role": "DRIVER",
      "status": "ACTIVE",
      "createdAt": "2026-08-10T08:30:00.000Z"
    }
  },
  "requestId": "req-r4"
}
```

---

### 3.5 Token Rotation During Shift (`POST /token/refresh`)
Driver apps maintain background location and socket connections. When the 15-minute access token expires, the client calls `/token/refresh` without prompting the driver.

- **URL**: `/api/v1/auth/token/refresh`
- **Method**: `POST`
- **Auth**: Public (Pass refresh token in body or HttpOnly cookie)

#### Request Body
```json
{
  "refreshToken": "7a94bf321d..."
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...new-access-token",
    "refreshToken": "3e91bb78...new-refresh-token"
  },
  "requestId": "req-r5"
}
```

---

### 3.6 Check Driver Profile & Verification Status (`GET /me`)
Returns the driver's current status and identity. If the driver is suspended or pending document verification, the client handles navigation blocks accordingly.

- **URL**: `/api/v1/auth/me`
- **Method**: `GET`
- **Auth Required**: Yes (`Bearer <accessToken>`)

#### Example cURL
```bash
curl -X GET "http://localhost:10000/api/v1/auth/me" \
  -H "Authorization: Bearer <accessToken>"
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "driver-uuid-456",
    "phone": "+919876543210",
    "email": "driver.rajesh@zyvo.in",
    "name": "Rajesh Kumar",
    "role": "DRIVER",
    "status": "ACTIVE",
    "createdAt": "2026-08-10T08:30:00.000Z"
  },
  "requestId": "req-r6"
}
```

---

### 3.7 Active Hardware Sessions (`GET /sessions`)
Inspect active sessions tied to driver tablets and mobile phones.

- **URL**: `/api/v1/auth/sessions`
- **Method**: `GET`
- **Auth Required**: Yes (`Bearer <accessToken>`)

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "session-tab-01",
      "deviceId": "samsung-tab-active4-imei-98765",
      "userAgent": "ZYVO-Driver-Android/2.4.0",
      "ipAddress": "49.204.120.5",
      "expiresAt": "2026-11-23T08:30:00.000Z",
      "createdAt": "2026-10-24T08:30:00.000Z"
    }
  ],
  "requestId": "req-r7"
}
```

---

### 3.8 Revoke Replaced Hardware / Device Session (`DELETE /sessions/:sessionId`)
If a vehicle tablet is replaced or damaged, the driver or fleet manager can revoke that specific session ID.

- **URL**: `/api/v1/auth/sessions/:sessionId`
- **Method**: `DELETE`
- **Auth Required**: Yes (`Bearer <accessToken>`)

#### Example cURL
```bash
curl -X DELETE "http://localhost:10000/api/v1/auth/sessions/session-tab-01" \
  -H "Authorization: Bearer <accessToken>"
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Session revoked successfully"
  },
  "requestId": "req-r8"
}
```

---

### 3.9 End Shift / Logout (`POST /logout`)
Terminates the current driver shift session and invalidates the refresh token.

- **URL**: `/api/v1/auth/logout`
- **Method**: `POST`
- **Auth**: Public or Authenticated

#### Request Body
```json
{
  "refreshToken": "7a94bf321d..."
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "requestId": "req-r9"
}
```

---

## 4. Driver Status Codes & UI State Mapping

| Status | Behavior & UI Handling |
| :--- | :--- |
| `ACTIVE` | Normal shift. Can toggle online/offline, accept dispatch pings. |
| `INACTIVE` | Driver has not completed document onboarding. Redirect to document submission screen. |
| `SUSPENDED` | Account suspended due to safety or rating threshold. Block ride acceptances and show support dialogue. |
| `BLOCKED` | Account permanently blocked. Invalidate all local tokens and display contact compliance message. |
