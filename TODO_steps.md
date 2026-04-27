# Implementation Plan for Email Verification (Steps 13-17)

## Step 1: Create detailed TODO_steps.md [✅ Current]

## Step 2: Fix backend dependencies [✅ Complete]
- Edit backend/app/schemas/auth.py: Add VerifyRequest, ResendRequest, SimpleResponse
- Edit backend/app/routers/auth.py: Add imports, fix /verify endpoint (Pydantic, datetime.tz)
- Edit backend/app/services/email.py: Fix verification_url to '/auth/verify?token='

## Step 3: Update frontend types and constants [✅ Complete]
- Edit frontend/src/types/api.ts: Add VerifyPayload, ResendPayload, VerifyResponse
- Edit frontend/src/services/auth.ts: Update types for verify/resend  
- Edit frontend/src/utils/constants.ts: Add ROUTES.verify = '/auth/verify'

## Step 4: Update frontend/src/pages/Auth.tsx [✅ Complete]
- Add new AuthMode: 'check-email', 'verify-email', 'resend'
- Add states: tempCreds, isVerifying
- useEffect for ?token= → 'verify-email'
- Post-register: localStorage tempCreds {email, password, full_name?}, → 'check-email'
- Verify flow: verifyEmail(token), login(tempCreds), clear temp, dashboard
- Resend form: resendVerification → toast → 'check-email'

## Step 5: Test full flow manually [Pending - manual user action]

## Step 3: Update frontend types and constants
- Edit frontend/src/types/api.ts: Add VerifyPayload, ResendPayload, VerifyResponse
- Edit frontend/src/services/auth.ts: Update types for verify/resend
- Edit frontend/src/utils/constants.ts: Add ROUTES.verify = '/auth/verify'

## Step 4: Update frontend/src/pages/Auth.tsx
- Add new AuthMode: 'check-email', 'verify-email', 'resend'
- Add states: tempCreds, isVerifying
- useEffect for ?token= → 'verify-email'
- Post-register: localStorage tempCreds {email, password, full_name?}, → 'check-email'
- Verify flow: verifyEmail(token), login(tempCreds), clear temp, dashboard
- Resend form: resendVerification → toast → 'check-email'

## Step 5: Test full flow manually
- Backend server running? Register → check email UI → simulate token → verify → dashboard
- Login requires verified

## Step 6: alembic upgrade head

## Step 7: cd frontend && npm i && npm test

## Step 8: Update TODO.md: Mark step 13 [x]

## Step 9: Update README.md with auth flow docs

## Step 10: attempt_completion

*Progress: Updated after each step.*

