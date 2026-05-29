import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessId, offeringId } = req.body;
  if (!businessId || !offeringId) {
    return res.status(400).json({ error: 'businessId and offeringId required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI unavailable' });
  }

  const db = adminDb();

  try {
    // Fetch the service offering
    const { data: offering, error: offerErr } = await db
      .from('service_offerings')
      .select('*')
      .eq('id', offeringId)
      .eq('business_id', businessId)
      .single();

    if (offerErr || !offering) {
      return res.status(404).json({ error: 'Service offering not found' });
    }

    // Fetch business name for personalized messages
    const { data: business } = await db
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single();

    const businessName = business?.name ?? 'your nursery';

    // Fetch customers with their order history
    const { data: customers, error: custErr } = await db
      .from('customers')
      .select(`
        id, first_name, last_name, email, phone, city,
        orders (
          id, created_at, total_amount, transport_method,
          order_items (
            quantity, unit_price,
            plants ( species, common_name, current_container, plant_type )
          )
        )
      `)
      .eq('business_id', businessId)
      .not('email', 'is', null)
      .limit(200);

    if (custErr) throw new Error(`Customers: ${custErr.message}`);
    if (!customers || customers.length === 0) {
      return res.json({ matches: [], message: 'No customers found yet.' });
    }

    // Build a compact customer summary for the prompt
    const customerSummaries = (customers as any[]).map(c => {
      const orders = (c.orders ?? []) as any[];
      const purchases = orders.flatMap((o: any) =>
        (o.order_items ?? []).map((item: any) => {
          const p = item.plants;
          return p
            ? `${item.quantity}x ${p.common_name ?? p.species} (${p.current_container}, ${p.plant_type})`
            : null;
        }).filter(Boolean),
      );
      const lastOrder = orders.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const daysSince = lastOrder
        ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000)
        : null;

      return {
        id: c.id,
        name: `${c.first_name} ${c.last_name}`.trim(),
        email: c.email,
        phone: c.phone ?? null,
        city: c.city ?? null,
        purchases,
        daysSinceLastOrder: daysSince,
        orderCount: orders.length,
      };
    });

    const priceLabel = offering.price_type === 'per_unit'
      ? `$${Number(offering.price).toFixed(2)} per ${offering.price_unit}`
      : `$${Number(offering.price).toFixed(2)} flat`;

    const prompt = `You are helping ${businessName}, a local nursery, identify the best candidates for a new service offering and craft personalized outreach messages.

Service offering:
- Name: ${offering.name}
- Description: ${offering.description ?? '(none)'}
- Category: ${offering.category}
- Timing: ${offering.timing}
- Price: ${priceLabel}

Customer list (${customerSummaries.length} customers):
${JSON.stringify(customerSummaries, null, 2)}

Your task:
1. Identify the top 5-8 customers who are the strongest candidates for this service based on their purchase history, plant types, and recency.
2. For each candidate, write a short, genuine text message (under 160 characters) that Lauren at ${businessName} would send — personal, specific to what they bought, never pushy.
3. Rank from most to least likely to be interested.

Return ONLY a JSON array with no markdown fences, matching exactly this structure:
[
  {
    "customerId": "<id>",
    "customerName": "<name>",
    "fitScore": <1-10>,
    "fitReason": "<one sentence why they are a good match>",
    "suggestedMessage": "<SMS text under 160 chars>"
  }
]`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (response.content[0] as any).text?.trim() ?? '[]';

    // Parse — strip any accidental markdown fences
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    let matches: any[];
    try {
      matches = JSON.parse(cleaned);
    } catch {
      console.error('[customer-match] JSON parse failed:', cleaned.slice(0, 200));
      return res.status(500).json({ error: 'AI returned unparseable response' });
    }

    // Enrich matches with phone/email from our local lookup
    const customerMap = new Map(customerSummaries.map(c => [c.id, c]));
    const enriched = matches.map((m: any) => {
      const c = customerMap.get(m.customerId);
      return {
        ...m,
        email: c?.email ?? null,
        phone: c?.phone ?? null,
      };
    });

    res.json({ matches: enriched, offering: { name: offering.name, price: priceLabel } });

  } catch (err: any) {
    console.error('[customer-match]', err.message);
    res.status(500).json({ error: err.message });
  }
}
