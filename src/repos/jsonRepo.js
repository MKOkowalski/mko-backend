import fs from 'fs';
import path from 'path';

export class JsonRepo {
  constructor(dbPath){
    this.dbPath = dbPath;
    this._ensureFile();
  }

  _ensureFile(){
    const dir = path.dirname(this.dbPath);
    if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if(!fs.existsSync(this.dbPath)){
      fs.writeFileSync(this.dbPath, JSON.stringify({ users: [], auth_tokens: [], ads: [], reports: [], contacts: [], ad_slots: [], ad_creatives: [], ad_events: [] }, null, 2));
    }
  }

  _read(){
    const raw = fs.readFileSync(this.dbPath, 'utf8');
    try{ const db = JSON.parse(raw);
      db.users ||= [];
      db.auth_tokens ||= [];
      db.ads ||= [];
      db.reports ||= [];
      db.contacts ||= [];
      db.ad_slots ||= [];
      db.ad_creatives ||= [];
      db.ad_events ||= [];
      return db;
    }catch(e){
      return { users: [], auth_tokens: [], ads: [], reports: [], contacts: [], ad_slots: [], ad_creatives: [], ad_events: [] };
    }
  }

  _write(db){
    fs.writeFileSync(this.dbPath, JSON.stringify(db, null, 2));
  }

  // USERS
  async createUser(user){
    const db = this._read();
    db.users.unshift(user);
    this._write(db);
    return user;
  }
  async findUserByEmail(email){
    const db = this._read();
    return db.users.find(u=>u.email===email) || null;
  }
  async findUserById(id){
    const db = this._read();
    return db.users.find(u=>u.id===id) || null;
  }
  async listUsers(){
    const db = this._read();
    return db.users;
  }
  async updateUser(id, patch){
    const db = this._read();
    const idx = db.users.findIndex(u=>u.id===id);
    if(idx<0) return null;
    db.users[idx] = { ...db.users[idx], ...patch };
    this._write(db);
    return db.users[idx];
  }

  // TOKENS
  async createToken(t){
    const db = this._read();
    db.auth_tokens.unshift(t);
    this._write(db);
    return t;
  }

  async deleteTokensWhere(predicate){
    const db = this._read();
    const before = (db.auth_tokens || []).length;
    db.auth_tokens = (db.auth_tokens || []).filter(t => !predicate(t));
    const after = db.auth_tokens.length;
    if(after !== before) this._write(db);
    return before - after;
  }

  async findTokenByHash(tokenHash, kind){
    const db = this._read();
    return (db.auth_tokens || []).find(x => x.token_hash === tokenHash && x.kind === kind) || null;
  }

  async consumeTokenByHash(tokenHash, kind){
    const db = this._read();
    const idx = (db.auth_tokens || []).findIndex(x => x.token_hash === tokenHash && x.kind === kind);
    if(idx < 0) return null;
    const item = db.auth_tokens[idx];
    db.auth_tokens.splice(idx, 1);
    this._write(db);
    return item;
  }

  async consumeToken(token, kind){
    const db = this._read();
    const idx = db.auth_tokens.findIndex(x=>x.token===token && x.kind===kind);
    if(idx<0) return null;
    const item = db.auth_tokens[idx];
    db.auth_tokens.splice(idx,1);
    this._write(db);
    return item;
  }

  // ADS
  async createAd(ad){
    const db = this._read();
    db.ads.unshift(ad);
    this._write(db);
    return ad;
  }
  async listAds(opts = {}){
    const db = this._read();
    const includeAllStatuses = !!opts.includeAllStatuses;
    const items = db.ads.filter(a=>a.status!=='deleted');
    return includeAllStatuses ? items : items;
  }
  async findAdById(id){
    const db = this._read();
    return db.ads.find(a=>a.id===id && a.status!=='deleted') || null;
  }
  async updateAd(id, patch){
    const db = this._read();
    const idx = db.ads.findIndex(a=>a.id===id);
    if(idx<0) return null;
    db.ads[idx] = { ...db.ads[idx], ...patch };
    this._write(db);
    return db.ads[idx];
  }
  async deleteAd(id){
    return this.updateAd(id, { status: 'deleted' });
  }

  // REPORTS
  async createReport(r){
    const db = this._read();
    db.reports.unshift(r);
    this._write(db);
    return r;
  }
  async listReports(){
    const db = this._read();
    return db.reports;
  }

  // CONTACT
  async createContact(c){
    const db = this._read();
    db.contacts.unshift(c);
    this._write(db);
    return c;
  }
  async listContacts(){
    const db = this._read();
    return db.contacts;
  }

// AD SYSTEM (display ads / reklamy)
async ensureAdSlotsDefaults(){
  const db = this._read();
  const defaults = [
    { id: 'home_top', name: 'Home top', description: 'Strona główna – pod wyszukiwarką', is_enabled: true, created_at: new Date().toISOString() },
    { id: 'listing_inline', name: 'Listing inline', description: 'Lista ogłoszeń – co X', is_enabled: true, created_at: new Date().toISOString() },
    { id: 'offer_bottom', name: 'Offer bottom', description: 'Strona ogłoszenia – pod opisem', is_enabled: true, created_at: new Date().toISOString() },
    { id: 'sidebar_desktop', name: 'Sidebar desktop', description: 'Sidebar (desktop)', is_enabled: true, created_at: new Date().toISOString() },
    { id: 'mobile_sticky', name: 'Mobile sticky', description: 'Pasek dół (mobile)', is_enabled: true, created_at: new Date().toISOString() },
  ];
  const existing = new Set((db.ad_slots||[]).map(s=>s.id));
  let changed = false;
  for(const d of defaults){
    if(!existing.has(d.id)){
      db.ad_slots.push(d);
      changed = true;
    }
  }
  if(changed) this._write(db);
  return db.ad_slots;
}

async listAdSlots(){
  const db = this._read();
  return db.ad_slots || [];
}
async getAdSlot(id){
  const db = this._read();
  return (db.ad_slots||[]).find(s=>String(s.id)===String(id)) || null;
}
async updateAdSlot(id, patch){
  const db = this._read();
  const idx = (db.ad_slots||[]).findIndex(s=>String(s.id)===String(id));
  if(idx<0) return null;
  db.ad_slots[idx] = { ...db.ad_slots[idx], ...patch };
  this._write(db);
  return db.ad_slots[idx];
}

async createAdCreative(c){
  const db = this._read();
  db.ad_creatives.unshift(c);
  this._write(db);
  return c;
}
async listAdCreatives(opts = {}){
  const db = this._read();
  let items = (db.ad_creatives||[]).slice();
  if(opts.slot_id) items = items.filter(x=>String(x.slot_id)===String(opts.slot_id));
  if(opts.status) items = items.filter(x=>String(x.status)===String(opts.status));
  return items;
}
async findAdCreativeById(id){
  const db = this._read();
  return (db.ad_creatives||[]).find(x=>String(x.id)===String(id)) || null;
}
async updateAdCreative(id, patch){
  const db = this._read();
  const idx = (db.ad_creatives||[]).findIndex(x=>String(x.id)===String(id));
  if(idx<0) return null;
  db.ad_creatives[idx] = { ...db.ad_creatives[idx], ...patch, updated_at: new Date().toISOString() };
  this._write(db);
  return db.ad_creatives[idx];
}
async deleteAdCreative(id){
  const db = this._read();
  const idx = (db.ad_creatives||[]).findIndex(x=>String(x.id)===String(id));
  if(idx<0) return false;
  db.ad_creatives.splice(idx,1);
  this._write(db);
  return true;
}

async incrementCreativeCounter(id, type){
  const db = this._read();
  const idx = (db.ad_creatives||[]).findIndex(x=>String(x.id)===String(id));
  if(idx<0) return null;
  const key = type === 'click' ? 'clicks_count' : 'views_count';
  db.ad_creatives[idx][key] = Number(db.ad_creatives[idx][key]||0) + 1;
  this._write(db);
  return db.ad_creatives[idx];
}

async createAdEvent(ev){
  const db = this._read();
  db.ad_events.unshift(ev);
  if(db.ad_events.length > 50000) db.ad_events.length = 50000;
  this._write(db);
  return ev;
}
async listAdEvents(opts = {}){
  const db = this._read();
  let items = (db.ad_events||[]).slice();
  if(opts.creative_id) items = items.filter(e=>String(e.creative_id)===String(opts.creative_id));
  if(opts.type) items = items.filter(e=>String(e.type)===String(opts.type));
  return items;
}

}
