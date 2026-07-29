// Sample (fake) customers for LOCAL DEMO MODE only.
// Real customer data is NEVER bundled in the app — it lives in your private
// Supabase database, loaded with scripts/import-customers.mjs.
const today = new Date()
const iso = (d) => d.toISOString().slice(0, 10)
const plus = (days) => iso(new Date(today.getTime() + days * 86400000))

export const sampleCustomers = [
  { id: 's1', first_name: 'Maria', last_name: 'Gomez', full_name: 'Maria Gomez', email: 'maria@example.com', phone: '916-555-0101', street_address: '123 Sunray Dr', city: 'Sacramento', state: 'CA', zip: '95842', property_type: 'residential', panel_count: 24, stories: 1, roof_type: 'shingle', lead_source: 'Quality First list', status: 'recurring', quoted_amount: 200, recurring_frequency: 'twice_a_year', next_service_due: plus(20), consent_sms: true, consent_email: true, notes: 'Friendly dog in yard.', tags: ['residential'] },
  { id: 's2', first_name: 'James', last_name: 'Carter', full_name: 'James Carter', email: 'jcarter@example.com', phone: '916-555-0102', street_address: '88 Panel Ct', city: 'Citrus Heights', state: 'CA', zip: '95610', property_type: 'residential', panel_count: 30, stories: 2, roof_type: 'tile', lead_source: 'referral', status: 'scheduled', quoted_amount: 340, recurring_frequency: 'twice_a_year', next_service_due: plus(3), consent_sms: true, consent_email: false, notes: 'Gate code 4412.', tags: [] },
  { id: 's3', first_name: 'Linda', last_name: 'Nguyen', full_name: 'Linda Nguyen', email: 'lnguyen@example.com', phone: '916-555-0103', street_address: '450 Solar Way', city: 'Roseville', state: 'CA', zip: '95661', property_type: 'residential', panel_count: 18, stories: 1, roof_type: 'shingle', lead_source: 'Quality First list', status: 'quoted', quoted_amount: 150, recurring_frequency: 'twice_a_year', next_service_due: null, consent_sms: false, consent_email: true, notes: '', tags: [] },
  { id: 's4', first_name: 'Robert', last_name: 'Daly', full_name: 'Robert Daly', email: 'rdaly@example.com', phone: '916-555-0104', street_address: '7 Bright St', city: 'Folsom', state: 'CA', zip: '95630', property_type: 'commercial', panel_count: 120, stories: 1, roof_type: 'flat', lead_source: 'ad', status: 'new_lead', quoted_amount: null, recurring_frequency: 'quarterly', next_service_due: null, consent_sms: false, consent_email: false, notes: 'Warehouse array.', tags: ['commercial'], billing_different: true, billing_name: 'Daly Holdings LLC', billing_street_address: 'PO Box 4120', billing_city: 'Folsom', billing_state: 'CA', billing_zip: '95630' },
  { id: 's5', first_name: 'Sofia', last_name: 'Reyes', full_name: 'Sofia Reyes', email: 'sreyes@example.com', phone: '916-555-0105', street_address: '233 Helios Ln', city: 'Sacramento', state: 'CA', zip: '95823', property_type: 'residential', panel_count: 22, stories: 1, roof_type: 'shingle', lead_source: 'Quality First list', status: 'completed', quoted_amount: 190, recurring_frequency: 'twice_a_year', next_service_due: plus(-5), consent_sms: true, consent_email: true, notes: 'Overdue — follow up.', tags: [] },
  { id: 's6', first_name: 'Daniel', last_name: 'Brooks', full_name: 'Daniel Brooks', email: 'dbrooks@example.com', phone: '916-555-0106', street_address: '19 Photon Pl', city: 'Elk Grove', state: 'CA', zip: '95624', property_type: 'residential', panel_count: 26, stories: 2, roof_type: 'shingle', lead_source: 'door-to-door', status: 'new_lead', quoted_amount: null, recurring_frequency: 'twice_a_year', next_service_due: null, consent_sms: false, consent_email: false, notes: '', tags: [] },
]

export const sampleJobs = [
  { id: 'j1', customer_id: 's5', scheduled_date: plus(-40), completed_date: plus(-40), work_done: 'Full clean, 22 panels', amount: 190, status: 'completed', notes: '' },
  { id: 'j2', customer_id: 's1', scheduled_date: plus(-160), completed_date: plus(-160), work_done: 'Full clean, 24 panels', amount: 200, status: 'completed', notes: '' },
  { id: 'j3', customer_id: 's2', scheduled_date: plus(3), completed_date: null, work_done: 'Scheduled clean', amount: 340, status: 'scheduled', notes: '' },
]

const isoTime = (days, hour = 10) => {
  const d = new Date(today.getTime() + days * 86400000)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

// A couple of sample contacts set up to show off the calling workflow:
// s7 has a callback due today; s8 is a Do-Not-Call example.
sampleCustomers.push(
  { id: 's7', first_name: 'Ana', last_name: 'Lopez', full_name: 'Ana Lopez', email: 'alopez@example.com', phone: '916-555-0107', street_address: '12 Sunbeam Rd', city: 'Sacramento', state: 'CA', zip: '95835', property_type: 'residential', panel_count: 20, stories: 1, roof_type: 'shingle', lead_source: 'Quality First list', status: 'new_lead', recurring_frequency: 'twice_a_year', callback_at: isoTime(0, 14), last_call_at: isoTime(-2), last_disposition: 'call_later', call_attempts: 1, consent_sms: false, consent_email: false, notes: 'Asked to call back this afternoon.', tags: [] },
  { id: 's8', first_name: 'Tom', last_name: 'Reed', full_name: 'Tom Reed', email: '', phone: '916-555-0108', street_address: '5 Quiet Ln', city: 'Antelope', state: 'CA', zip: '95843', property_type: 'residential', panel_count: null, do_not_call: true, status: 'new_lead', last_call_at: isoTime(-6), last_disposition: 'dnc', call_attempts: 1, notes: 'Asked not to be contacted.', tags: [] },
)

export const sampleCalls = [
  { id: 'c1', customer_id: 's7', called_at: isoTime(-2), disposition: 'call_later', callback_at: isoTime(0, 14), note: 'Busy now, call back this afternoon.' },
  { id: 'c2', customer_id: 's5', called_at: isoTime(-45), disposition: 'sale', note: 'Agreed to a clean, 22 panels.' },
  { id: 'c3', customer_id: 's8', called_at: isoTime(-6), disposition: 'dnc', note: 'Requested do not call.' },
  { id: 'c4', customer_id: 's3', called_at: isoTime(-3), disposition: 'voicemail', note: 'Left a voicemail.' },
]
