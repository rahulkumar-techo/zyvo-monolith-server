# Admin & Back-Office Authentication API Documentation

This document covers the authentication workflows, endpoints, security architecture, and operational guidelines for **Administrators (`ADMIN`)** and **Super Administrators (`SUPER_ADMIN`)** accessing the ZYVO Back-Office Control Center.

---

## 1. Security Architecture & Principles

1. **No Self-Registration**:
   - The public registration endpoint (`POST /register`) and OTP verification endpoint (`POST /otp/verify`) automatically assign the base role `PASSENGER`.
   - Elevated roles (`ADMIN`, `SUPER_ADMIN`) **cannot** be chosen by clients. They must be provisioned via database seed scripts or promoted by an existing `SUPER_ADMIN`.
2. **Strict Identity Isolation**:
   - Admin logins require verified email and high-entropy passwords.
   - Admin JWT access tokens contain `role: "ADMIN"` or `role: "SUPER_ADMIN"`, which are validated on all sensitive back-office endpoints via RBAC preHandlers.
3. **Session Audit & Revocation**:
   - Every admin session logs client IP address and User-Agent in the `sessions` table.
   - Admins can inspect all active dashboard sessions and immediately terminate unauthorized access points.

---

## 2. Admin Authentication Flow

```text
[ZYVO Admin Portal]                                     [ZYVO Backend]
         |                                                     |
         |  1. POST /api/v1/auth/login                         |
         |     { "email": "ops@zyvo.in", "password": "***" }   |
         |---------------------------------------------------->|
         |                                                     |-- Verify password hash (argon2id)
         |                                                     |-- Verify status == ACTIVE
         |                                                     |-- Verify role in [ADMIN, SUPER_ADMIN]
         |                                                     |-- Issue Access Token (15m)
         |                                                     |-- Set HttpOnly Secure Refresh Cookie
         |  2. Returns Access Token + Admin profile            |
         |<----------------------------------------------------|
         |                                                     |
         |  3. Subsequent admin requests                       |
         |     Authorization: Bearer <accessToken>             |
         |---------------------------------------------------->|
         |                                                     |-- fastify.authenticate validates token
         |                                                     |-- Module RBAC validates role == ADMIN
         |<----------------------------------------------------|
```

---

## 3. Endpoints

### 3.1 Admin Login (`POST /login`)
Authenticates an administrator using verified email credentials.

- **URL**: `/api/v1/auth/login`
- **Method**: `POST`
- **Auth**: Public

#### Request Headers
```http
Content-Type: application/json
```

#### Request Body
```json
{
  "email": "admin@zyvo.in",
  "password": "SuperSecureAdminPassword#2026"
}
```

#### Example cURL
```bash
curl -X POST "http://localhost:10000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@zyvo.in",
    "password": "SuperSecureAdminPassword#2026"
  }'
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ey...",
    "refreshToken": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "user": {
      "id": "admin-uuid-001",
      "email": "admin@zyvo.in",
      "phone": "+919811122233",
      "name": "Sarah Connor (Operations Lead)",
      "role": "ADMIN",
      "status": "ACTIVE",
      "createdAt": "2026-01-15T09:00:00.000Z"
    }
  },
  "requestId": "req-adm-1"
}
```
*Note: The response sets a `Set-Cookie: refreshToken=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` header for dashboard security.*

---

### 3.2 Verify Admin Identity & Permissions (`GET /me`)
Validates that the current bearer token is active and confirms current role and status.

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
    "id": "admin-uuid-001",
    "email": "admin@zyvo.in",
    "phone": "+919811122233",
    "name": "Sarah Connor (Operations Lead)",
    "role": "ADMIN",
    "status": "ACTIVE",
    "createdAt": "2026-01-15T09:00:00.000Z"
  },
  "requestId": "req-adm-2"
}
```

---

### 3.3 Dashboard Token Refresh (`POST /token/refresh`)
Silently rotates the admin refresh token to maintain back-office dashboard sessions.

- **URL**: `/api/v1/auth/token/refresh`
- **Method**: `POST`
- **Auth**: Public (reads `refreshToken` from HttpOnly cookie or request body)

#### Request Body (Optional if using Cookie)
```json
{
  "refreshToken": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...new-access-token",
    "refreshToken": "f4c1d55309gd2...new-refresh-token"
  },
  "requestId": "req-adm-3"
}
```

---

### 3.4 Audit Active Admin Sessions (`GET /sessions`)
Returns a list of all active login locations, IP addresses, and user-agent strings for security audits.

- **URL**: `/api/v1/auth/sessions`
- **Method**: `GET`
- **Auth Required**: Yes (`Bearer <accessToken>`)

#### Example cURL
```bash
curl -X GET "http://localhost:10000/api/v1/auth/sessions" \
  -H "Authorization: Bearer <accessToken>"
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "sess-adm-chrome-office",
      "deviceId": "HQ-MacBook-Pro-16",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0.0.0",
      "ipAddress": "198.51.100.42",
      "expiresAt": "2026-11-23T09:00:00.000Z",
      "createdAt": "2026-10-24T09:00:00.000Z"
    },
    {
      "id": "sess-adm-iphone-remote",
      "deviceId": "Ops-iPhone-16",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      "ipAddress": "203.0.113.88",
      "expiresAt": "2026-11-20T14:20:00.000Z",
      "createdAt": "2026-10-21T14:20:00.000Z"
    }
  ],
  "requestId": "req-adm-4"
}
```

---

### 3.5 Terminate Specific Admin Session (`DELETE /sessions/:sessionId`)
Forcefully revokes a specific dashboard session (e.g. if an administrator leaves an office workstation logged in).

- **URL**: `/api/v1/auth/sessions/:sessionId`
- **Method**: `DELETE`
- **Auth Required**: Yes (`Bearer <accessToken>`)

#### Example cURL
```bash
curl -X DELETE "http://localhost:10000/api/v1/auth/sessions/sess-adm-iphone-remote" \
  -H "Authorization: Bearer <accessToken>"
```

#### Successful Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "message": "Session revoked successfully"
  },
  "requestId": "req-adm-5"
}
```

---

### 3.6 Global Admin Logout (`POST /logout-all`)
Revokes every active token and session across all browsers and devices for this administrator account.

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
  "requestId": "req-adm-6"
}
```

---

## 4. Admin Security Checklist & Best Practices

1. **Session Invalidation on Role Change**:
   If an administrator's privileges are revoked or status changed to `BLOCKED`, call `authService.revokeAllSessions(adminId)` to immediately terminate active refresh capabilities.
2. **CORS Whitelisting**:
   Ensure `CORS_ORIGIN` in `.env` or Render environment settings is strictly restricted to authorized admin portal domains (e.g., `https://admin.zyvo.in`) instead of wildcard `*`.
3. **Audit Log Trail**:
   All administrative actions performed using the issued JWT should log `userId`, `ipAddress`, and `reqId` to the audit ledger for regulatory and compliance review.
