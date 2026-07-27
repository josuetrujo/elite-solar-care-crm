// Creates and sends a Square invoice so a customer can pay by card.
//
// Runs on Supabase Edge Functions (Deno) so the secret Square token NEVER
// reaches the browser. The CRM calls it with supabase.functions.invoke(),
// which forwards the signed-in user's token — Supabase rejects anonymous calls.
//
// Deploy:   supabase functions deploy create-square-invoice
// Secrets:  SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID, SQUARE_ENVIRONMENT

const SQUARE_VERSION = '2025-01-23'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

function squareBase() {
  const env = (Deno.env.get('SQUARE_ENVIRONMENT') || 'sandbox').toLowerCase()
  return env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

async function square(path: string, method: string, body?: unknown) {
  const token = Deno.env.get('SQUARE_ACCESS_TOKEN')
  if (!token) throw new Error('SQUARE_ACCESS_TOKEN is not set in Supabase secrets.')

  const res = await fetch(`${squareBase()}${path}`, {
    method,
    headers: {
      'Square-Version': SQUARE_VERSION,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.errors?.[0]?.detail || data?.errors?.[0]?.code || res.statusText
    throw new Error(`Square: ${msg}`)
  }
  return data
}

// Square wants money in cents.
const cents = (n: number) => Math.round(Number(n) * 100)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const { customer, amount, description, dueDays } = await req.json()

    if (!customer?.id) return json({ error: 'A customer is required.' }, 400)
    if (!amount || Number(amount) <= 0) return json({ error: 'Amount must be more than $0.' }, 400)
    if (!customer.email && !customer.phone) {
      return json({ error: 'This customer needs an email address (or phone) before Square can send an invoice.' }, 400)
    }

    const locationId = Deno.env.get('SQUARE_LOCATION_ID')
    if (!locationId) throw new Error('SQUARE_LOCATION_ID is not set in Supabase secrets.')

    // 1. Find or create the matching Square customer.
    let squareCustomerId: string | undefined
    if (customer.email) {
      const found = await square('/v2/customers/search', 'POST', {
        limit: 1,
        query: { filter: { email_address: { exact: customer.email } } },
      })
      squareCustomerId = found?.customers?.[0]?.id
    }
    if (!squareCustomerId) {
      const created = await square('/v2/customers', 'POST', {
        idempotency_key: crypto.randomUUID(),
        given_name: customer.first_name || customer.full_name || 'Customer',
        family_name: customer.last_name || undefined,
        email_address: customer.email || undefined,
        phone_number: customer.phone || undefined,
        address: customer.street_address
          ? {
              address_line_1: customer.street_address,
              locality: customer.city || undefined,
              administrative_district_level_1: customer.state || undefined,
              postal_code: customer.zip || undefined,
              country: 'US',
            }
          : undefined,
      })
      squareCustomerId = created?.customer?.id
    }

    // 2. An order holds the line items.
    const order = await square('/v2/orders', 'POST', {
      idempotency_key: crypto.randomUUID(),
      order: {
        location_id: locationId,
        customer_id: squareCustomerId,
        line_items: [{
          name: description || 'Solar Panel Cleaning',
          quantity: '1',
          base_price_money: { amount: cents(amount), currency: 'USD' },
        }],
      },
    })
    const orderId = order?.order?.id

    // 3. The invoice wraps the order.
    const due = new Date()
    due.setDate(due.getDate() + (Number(dueDays) || 7))
    const dueDate = due.toISOString().slice(0, 10)

    const invoice = await square('/v2/invoices', 'POST', {
      idempotency_key: crypto.randomUUID(),
      invoice: {
        location_id: locationId,
        order_id: orderId,
        primary_recipient: { customer_id: squareCustomerId },
        payment_requests: [{ request_type: 'BALANCE', due_date: dueDate }],
        delivery_method: customer.email ? 'EMAIL' : 'SHARE_MANUALLY',
        accepted_payment_methods: { card: true, square_gift_card: false, bank_account: false },
        title: 'Elite Solar Care LLC',
        description: description || 'Solar panel cleaning service',
      },
    })

    // 4. Publishing is what actually sends it.
    const published = await square(
      `/v2/invoices/${invoice.invoice.id}/publish`,
      'POST',
      { idempotency_key: crypto.randomUUID(), version: invoice.invoice.version },
    )

    return json({
      square_invoice_id: published?.invoice?.id,
      pay_url: published?.invoice?.public_url,
      status: published?.invoice?.status,
    })
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 400)
  }
})
