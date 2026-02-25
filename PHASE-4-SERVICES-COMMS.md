# Phase 4 — Services & Communication

**Depends on:** Phase 3 (engagement features live)
**Unlocks:** Phase 5 (growth features)
**Estimated effort:** 2–3 weeks

---

## Manual Steps Required (Do These First)

1. **Define TAB's service types.** Work with Take A Break to list every service they offer, categorized as Water Valet or Technician. Get: service name, description, estimated duration, typical cost range (for display only — pricing is up to the retailer). Example: "Filter Change" (Water Valet, ~30 min), "Pump Replacement" (Technician, ~2 hrs), "Delivery & Setup" (Technician, ~4 hrs).

2. **Determine TAB's scheduling tool.** Ask if they use any scheduling software (e.g., Housecall Pro, Jobber, ServiceTitan, Google Calendar). If yes, investigate API availability. If no, they'll use our request system.

3. **Set up a TimpCreative support email** (e.g., support@hottubcompanion.com) for the retailer inbox system.

---

## What Phase 4 Builds

- Service request system (Water Valet vs Technician categories, retailer-configurable types)
- Retailer scheduling tool integration or built-in request flow
- Two-way retailer ↔ TimpCreative inbox
- Urgent banner system (admin dashboards + customer app)
- Retailer-initiated push notification scheduling

---

## Part 1: Service Request System

### 1.1 Database Tables

```sql
CREATE TABLE service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL,  -- 'water_valet' | 'technician'
  estimated_duration_minutes INTEGER,
  display_price_range VARCHAR(50),  -- "$75–$125" (display only, not binding)
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  spa_profile_id UUID REFERENCES spa_profiles(id),
  service_type_id UUID NOT NULL REFERENCES service_types(id),

  -- Request details
  description TEXT,  -- customer's description of what they need
  preferred_date_1 DATE,
  preferred_date_2 DATE,
  preferred_time_window VARCHAR(20),  -- 'morning' | 'afternoon' | 'evening' | 'anytime'

  -- Service address (default from user profile, overridable)
  service_address_line1 VARCHAR(255),
  service_address_line2 VARCHAR(255),
  service_city VARCHAR(100),
  service_state VARCHAR(50),
  service_zip VARCHAR(20),

  -- Status tracking
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- pending → confirmed → in_progress → completed → cancelled
  confirmed_date DATE,
  confirmed_time_window VARCHAR(50),  -- retailer may provide specific time
  assigned_to VARCHAR(255),  -- name of technician/valet assigned

  -- Notes
  retailer_notes TEXT,  -- internal notes from retailer
  completion_notes TEXT,  -- notes after service is done
  customer_rating INTEGER CHECK (customer_rating BETWEEN 1 AND 5),
  customer_feedback TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_service_tenant ON service_requests(tenant_id, status);
CREATE INDEX idx_service_user ON service_requests(user_id);
CREATE INDEX idx_service_date ON service_requests(confirmed_date) WHERE status IN ('confirmed','in_progress');

CREATE TABLE service_request_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  updated_by UUID REFERENCES users(id),  -- null if system-generated
  old_status VARCHAR(30),
  new_status VARCHAR(30),
  message TEXT,  -- optional message to customer
  is_visible_to_customer BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 1.2 Customer Service Request Flow

**Services tab in app:**

1. **Service type selection screen:**
   - List of active service types for this tenant, grouped by category
   - Section header: "Water Valet Services" with description: "Routine maintenance by trained service personnel"
   - Section header: "Technician Services" with description: "Repairs and installations by factory-trained technicians"
   - Each service card: name, description, estimated duration, price range indicator
   - Tap a service → navigate to request form

2. **Request form:**
   - Pre-selected service type (shown at top, tappable to change)
   - Spa selector (if multiple spas — which spa needs service?)
   - Description text area: "Describe what you need help with"
   - Preferred dates: two date pickers ("First choice" and "Second choice")
   - Preferred time: "Morning (8am–12pm)" / "Afternoon (12pm–5pm)" / "Evening (5pm–8pm)" / "Anytime"
   - Service address: pre-filled from profile, editable. "Service at a different address?" toggle.
   - "Submit Request" button

3. **Confirmation screen:**
   - "Your service request has been submitted! [Retailer Name] will confirm your appointment."
   - Summary of request details
   - "We'll notify you when your appointment is confirmed."

4. **My Service Requests screen:**
   - List of all service requests sorted by date
   - Status badges: 🟡 Pending, 🟢 Confirmed, 🔵 In Progress, ✅ Completed, ❌ Cancelled
   - Tap to view details:
     - Full request info
     - Status history timeline (from service_request_updates)
     - If confirmed: confirmed date/time and assigned technician name
     - If completed: option to rate the service (1–5 stars + feedback text)
     - Cancel button (if status is pending or confirmed)

### 1.3 Retailer Admin Service Management

`/admin/services` page in dashboard:

**Service request queue:**
- Table: Customer name, Service type, Category (Water Valet/Technician badge), Requested dates, Status, Created date
- Filters: status, category, date range
- Click a request to open detail panel:
  - Customer info and spa details
  - Request description
  - **Confirm button:** Set confirmed date, time window, assigned technician → sends push notification to customer: "Your [Service Type] has been confirmed for [Date] at [Time]. Assigned to: [Name]"
  - **In Progress button:** Marks as in progress (technician has arrived)
  - **Complete button:** Add completion notes → marks as completed → sends push notification: "Your [Service Type] is complete! Rate your experience →"
  - **Cancel button:** Add reason → sends push notification with reason
  - **Internal notes** field (not visible to customer)

**Service type configuration:**
- `/admin/settings/services` — manage service types
- Add/edit/deactivate service types
- Reorder with drag-and-drop
- Set category, description, estimated duration, price range display

### 1.4 External Scheduling Integration (Optional)

If a retailer uses an external scheduling tool, we integrate at the request level:

- On service request submission, instead of (or in addition to) storing in our database, fire a webhook to the retailer's scheduling tool
- If the tool has an API (e.g., Housecall Pro API), create a job/appointment in their system
- Listen for status updates from their system via webhook to update our status

**Implementation:** Create a `scheduling_adapter` pattern similar to the POS adapter:
```typescript
interface SchedulingAdapter {
  createJob(request: ServiceRequest): Promise<{ externalJobId: string }>;
  getJobStatus(externalJobId: string): Promise<string>;
  cancelJob(externalJobId: string): Promise<void>;
}
```

Build adapters as needed per retailer. Default behavior (no adapter) = manual management through admin dashboard.

### 1.5 API Endpoints

```
# Customer
GET    /api/v1/service-types
POST   /api/v1/service-requests
GET    /api/v1/service-requests
GET    /api/v1/service-requests/:id
PUT    /api/v1/service-requests/:id/cancel
POST   /api/v1/service-requests/:id/rate
  Body: { rating: 4, feedback: "Great service!" }

# Admin
GET    /api/v1/admin/service-requests?status=X&category=X&dateFrom=X&dateTo=X
GET    /api/v1/admin/service-requests/:id
PUT    /api/v1/admin/service-requests/:id/confirm
  Body: { confirmedDate, confirmedTimeWindow, assignedTo }
PUT    /api/v1/admin/service-requests/:id/status
  Body: { status, notes?, messageToCustomer? }
GET    /api/v1/admin/service-types
POST   /api/v1/admin/service-types
PUT    /api/v1/admin/service-types/:id
DELETE /api/v1/admin/service-types/:id
```

---

## Part 2: Retailer ↔ TimpCreative Inbox

### 2.1 Database Tables

```sql
CREATE TABLE inbox_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject VARCHAR(500) NOT NULL,
  started_by VARCHAR(20) NOT NULL,  -- 'retailer' | 'timpcreative'
  status VARCHAR(20) DEFAULT 'open',  -- 'open' | 'closed'
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_threads_tenant ON inbox_threads(tenant_id, last_message_at DESC);

CREATE TABLE inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
  sender_type VARCHAR(20) NOT NULL,  -- 'retailer' | 'timpcreative'
  sender_user_id UUID REFERENCES users(id),
  sender_name VARCHAR(255),
  body TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',  -- [{ url, filename, mimeType }]
  read_at TIMESTAMPTZ,  -- null = unread by recipient
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_thread ON inbox_messages(thread_id, created_at);
```

### 2.2 Retailer Dashboard Inbox

`/admin/inbox` page:

- **Thread list:** Subject, last message preview, timestamp, unread indicator, status badge
- **Thread view:** Conversation-style message display (like email thread). Compose reply at bottom.
- **New thread:** Button to start a new message to TimpCreative
- **Email notification:** When TimpCreative sends a message, send email notification to retailer admin(s) with `can_manage_settings` permission

### 2.3 Super Admin Inbox

`/super-admin/messages` page:

- **All threads** across all retailers, sortable/filterable by retailer, status, date
- Unread count badge in sidebar navigation
- Same thread view with reply capability
- Can close/reopen threads
- Can start new threads with any retailer

### 2.4 API Endpoints

```
# Retailer Admin
GET    /api/v1/admin/inbox/threads?status=open
POST   /api/v1/admin/inbox/threads
  Body: { subject, body }
GET    /api/v1/admin/inbox/threads/:id/messages
POST   /api/v1/admin/inbox/threads/:id/messages
  Body: { body, attachments? }
PUT    /api/v1/admin/inbox/threads/:id/read  (mark all messages as read)

# Super Admin
GET    /api/v1/super-admin/inbox/threads?tenantId=X&status=X
POST   /api/v1/super-admin/inbox/threads
  Body: { tenantId, subject, body }
GET    /api/v1/super-admin/inbox/threads/:id/messages
POST   /api/v1/super-admin/inbox/threads/:id/messages
PUT    /api/v1/super-admin/inbox/threads/:id/status
  Body: { status: 'closed' }
```

---

## Part 3: Urgent Banner System

### 3.1 Database Table

```sql
CREATE TABLE system_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES users(id),  -- TimpCreative admin
  
  -- Targeting
  target VARCHAR(20) NOT NULL,  -- 'all_admins' | 'specific_tenant' | 'all_customers' | 'tenant_customers'
  target_tenant_id UUID REFERENCES tenants(id),  -- if targeting specific tenant

  -- Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'info',  -- 'info' | 'warning' | 'critical'
  link_url TEXT,  -- optional link for more info
  link_text VARCHAR(100),

  -- Timing
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- null = manual deactivation

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.2 Banner Display

**Admin dashboards:** On page load, fetch active banners targeting this tenant's admins or all admins. Display at top of page as a dismissible banner. Color by severity: blue (info), yellow (warning), red (critical). Critical banners cannot be dismissed.

**Customer app:** On app launch or resume from background, fetch active banners targeting this tenant's customers or all customers. Display as a modal or top banner. Examples: "Checkout is temporarily unavailable. We're working on it." / "Scheduled maintenance tonight 11pm–1am MT."

### 3.3 Super Admin Banner Management

`/super-admin/banners` page:

- List of all banners (active and expired)
- Create banner: target selector, title, body, severity, optional link, start time, expiration time
- Edit/deactivate existing banners
- Preview what the banner looks like

### 3.4 API Endpoints

```
# Public (used by apps and dashboards)
GET    /api/v1/banners/active?context=admin|customer
  → Returns active banners for current tenant + global banners

# Super Admin
GET    /api/v1/super-admin/banners
POST   /api/v1/super-admin/banners
PUT    /api/v1/super-admin/banners/:id
DELETE /api/v1/super-admin/banners/:id
```

---

## Part 4: Retailer Push Notification Scheduling

### 4.1 Database Tables

```sql
CREATE TABLE scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),

  -- Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  link_type VARCHAR(30),  -- 'product' | 'content' | 'subscription' | 'custom_url' | null
  link_id VARCHAR(255),  -- product ID, content ID, etc.

  -- Targeting
  target VARCHAR(30) NOT NULL DEFAULT 'all_customers',  -- 'all_customers' | 'segment'
  target_segment JSONB,  -- future: { sanitizationSystem: 'bromine', hasActiveSubscription: true }

  -- Scheduling
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,  -- null until sent
  status VARCHAR(20) DEFAULT 'scheduled',  -- 'scheduled' | 'sent' | 'cancelled'

  -- Stats
  recipients_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Retailer Dashboard Notification Composer

`/admin/notifications` page:

- **Upcoming:** List of scheduled notifications with send date, status
- **Sent:** History of sent notifications with delivery stats
- **Compose:**
  - Title (max 50 chars)
  - Body (max 200 chars)
  - Optional link: dropdown to select type (product/content/none), then search/select the specific item
  - Schedule: "Send Now" or pick date/time
  - Preview: shows how the notification will look on iOS and Android
  - "Schedule" or "Send Now" button
- **Cancel** a scheduled notification before it sends

### 4.3 Notification Dispatch Cron

Backend cron runs every minute:
1. Find notifications where `send_at <= NOW()` AND `status = 'scheduled'`
2. For each: get all users for that tenant with `notification_pref_promotional = true` and valid `fcm_token`
3. Send via Firebase Cloud Messaging using topic-based or batch sending
4. Update stats and mark as sent

### 4.4 API Endpoints

```
# Admin
GET    /api/v1/admin/notifications?status=scheduled|sent
POST   /api/v1/admin/notifications
  Body: { title, body, linkType?, linkId?, sendAt, target }
PUT    /api/v1/admin/notifications/:id  (only if scheduled)
DELETE /api/v1/admin/notifications/:id/cancel
GET    /api/v1/admin/notifications/:id/stats
```

---

## Verification Checklist

Before moving to Phase 5, verify:

- [ ] Service types are configurable per tenant in admin dashboard
- [ ] Customer can browse service types and submit a request with preferred dates
- [ ] Retailer admin sees service request queue with all details
- [ ] Admin can confirm, update status, and complete service requests
- [ ] Status changes trigger push notifications to customer
- [ ] Customer can rate completed services
- [ ] Retailer ↔ TimpCreative inbox works both directions
- [ ] Email notifications fire when new messages arrive
- [ ] Urgent banners display in admin dashboards (all severity levels)
- [ ] Urgent banners display in customer app
- [ ] Super admin can create, edit, and deactivate banners
- [ ] Retailer can compose and schedule push notifications
- [ ] Scheduled notifications dispatch at the correct time
- [ ] "Send Now" sends immediately
- [ ] Notification preview looks correct
- [ ] Delivery stats are tracked
