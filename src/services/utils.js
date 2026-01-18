import crypto from 'crypto';

export function makeId(prefix='id'){
  return `${prefix}_${crypto.randomBytes(12).toString('hex')}`;
}

export function now(){
  return new Date();
}

export function addHours(date, hours){
  return new Date(date.getTime() + hours*60*60*1000);
}

export function normalizeEmail(email){
  return String(email||'').trim().toLowerCase();
}

export function isValidEmail(email){
  const s = normalizeEmail(email);
  // Pragmatic RFC5322-ish check (good enough for product forms)
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

export function isStrongPassword(password){
  const s = String(password||'');
  if(s.length < 8) return false;
  // Minimum: 1 letter and 1 digit
  if(!(/[A-Za-z]/.test(s) && /\d/.test(s))) return false;
  return true;
}

export function pick(obj, keys){
  const out = {};
  for(const k of keys){
    if(Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
  }
  return out;
}

export function safeJson(obj){
  return JSON.parse(JSON.stringify(obj));
}
