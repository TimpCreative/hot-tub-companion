# Phase 6 — Scale & Polish

**Depends on:** Phase 5 (all core and growth features live)
**Unlocks:** Onboarding additional retailers, marketing the platform
**Estimated effort:** 2–3 weeks

---

## Manual Steps Required (Do These First)

1. **Identify second retailer prospect.** Have at least one retailer beyond TAB lined up for onboarding to validate the white-label process end-to-end.

2. **Collect TAB feedback.** After TAB has been live for a period, collect structured feedback: what's working, what's confusing for customers, what's missing, what admin dashboard improvements they want. Use this to inform polish work.

3. **Audit UHTD coverage.** Review how many of TAB's products are successfully mapped to the UHTD. Identify gaps. Fill remaining model data for the 6 initial brands.

4. **Legal review.** Have a lawyer review the customer-facing Terms of Service and Privacy Policy templates. Ensure CCPA compliance for California users. Prepare a white-label-ready ToS/PP that can be customized per retailer.

5. **AWS evaluation.** If you're approaching 10+ retailers or seeing performance bottlenecks on Railway, begin AWS planning. Get quotes for RDS (PostgreSQL), ECS or Lambda, S3, CloudFront.

---

## What Phase 6 Builds

- Data export/import (customer portability between retailer apps)
- New tub owner guided onboarding experience (first-week flow)
- Multi-spa management refinements
- White-label onboarding automation (templatize the process)
- Performance optimization and hardening
- Second retailer onboarding (validation)
- AWS migration planning (if needed)

---

## Part 1: Data Export/Import

### 1.1 Purpose

If a customer moves to a different city and switches to a different retailer (who also uses Hot Tub Companion), they should be able to export their data from one app and import it into another. This is also good for CCPA compliance (right to data portability).

### 1.2 Export

From Profile → "Export My Data":
- Generates a JSON file containing:
  - User profile (name, email, phone — no passwords)
  - Spa profiles (brand, model, year, sanitization, serial, usage months)
  - Water test history (all entries)
  - Maintenance event history (completed events only)
  - No order data (that belongs to the retailer's Shopify)
  - No loyalty points (those are retailer-specific)
  - No subscription data (retailer-specific)

```json
{
  "exportVersion": "1.0",
  "exportedAt": "2025-06-15T12:00:00Z",
  "platform": "hottubcompanion",
  "user": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "801-555-0123"
  },
  "spaProfiles": [
    {
      "brand": "Jacuzzi",
      "modelLine": "J-300 Collection",
      "model": "J-335",
      "year": 2023,
      "sanitizationSystem": "bromine",
      "serialNumber": "JAC-335-2023-001234",
      "usageMonths": [1,2,3,4,5,6,7,8,9,10,11,12],
      "warrantyExpiration": "2028-06-15",
      "lastFilterChange": "2025-05-01"
    }
  ],
  "waterTests": [
    {
      "testedAt": "2025-06-10T14:30:00Z",
      "ph": 7.4,
      "totalAlkalinity": 95,
      "sanitizerLevel": 4.0,
      "calciumHardness": 180
    }
  ],
  "maintenanceHistory": [
    {
      "eventType": "filter_replace",
      "title": "Replace filter",
      "completedAt": "2025-05-01T10:00:00Z"
    }
  ]
}
```

### 1.3 Import

From onboarding (after registration, before spa registration) or from Profile → "Import Data":
- Upload the JSON export file
- Validate format and version
- Pre-fill spa registration with imported spa data
- Import water test history and maintenance history
- Skip any data that conflicts with existing records (by date)
- Show summary: "Imported: 1 spa profile, 24 water tests, 12 maintenance records"

### 1.4 CCPA Data Request

From Profile → "Request My Data":
- Triggers a backend job that compiles ALL data associated with the user (including orders, notifications, service requests)
- Sends via email as a downloadable file within 30 days (CCPA requirement: 45 days, so 30 is conservative)

From Profile → "Delete My Account":
- Confirmation dialog: "This will permanently delete your account and all associated data. This cannot be undone."
- Triggers deletion of all user data across all tables
- Removes Firebase Auth account
- Sends confirmation email
- For CCPA: retain a hashed record of the deletion request for audit trail

### 1.5 API Endpoints

```
POST   /api/v1/account/export
  → Returns: JSON download

POST   /api/v1/account/import
  Body: multipart form with JSON file
  → Returns: import summary

POST   /api/v1/account/data-request
  → Initiates CCPA data compilation job

DELETE /api/v1/account
  → Permanently deletes user account and all data
```

---

## Part 2: New Owner Onboarding Experience

### 2.1 Guided First-Week Flow

After a customer registers their spa and reaches the main app, if their spa profile was created within the last 7 days, show a "Getting Started" card on the My Tub dashboard with a progress checklist:

**Home screen note:** Implement this as a **dashboard widget** so each dealer can choose whether to include it, adjust ordering, or replace it with their own dealer-specific onboarding flow.

**Day 1: Fill & Initial Setup**
- [ ] "Fill your hot tub" — guide link
- [ ] "Add initial chemicals" — links to guide + recommended products
- [ ] "Set your temperature" — informational tip

**Day 2–3: First Water Test**
- [ ] "Test your water for the first time" → links to Water Care entry
- [ ] "Follow the recommendations" → after test, shows results

**Day 4–5: Maintenance Setup**
- [ ] "Review your maintenance schedule" → links to Maintenance Timeline
- [ ] "Set up automatic deliveries" → links to Subscription Bundles

**Day 7: Enjoy**
- [ ] "Invite your tub for a soak!" → fun completion message

### 2.2 Database

```sql
CREATE TABLE onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  spa_profile_id UUID NOT NULL REFERENCES spa_profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  step_key VARCHAR(50) NOT NULL,  -- 'fill_tub', 'initial_chemicals', 'first_water_test', etc.
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, spa_profile_id, step_key)
);
```

### 2.3 Push Notification Sequence

Trigger automated push notifications for new owners:
- Day 1: "Welcome! Start by filling your [Model] and adding initial chemicals. [Open guide]"
- Day 3: "Time for your first water test! Let's make sure your water is balanced. [Test now]"
- Day 5: "Set up automatic chemical deliveries so you never run out. [Browse subscriptions]"
- Day 7: "You're all set! Enjoy your hot tub. 🎉 Don't forget to test your water weekly."

Only send if the previous step hasn't been completed yet. If the user is ahead of schedule, skip.

---

## Part 3: Multi-Spa Refinements

### 3.1 Improved Spa Switcher

- Persistent spa selector in the app header (visible on Home and Shop tabs)
- Quick-switch dropdown showing spa nickname/model, with "Manage Spas" link
- When switching spas:
  - Shop tab refreshes with new compatibility filter
  - My Tub dashboard updates with the selected spa's data
  - Water Care shows the selected spa's test history
  - Maintenance timeline shows the selected spa's schedule

### 3.2 Per-Spa Subscriptions

Each subscription should be tied to a specific spa profile. When viewing subscriptions, group by spa. When the user switches spa context, the subscription list filters accordingly.

### 3.3 Add Spa Flow

"Add Another Spa" button in Profile → same onboarding wizard as initial registration, but skips account creation. Lands back on Profile with the new spa added.

---

## Part 4: White-Label Onboarding Automation

### 4.1 Tenant Creation Wizard (Super Admin)

Build a guided wizard in the super admin dashboard that streamlines onboarding:

**Step 1: Basic Info**
- Retailer name, slug (auto-generated from name, editable)
- Primary contact email, phone
- Contract start/end dates
- Fulfillment mode selection

**Step 2: Branding**
- Upload logo, app icon, splash screen
- Color pickers for primary, secondary, accent colors
- Font selection (from a preset list of mobile-safe fonts)
- Live preview panel showing how the app will look

**Step 3: POS Connection**
- Select POS type (Shopify / Lightspeed)
- Input API credentials
- "Test Connection" button that validates credentials and pulls a sample product
- Initial product sync trigger

**Step 4: Features**
- Toggle switches for each feature (subscriptions, loyalty, referrals, water care, service scheduling, seasonal timeline)
- For each enabled feature, show relevant config options (loyalty points-per-dollar, referral reward amount, etc.)

**Step 5: Service Types**
- Add service types with name, category, description, estimated duration
- Pre-populated with common defaults that can be customized

**Step 6: Review & Generate**
- Summary of all configuration
- "Create Tenant" button → inserts tenant record, generates API key, provisions subdomain
- "Generate Build Config" → creates the tenant's environment file for mobile app builds
- Checklist of remaining manual steps: submit app to stores, map products to UHTD, upload content

### 4.2 Build Script

Create a CLI script that automates the mobile app build for a new tenant:

```bash
#!/bin/bash
# build-tenant.sh

TENANT=$1
PLATFORM=${2:-"all"}  # ios, android, or all

if [ -z "$TENANT" ]; then
  echo "Usage: ./build-tenant.sh <tenant-slug> [platform]"
  exit 1
fi

# Load tenant config
source ./tenants/$TENANT/config.env

echo "Building $APP_NAME ($TENANT) for $PLATFORM..."

if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "all" ]; then
  TENANT=$TENANT eas build --platform ios --profile production --non-interactive
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "all" ]; then
  TENANT=$TENANT eas build --platform android --profile production --non-interactive
fi

echo "Build complete. Submit to stores:"
echo "  eas submit --platform ios --profile production"
echo "  eas submit --platform android --profile production"
```

### 4.3 Onboarding Checklist Tracker

In the super admin tenant detail page, show a checklist that tracks onboarding progress:

- [ ] Tenant record created
- [ ] Branding assets uploaded
- [ ] POS connected and first sync completed
- [ ] Product → UHTD mapping in progress (show X/Y mapped)
- [ ] Service types configured
- [ ] Content uploaded / universal content enabled
- [ ] Admin dashboard access granted to retailer staff
- [ ] iOS app built and submitted
- [ ] Android app built and submitted
- [ ] iOS app approved
- [ ] Android app approved
- [ ] QA passed
- [ ] Go live

Status can be manually toggled by TimpCreative. Some steps auto-update (POS connected detects from tenant record).

---

## Part 5: Performance Optimization

### 5.1 API Performance

- **Response caching:** Cache tenant config (TTL: 5 minutes), UHTD data (TTL: 1 hour), product listings (TTL: 5 minutes). Use Redis on Railway or in-memory cache with `node-cache`.
- **Database indexing:** Review all query patterns and ensure proper indexes exist. Add composite indexes for common filter combinations.
- **Connection pooling:** Configure Knex pool: min 2, max 10 connections. Monitor connection usage.
- **Pagination:** Ensure ALL list endpoints use cursor-based or offset pagination. No unbounded queries.
- **Query optimization:** Use `EXPLAIN ANALYZE` on slow queries. Avoid N+1 queries in product-UHTD joins.

### 5.2 Mobile App Performance

- **Image optimization:** Use progressive loading (thumbnail → full resolution). Cache images with `expo-image` or `react-native-fast-image`.
- **Data caching:** Cache product listings, content, and tenant config locally. Show cached data immediately, refresh in background.
- **Lazy loading:** Load tab content only when the tab is first visited.
- **Bundle size:** Audit dependencies. Remove unused imports. Use dynamic imports for heavy screens (analytics charts, etc.).

### 5.3 Security Hardening

- **Rate limiting:** Tighten per-endpoint: auth endpoints 5/min, product endpoints 60/min, admin endpoints 30/min.
- **Input validation:** Audit all endpoints for SQL injection (Knex parameterized queries should handle this, but verify), XSS in text fields, malformed UUIDs.
- **API key rotation:** Build endpoint for super admin to rotate a tenant's API key.
- **Audit logging:** Log admin actions (product visibility changes, service status changes, notification sends) to an `audit_log` table.
- **Encryption:** Verify all POS credentials in the tenants table are encrypted at rest using AES-256. Use the `ENCRYPTION_KEY` environment variable.

### 5.4 Error Monitoring

- Integrate **Sentry** (or similar) for both the backend API and mobile app
- Backend: Capture unhandled exceptions, slow queries (>2s), failed POS syncs
- Mobile: Capture crashes, JS errors, API timeouts
- Set up Slack alerts for critical errors

---

## Part 6: Second Retailer Onboarding (Validation)

### 6.1 Process

Onboard the second retailer using the wizard built in Part 4. Document:
- Total time from contract to app-live
- Pain points in the process
- Any code changes required (there should be zero — everything should be config)
- UHTD gaps discovered (new brands/models the second retailer carries)

### 6.2 Success Criteria

The second retailer onboarding validates the platform if:
- No code changes were needed for the app or backend
- Only configuration, branding, and POS connection were required
- Product mapping was assisted by fuzzy matching (not all manual)
- The app launched within 30 days of contract signing
- Both retailer apps can run simultaneously on the same backend without interference

---

## Part 7: AWS Migration Planning

### 7.1 When to Migrate

Migrate to AWS when any of these occur:
- 10+ active retailers
- Railway costs exceed $200/mo (AWS will be more cost-effective at scale)
- Need for multi-region deployment
- Require an SLA guarantee for enterprise retailers

### 7.2 AWS Architecture Target

| Service | AWS Equivalent | Notes |
|---------|---------------|-------|
| Node.js API | ECS Fargate or Lambda | Fargate for consistent load, Lambda for variable |
| PostgreSQL | RDS PostgreSQL | Multi-AZ for high availability |
| File Storage | S3 + CloudFront CDN | Serve images/assets globally |
| Email | SES | Cheaper than SendGrid at scale |
| Caching | ElastiCache (Redis) | Centralized cache for multi-instance API |
| DNS | Route 53 | Wildcard domain routing |
| SSL | ACM (AWS Certificate Manager) | Free SSL for all subdomains |
| Monitoring | CloudWatch + X-Ray | Centralized logging and tracing |
| CI/CD | CodePipeline or continue GitHub Actions | Deploy to ECS/Lambda |

### 7.3 Migration Steps (High-Level)

1. Provision RDS PostgreSQL instance, replicate data from Railway
2. Deploy API to ECS Fargate (Dockerize if not already)
3. Move file storage to S3, update all URLs
4. Set up CloudFront CDN in front of S3
5. Update DNS to point to AWS resources
6. Switch SendGrid to SES
7. Set up ElastiCache Redis for caching
8. Tear down Railway services
9. Monitor for 2 weeks, then decommission Railway

---

## Verification Checklist (Phase 6 Complete = Platform Launch-Ready)

- [ ] Data export generates valid JSON with all user data
- [ ] Data import correctly pre-fills spa registration and imports history
- [ ] CCPA data request and account deletion work correctly
- [ ] New owner onboarding checklist appears for spa profiles < 7 days old
- [ ] Automated push notification sequence fires for new owners
- [ ] Multi-spa switching works correctly across all app sections
- [ ] Super admin tenant creation wizard works end-to-end
- [ ] Build script produces correct retailer-branded apps
- [ ] Second retailer successfully onboarded without code changes
- [ ] Both retailer apps function independently on shared backend
- [ ] API response times < 200ms for common endpoints
- [ ] No N+1 queries in critical paths
- [ ] Error monitoring (Sentry) is active and alerting
- [ ] Security audit passed (rate limiting, input validation, encryption)
- [ ] Legal review of ToS and Privacy Policy complete
- [ ] UHTD coverage is sufficient for both retailers' product lines
- [ ] AWS migration plan documented (if needed)
