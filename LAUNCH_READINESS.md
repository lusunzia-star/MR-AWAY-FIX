# MR AWAY FIX launch readiness

This checklist records the items that must be verified before accepting real customer jobs or payments.

## Completed in the website repository
- Public website and HTTPS are configured for mrawayfix.co.za.
- The app script was cleaned of 47 embedded ASCII control characters that could render as stray symbols.
- The app script cache version was incremented so browsers request the updated file.

## Must be completed before a public launch with real payments
- Confirm Paystack has approved the MR AWAY FIX business and enabled live ZAR transactions. Do not assume approval from test-mode access.
- Finish a secure provider payout onboarding flow. The current payment function requires each provider to have a Paystack subaccount code, but ordinary provider registration does not create one.
- Confirm Paystack supports the intended South African marketplace split and settlement arrangement for this account.
- Test in Paystack test mode with a test customer and test provider: job completion, customer-approved final amount, payment initialization, signed webhook, idempotency, 10% platform commission, and provider settlement records.
- Review Supabase security advisories, especially authenticated access to SECURITY DEFINER functions and leaked-password protection.
- Verify refunds, cancellations, disputes, provider identity checks, privacy notice, terms, and support contact details.
- Only after all checks pass, merge the reviewed code changes and verify the live domain.

## Safety
Never place Paystack secret keys, bank account details, or service-role keys in browser code or public GitHub files. Do not run a real-money payment as a test.
