import express from 'express';
import crypto from 'crypto';
import { makeId, now } from '../services/utils.js';

function s(v){
  const t = String(v ?? '').trim();
  return t ? t : null;
}

function withinWindow(from, to, d){
  if(from && d < new Date(from)) return false;
  if(to && d > new Date(to)) return false;
  return true;
}

function matchesTargeting(targeting, ctx){
  const t = targeting || {};
  if(Array.isArray(t.cities) && t.cities.length){
    if(!ctx.city) return false;
    const ok = t.cities.map(x=>String(x).toLowerCase()).includes(String(ctx.city).toLowerCase());
    if(!ok) return false;
  }
  if(Array.isArray(t.categories) && t.categories.length){
    if(!ctx.category) return false;
    const ok = t.categories.map(x=>String(x).toLowerCase()).includes(String(ctx.category).toLowerCase());
    if(!ok) return false;
  }
  if(Array.isArray(t.pages) && t.pages.length){
    if(!ctx.page) return false;
    const ok = t.pages.map(x=>String(x).toLowerCase()).includes(String(ctx.page).toLowerCase());
    if(!ok) return false;
  }
  return true;
}

function weightedPick(items){
  const pool = [];
  for(const it of items){
    const w = Math.max(1, Number(it.weight || 1));
    for(let i=0;i<w;i++) pool.push(it);
  }
  if(!pool.length) return null;
  return pool[Math.floor(Math.random()*pool.length)];
}

function hashIp(ip){
  const salt = process.env.IP_HASH_SALT || 'change_me';
  return crypto.createHash('sha256').update(String(ip||'') + salt).digest('hex');
}

export function adSystemRouter(repo){
  const r = express.Router();

  // Serve one creative for a slot (public)
  r.get('/ad-serve', async (req, res) => {
    const slot = s(req.query.slot);
    if(!slot) return res.status(400).json({ error: 'BAD_SLOT' });

    const ctx = {
      city: s(req.query.city),
      category: s(req.query.category),
      page: s(req.query.page),
    };

    const slotObj = await repo.getAdSlot(slot);
    if(!slotObj || slotObj.is_enabled === false) return res.json(null);

    const list = await repo.listAdCreatives({ slot_id: slot, status: 'active' });
    const t = now();
    const eligible = list.filter(c => {
      if(c.status !== 'active') return false;
      if(!withinWindow(c.date_from, c.date_to, t)) return false;
      return matchesTargeting(c.targeting, ctx);
    });

    const picked = weightedPick(eligible);
    if(!picked) return res.json(null);

    // count view + event
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress;
    await repo.incrementCreativeCounter(picked.id, 'view');
    await repo.createAdEvent({
      id: makeId('adev'),
      creative_id: picked.id,
      type: 'view',
      page: ctx.page,
      city: ctx.city,
      category: ctx.category,
      user_agent: req.headers['user-agent'] || null,
      ip_hash: hashIp(ip),
      created_at: now().toISOString()
    });

    return res.json({
      id: picked.id,
      title: picked.title,
      image_url: picked.image_url,
      target_url: picked.target_url
    });
  });

  // Track view/click (public)
  r.post('/ad-event', async (req, res) => {
    const creative_id = s(req.body?.creative_id);
    const type = s(req.body?.type);
    if(!creative_id) return res.status(400).json({ error: 'BAD_CREATIVE_ID' });
    if(type !== 'view' && type !== 'click') return res.status(400).json({ error: 'BAD_TYPE' });

    const c = await repo.findAdCreativeById(creative_id);
    if(!c) return res.status(404).json({ error: 'NOT_FOUND' });

    const ctx = {
      page: s(req.body?.page),
      city: s(req.body?.city),
      category: s(req.body?.category),
    };

    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress;
    await repo.incrementCreativeCounter(creative_id, type);
    await repo.createAdEvent({
      id: makeId('adev'),
      creative_id,
      type,
      page: ctx.page,
      city: ctx.city,
      category: ctx.category,
      user_agent: req.headers['user-agent'] || null,
      ip_hash: hashIp(ip),
      created_at: now().toISOString()
    });

    return res.json({ ok: true });
  });

  return r;
}
