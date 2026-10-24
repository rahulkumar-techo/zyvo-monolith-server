# Passenger Authentication API Documentation

This document covers the authentication endpoints, workflows, request/response contracts, and error handling for **Passengers** using the ZYVO ride-hailing client (mobile or web).

---

## 1. Authentication Flow Overview

Passengers authenticate primarily through **Phone Number + OTP** (One-Time Password):

```text
[Passenger App]                                         [ZYVO Backend]
       |                                                       |
       |  1. POST /api/v1/auth/otp/request                     |
       |     { phone: "+919876543210" }                        |
       |------------------------------------------------------>|
       |                                                       |-- Generate OTP & hash
       |                                                       |-- Store in Redis (TTL: 5m)
       |                                                       |-- Send SMS (mocked in dev)
       |  2. Returns OTP dispatched (or code in dev)           |
       |<------------------------------------------------------|
       |                                                       |
       |  3. POST /api/v1/auth/otp/verify                      |
       |     { phone: "+919876543210", code: "123456" }       |
       |------------------------------------------------------>|
       |                                                       |-- Verify hash & expiry
       |                                                       |-- Find or auto-create User
       |                                                       |-- Issue Access & Refresh Tokens
       |  4. Returns Access Token + User profile               |
       |<------------------------------------------------------|
```

---

## 2. Base URL & Common Headers

- **Base URL**: `https://<api-host>/api/v1/auth` (or `http://localhost:10000/api/v1/auth`)
- **Content-Type**: `application/json`

### Standard Response Format
All successful responses return:
```json
{
  "success": true,
  "data": { ... },
  "requestId": "req-xxx"
}
```

All error responses return:
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Human readable error description",
    "details": []
  },
  "requestId": "req-xxx"
}
```

---

## 3. Endpoints

### 3.1 Request OTP (`POST /otp/request`)
Generates and dispatches a 6-digit OTP to the passenger's mobile number.

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
*Note: `phone` must strictly follow the E.164 format (e.g., `+1XXXXXXXXXX`, `+91XXXXXXXXXX`).*

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
    "otp": "123456"
  },
  "requestId": "req-1"
}
```
*(Note: `otp` is only returned in non-production environments for testing).*

---

### 3.2 Verify OTP (`POST /otp/verify`)
Verifies the submitted 6-digit code. If the user does not exist, a new account with role `PASSENGER` is automatically created.

- **URL**: `/api/v1/auth/otp/verify`
- **Method**: `POST`
- **Auth**: Public

#### Request Body
```json
{
  "phone": "+919876543210",
  "code": "123456",
  "deviceId": "passenger-iphone-15-uuid"
}
```

#### Example cURL
```bash
curl -X POST "http://localhost:10000/api/v1/auth/otp/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "+919876543210",
    "code": "123456",
    "deviceId": "passenger-device-01"
  }'
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d3b07384d113edec49eaa6238ad5ff00...",
    "user": {
      "id": "6d123e45-6789-4abc-def0-123456789abc",
      "phone": "+919876543210",
      "email": null,
      "name": null,
      "role": "PASSENGER",
      "status": "ACTIVE",
      "createdAt": "2026-10-24T12:00:00.000Z"
    }
  },
  "requestId": "req-2"
}
```
*Note: A secure, HTTP-only cookie `refreshToken` is also set in the response headers.*

---

### 3.3 Get Current Passenger Profile (`GET /me`)
Fetches the currently authenticated passenger's profile.

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
    "id": "6d123e45-6789-4abc-def0-123456789abc",
    "phone": "+919876543210",
    "email": "passenger@example.com",
    "name": "Alex Johnson",
    "role": "PASSENGER",
    "status": "ACTIVE",
    "createdAt": "2026-10-24T12:00:00.000Z"
  },
  "requestId": "req-3"
}
```

---

### 3.4 Refresh Access Token (`POST /token/refresh`)
Rotates the refresh token and returns a new short-lived access token without interrupting the passenger.

- **URL**: `/api/v1/auth/token/refresh`
- **Method**: `POST`
- **Auth**: Public (requires valid `refreshToken` either in cookie or JSON body)

#### Request Body
```json
{
  "refreshToken": "d3b07384d113edec49eaa6238ad5ff00..."
}
```

#### Example cURL
```bash
curl -X POST "http://localhost:10000/api/v1/auth/token/refresh" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "<refreshToken>"}'
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "e4c18495e224fe...new-rotated-token"
  },
  "requestId": "req-4"
}
```

---

### 3.5 List Passenger Sessions (`GET /sessions`)
View all devices currently logged in to this passenger account.

- **URL**: `/api/v1/auth/sessions`
- **Method**: `GET`
- **Auth Required**: Yes (`Bearer <accessToken>`)

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "sess-uuid-1",
      "deviceId": "passenger-iphone-15-uuid",
      "userAgent": "Mozilla/5.0 ...",
      "ipAddress": "203.0.113.1",
      "expiresAt": "2026-11-23T12:00:00.000Z",
      "createdAt": "2026-10-24T12:00:00.000Z"
    }
  ],
  "requestId": "req-5"
}
```

---

### 3.6 Passenger Logout (`POST /logout`)
Logs out from the current device and revokes the active refresh token.

- **URL**: `/api/v1/auth/logout`
- **Method**: `POST`
- **Auth**: Public or Authenticated (via cookie or body `refreshToken`)

#### Request Body
```json
{
  "refreshToken": "<refreshToken>"
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  },
  "requestId": "req-6"
}
```

---

### 3.7 Logout From All Devices (`POST /logout-all`)
Revokes every active session across all passenger devices (e.g. if the phone was lost).

- **URL**: `/api/v1/auth/logout-all`
- **Method**: `POST`
- **Auth Required**: Yes (`Bearer <accessToken>`)

#### Example cURL
```bash
curl -X POST "http://localhost:10000/api/v1/auth/logout-all" \
  -H "Authorization: Bearer <accessToken>"
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "All sessions revoked successfully"
  },
  "requestId": "req-7"
}
```

---

## 4. Error Codes & Handling

| Error Code | HTTP Status | Cause | Resolution |
| :--- | :--- | :--- | :--- |
| `VALIDATION_ERROR` | `400` | Invalid phone format (not E.164) or malformed body | Send phone formatted with country code (e.g. `+919876543210`) |
| `INVALID_OTP` | `400` | Code is incorrect | Prompt user to re-enter the 6-digit code |
| `OTP_EXPIRED` | `400` | OTP validity window exceeded (5 minutes) | Call `/otp/request` again |
| `OTP_ATTEMPTS_EXCEEDED` | `429` | Maximum verification attempts (5) reached | Wait for lockout period before requesting a new OTP |
| `UNAUTHORIZED` | `401` | Missing or expired Bearer access token | Trigger `/token/refresh` with refresh token |
| `FORBIDDEN` | `403` | Passenger account is `BLOCKED` or `SUSPENDED` | Display support contact screen |
