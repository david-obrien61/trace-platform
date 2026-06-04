import { createClient } from '@supabase/supabase-js';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { draft_id } = req.body ?? {};
  if (!draft_id) return res.status(400).json({ error: 'Missing draft_id' });

  const db = adminDb();

  const { data: draft, error: draftErr } = await db
    .from('social_drafts')
    .select('id, business_id, content, platform, status')
    .eq('id', draft_id)
    .single();

  if (draftErr || !draft) {
    return res.status(404).json({ error: 'Draft not found' });
  }

  if ((draft as any).status !== 'draft') {
    return res.status(400).json({ error: `Draft is already ${(draft as any).status}` });
  }

  const { data: nm } = await db
    .from('business_modules')
    .select('config')
    .eq('business_id', (draft as any).business_id)
    .eq('module_key', 'social_media')
    .single();

  const accountId = String((nm?.config as any)?.blotato_account_id ?? '');
  if (!accountId) {
    console.warn('[social/publish] no blotato_account_id for nursery', (draft as any).nursery_id);
    const { error: e1 } = await db.from('social_drafts').update({ status: 'failed' }).eq('id', draft_id);
    if (e1) console.error('[social/publish] status update failed:', e1.message);
    return res.status(200).json({ ok: false, reason: 'no_account_id' });
  }

  const blotatoKey = process.env.BLOTATO_API_KEY;
  if (!blotatoKey) {
    console.warn('[social/publish] BLOTATO_API_KEY not set');
    const { error: e2 } = await db.from('social_drafts').update({ status: 'failed' }).eq('id', draft_id);
    if (e2) console.error('[social/publish] status update failed:', e2.message);
    return res.status(200).json({ ok: false, reason: 'no_api_key' });
  }

  const platform = ((draft as any).platform as string) || 'instagram';

  try {
    const blotatoRes = await fetch('https://backend.blotato.com/v2/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'blotato-api-key': blotatoKey,
      },
      body: JSON.stringify({
        post: {
          accountId,
          content: {
            text:      (draft as any).content,
            mediaUrls: [],
            platform,
          },
          target: {
            targetType: platform,
          },
        },
      }),
    });

    if (!blotatoRes.ok) {
      const errText = await blotatoRes.text().catch(() => '');
      console.error('[social/publish] Blotato error:', blotatoRes.status, errText);
      const { error: e3 } = await db.from('social_drafts').update({ status: 'failed' }).eq('id', draft_id);
      if (e3) console.error('[social/publish] status update failed:', e3.message);
      return res.status(200).json({ ok: false, reason: 'blotato_error', detail: errText });
    }

    const blotatoData = await blotatoRes.json().catch(() => ({}));
    const { error: e4 } = await db.from('social_drafts').update({ status: 'published' }).eq('id', draft_id);
    if (e4) console.error('[social/publish] published update failed:', e4.message);
    return res.status(200).json({ ok: true, postSubmissionId: blotatoData.postSubmissionId });

  } catch (err: any) {
    console.error('[social/publish] fetch error:', err?.message ?? err);
    const { error: e5 } = await db.from('social_drafts').update({ status: 'failed' }).eq('id', draft_id);
    if (e5) console.error('[social/publish] status update failed:', e5.message);
    return res.status(200).json({ ok: false, reason: 'fetch_error' });
  }
}
