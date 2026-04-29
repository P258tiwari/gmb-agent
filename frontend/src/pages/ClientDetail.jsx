import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, CheckCircle2, Pencil, X, RefreshCw, Check, Instagram, Facebook, MapPin, Award, Star, Users, Building2, Loader2, ExternalLink } from 'lucide-react';
import ClientLayout from '../components/ClientLayout';
import GbpOptimizationPanel from '../components/GbpOptimizationPanel';
import TagInput from '../components/TagInput';
import { useToast } from '../context/ToastContext';
import api from '../lib/api';

// ─── Constants shared with AddClient ────────────────────────────────────────
const CATEGORIES = [
  'Restaurant & Food', 'Healthcare & Medical', 'Real Estate',
  'Automotive Services', 'Salon & Beauty', 'Retail & Shopping',
  'Education & Training', 'Home Services & Plumbing',
  'Fitness & Wellness', 'Legal Services', 'Financial Services',
  'Hospitality & Hotels', 'Photography & Events',
  'IT & Technology', 'Other'
];
const TONES = [
  'Professional & Authoritative',
  'Friendly & Approachable',
  'Local & Conversational (Hinglish)',
  'Luxury & Premium',
  'Energetic & Bold'
];
const PRICE_RANGES = [
  { value: 'Budget-friendly', label: 'Budget-friendly (₹)' },
  { value: 'Mid-range',       label: 'Mid-range (₹₹)'      },
  { value: 'Premium',         label: 'Premium (₹₹₹)'       },
  { value: 'Luxury',          label: 'Luxury (₹₹₹₹)'       }
];
const STATUSES = [
  { value: 'ACTIVE',   label: 'Active'   },
  { value: 'PENDING',  label: 'Pending'  },
  { value: 'INACTIVE', label: 'Inactive' }
];

// ─── Status pill ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = (status || '').toUpperCase();
  const cfg = {
    ACTIVE:   { bg: '#F0FDF4', border: '#BBF7D0', text: '#15803D', dot: '#16A34A' },
    PENDING:  { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E', dot: '#D97706' },
    INACTIVE: { bg: '#F9FAFB', border: '#E5E7EB', text: '#6B7280', dot: '#9CA3AF' }
  }[s] || { bg: '#F9FAFB', border: '#E5E7EB', text: '#6B7280', dot: '#9CA3AF' };

  return (
    <span
      className="flex items-center gap-1.5 text-[12px] font-medium rounded-full px-2.5 py-0.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  );
}

function Trend({ value }) {
  if (value === 0) return <span className="text-[11px] text-[#6B7280]">−0%</span>;
  const up = value > 0;
  return (
    <span className={`text-[11px] font-medium ${up ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
      {up ? '↑' : '↓'}{Math.abs(value)}%
    </span>
  );
}

// ─── Read-mode helpers ────────────────────────────────────────────────────────
function InfoRow({ label, value, link, multiline }) {
  if (!value && (!Array.isArray(value) || value.length === 0)) return null;
  return (
    <div className={`flex gap-4 py-3 border-b border-[#F3F4F6] last:border-0 ${multiline ? 'flex-col' : ''}`}>
      <div className={`text-[12px] text-[#6B7280] flex-shrink-0 ${multiline ? '' : 'w-[168px]'}`}>
        {label}
      </div>
      <div className="text-[13px] font-medium text-[#111827] flex-1 min-w-0">
        {link
          ? <a href={value} target="_blank" rel="noreferrer" className="text-[#2563EB] hover:underline break-all">{value}</a>
          : <span className={multiline ? 'whitespace-pre-wrap leading-relaxed' : ''}>{value}</span>
        }
      </div>
    </div>
  );
}

function TagRow({ label, tags, color = 'default' }) {
  if (!tags || tags.length === 0) return null;
  const styles = {
    default: { bg: '#F3F4F6', text: '#374151' },
    blue:    { bg: '#EFF6FF', text: '#2563EB' },
    green:   { bg: '#F0FDF4', text: '#16A34A' },
    yellow:  { bg: '#FFFBEB', text: '#92400E' }
  }[color];
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[#F3F4F6] last:border-0">
      <div className="text-[12px] text-[#6B7280]">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <span
            key={t}
            className="text-[12px] font-medium rounded-full px-2.5 py-0.5"
            style={{ background: styles.bg, color: styles.text }}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section header inside the card ──────────────────────────────────────────
function CardSection({ title, icon: Icon, children }) {
  return (
    <div className="px-6 py-4 border-b border-[#E5E7EB] last:border-0">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon size={14} className="text-[#6B7280]" />}
        <span className="text-[12px] font-semibold text-[#6B7280] uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Edit field helpers ───────────────────────────────────────────────────────
function EditInput({ label, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div>
      <label className="form-label">{label}{required && ' *'}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} className="form-input" placeholder={placeholder} />
    </div>
  );
}
function EditSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)} className="form-select">
        <option value="">— select —</option>
        {options.map(o => typeof o === 'string'
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}
function EditTextarea({ label, value, onChange, placeholder, rows = 3, helpText }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <textarea rows={rows} value={value || ''} onChange={e => onChange(e.target.value)} className="form-textarea" placeholder={placeholder} />
      {helpText && <p className="text-[11px] text-[#6B7280] mt-1">{helpText}</p>}
    </div>
  );
}
function EditTagInput({ label, value, onChange, placeholder, helpText }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <TagInput value={value || []} onChange={onChange} placeholder={placeholder} helpText={helpText} />
    </div>
  );
}

// ─── GBP manual entry via URL paste (fallback when listing API unavailable) ──
function GbpManualEntry({ form, setForm }) {
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError]   = useState('');

  function handleUrl(url) {
    setUrlInput(url);
    setUrlError('');
    if (!url.trim()) return;
    // business.google.com/u/0/location/{locationId}/...
    const m = url.match(/\/location\/([A-Za-z0-9_%-]+)/);
    if (m) {
      setForm(f => ({ ...f, gbpLocationId: decodeURIComponent(m[1]) }));
      return;
    }
    setUrlError('No Location ID found in this URL — make sure you copied it from your GBP profile page.');
  }

  const located = !!form.gbpLocationId;

  return (
    <div className="border border-dashed border-[#D1D5DB] rounded-lg p-4 bg-[#F9FAFB]">
      <div className="text-[12px] font-semibold text-[#374151] mb-2">Link profile via URL</div>
      <ol className="text-[11px] text-[#6B7280] mb-3 space-y-1 list-decimal list-inside">
        <li>Open <a href="https://business.google.com" target="_blank" rel="noreferrer"
              className="text-[#2563EB] hover:underline">business.google.com</a></li>
        <li>Click your business → the profile page opens</li>
        <li>Copy the full page URL and paste it below</li>
      </ol>
      <input
        type="text"
        value={urlInput}
        onChange={e => handleUrl(e.target.value)}
        className="form-input text-[12px]"
        placeholder="https://business.google.com/u/0/location/..."
      />
      {urlError && <p className="text-[11px] text-[#DC2626] mt-1.5">{urlError}</p>}
      {located && (
        <div className="flex items-center gap-1.5 mt-2 text-[12px] text-[#16A34A]">
          <CheckCircle2 size={12} /> Location ID detected — save to link this profile
        </div>
      )}
      <details className="mt-3">
        <summary className="text-[11px] text-[#9CA3AF] cursor-pointer hover:text-[#6B7280]">
          Enter IDs manually instead
        </summary>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <label className="form-label">Account ID</label>
            <input type="text" value={form.gbpAccountId || ''}
              onChange={e => setForm(f => ({ ...f, gbpAccountId: e.target.value.trim() }))}
              className="form-input" placeholder="e.g. 123456789" />
          </div>
          <div>
            <label className="form-label">Location ID</label>
            <input type="text" value={form.gbpLocationId || ''}
              onChange={e => setForm(f => ({ ...f, gbpLocationId: e.target.value.trim() }))}
              className="form-input" placeholder="e.g. 987654321" />
          </div>
        </div>
      </details>
    </div>
  );
}

// ─── Main editable business info card ────────────────────────────────────────
function ClientInfoCard({ client, clientId, onUpdate, onGbpSync }) {
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState({});

  // GBP location picker state
  const [agencyConnected,  setAgencyConnected]  = useState(false);
  const [locations,        setLocations]        = useState([]);
  const [locLoading,       setLocLoading]       = useState(false);
  const [locError,         setLocError]         = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);

  async function startEdit() {
    setForm({
      businessName:    client.businessName || client.name || '',
      status:          client.status       || 'ACTIVE',
      category:        client.category     || '',
      brandTone:       client.brandTone    || client.tone || '',
      aboutBusiness:   client.aboutBusiness || '',
      ownerName:       client.ownerName    || '',
      yearEstablished: client.yearEstablished || '',
      openingHours:    client.openingHours || '',
      priceRange:      client.priceRange   || '',
      targetCustomers: client.targetCustomers || '',
      usps:            client.usps         || [],
      certifications:  client.certifications || [],
      nearbyLandmarks: client.nearbyLandmarks || [],
      instagram:       client.instagram    || '',
      facebook:        client.facebook     || '',
      city:            client.city         || '',
      country:         client.country      || 'India',
      address:         client.address      || '',
      phone:           client.phone        || '',
      email:           client.email        || '',
      website:         client.website      || '',
      contactEmail:    client.contactEmail || '',
      services:        client.services     || [],
      keywords:        client.keywords     || [],
      gbpPlaceId:      client.gbpPlaceId   || '',
      gbpAccountId:    client.gbpAccountId || '',
      gbpLocationId:   client.gbpLocationId || ''
    });

    // Load GBP locations for the picker
    setSelectedLocation(null);
    setLocError('');
    try {
      const { data } = await api.get('/gbp/agency/status');
      setAgencyConnected(data.connected);
      if (data.connected) {
        setLocLoading(true);
        try {
          const { data: locs } = await api.get('/gbp/locations');
          const locArray = Array.isArray(locs) ? locs : [];
          setLocations(locArray);
          // Pre-select if this client already has a GBP location
          if (client.gbpAccountId && client.gbpLocationId) {
            const match = locArray.find(l =>
              l.accountId === client.gbpAccountId && l.locationId === client.gbpLocationId
            );
            if (match) setSelectedLocation(match);
          } else if (client.gbpPlaceId) {
            const match = locArray.find(l => l.placeId === client.gbpPlaceId);
            if (match) setSelectedLocation(match);
          }
        } catch { setLocError('Failed to load locations.'); }
        finally { setLocLoading(false); }
      }
    } catch { /* agency status check failed silently */ }

    setIsEditing(true);
  }

  async function loadLocations() {
    setLocLoading(true);
    setLocError('');
    try {
      const { data } = await api.get('/gbp/locations');
      setLocations(Array.isArray(data) ? data : []);
    } catch { setLocError('Failed to load locations. Please try again.'); }
    finally { setLocLoading(false); }
  }

  function handleSelectLocation(loc) {
    setSelectedLocation(loc);
    setForm(f => ({
      ...f,
      gbpPlaceId:    loc.placeId    || '',
      gbpAccountId:  loc.accountId  || '',
      gbpLocationId: loc.locationId || ''
    }));
  }

  function handleClearLocation() {
    setSelectedLocation(null);
    setForm(f => ({ ...f, gbpPlaceId: '', gbpAccountId: '', gbpLocationId: '' }));
  }

  function cancelEdit() { setIsEditing(false); setSelectedLocation(null); }

  const set = (field) => (val) => setForm(f => ({ ...f, [field]: val }));
  const setStr = (field) => (e) => setForm(f => ({ ...f, [field]: typeof e === 'string' ? e : e.target.value }));

  async function handleSave() {
    if (!form.businessName?.trim()) { addToast('Business Name is required', 'error'); return; }
    setSaving(true);
    try {
      const res = await api.put(`/clients/${clientId}`, form);
      onUpdate(res.data);
      setIsEditing(false);
      setSelectedLocation(null);
      addToast('Client details saved successfully', 'success');
      // Trigger GBP data sync if a location is linked
      if (form.gbpAccountId && form.gbpLocationId) {
        onGbpSync?.();
      }
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Read mode ──────────────────────────────────────────────────────────────
  if (!isEditing) {
    return (
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
          <h3 className="text-[15px] font-semibold text-[#111827]">Client Details</h3>
          <button
            onClick={startEdit}
            className="flex items-center gap-1.5 text-[13px] text-[#2563EB] hover:text-[#1D4ED8] font-medium transition-colors"
          >
            <Pencil size={13} />
            Edit Details
          </button>
        </div>

        {/* Business Identity */}
        <CardSection title="Business Identity">
          <div className="flex items-center gap-3 mb-3">
            <h4 className="text-[15px] font-bold text-[#111827]">{client.businessName || client.name}</h4>
            <StatusBadge status={client.status} />
          </div>
          <InfoRow label="Category"   value={client.category} />
          <InfoRow label="Brand Tone" value={client.brandTone || client.tone} />
          {client.aboutBusiness && (
            <InfoRow label="About the Business" value={client.aboutBusiness} multiline />
          )}
        </CardSection>

        {/* Business Profile */}
        {(client.ownerName || client.yearEstablished || client.openingHours || client.priceRange ||
          client.targetCustomers || (client.usps || []).length || (client.certifications || []).length ||
          (client.nearbyLandmarks || []).length || client.instagram || client.facebook) && (
          <CardSection title="Business Profile" icon={Star}>
            <InfoRow label="Owner / Practitioner" value={client.ownerName} />
            <InfoRow label="Established"          value={client.yearEstablished} />
            <InfoRow label="Opening Hours"        value={client.openingHours} />
            <InfoRow label="Price Range"          value={client.priceRange} />
            {client.targetCustomers && (
              <InfoRow label="Target Customers" value={client.targetCustomers} multiline />
            )}
            <TagRow label="Unique Selling Points"  tags={client.usps}            color="blue"   />
            <TagRow label="Certifications / Awards" tags={client.certifications}  color="green"  />
            <TagRow label="Nearby Landmarks"        tags={client.nearbyLandmarks} color="yellow" />
            {(client.instagram || client.facebook) && (
              <div className="py-3 border-b border-[#F3F4F6] last:border-0 flex gap-4">
                {client.instagram && (
                  <a href={client.instagram} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[12px] text-[#E1306C] hover:underline">
                    <Instagram size={13} /> Instagram
                  </a>
                )}
                {client.facebook && (
                  <a href={client.facebook} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[12px] text-[#1877F2] hover:underline">
                    <Facebook size={13} /> Facebook
                  </a>
                )}
              </div>
            )}
          </CardSection>
        )}

        {/* Location & Contact */}
        <CardSection title="Location & Contact" icon={MapPin}>
          <InfoRow label="City"         value={`${client.city || ''}${client.country ? `, ${client.country}` : ''}`} />
          <InfoRow label="Address"      value={client.address} />
          <InfoRow label="Phone"        value={client.phone}   />
          <InfoRow label="Email"        value={client.email}   />
          <InfoRow label="Website"      value={client.website} link />
          <InfoRow label="Report Email" value={client.contactEmail} />
        </CardSection>

        {/* Services */}
        <CardSection title="Services" icon={Award}>
          {(client.services || []).length === 0 ? (
            <p className="text-[13px] text-[#9CA3AF] italic">No services added yet</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(client.services || []).map(s => (
                <span key={s} className="text-[12px] text-[#374151] rounded-full px-2.5 py-0.5"
                  style={{ background: '#F3F4F6' }}>
                  {s}
                </span>
              ))}
            </div>
          )}
        </CardSection>

        {/* Keywords */}
        <CardSection title="Target Keywords" icon={Users}>
          {(client.keywords || []).length === 0 ? (
            <p className="text-[13px] text-[#9CA3AF] italic">No keywords added yet</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(client.keywords || []).map(k => (
                <span key={k} className="text-[12px] text-[#374151] rounded-full px-2.5 py-0.5"
                  style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
                  {k}
                </span>
              ))}
            </div>
          )}
        </CardSection>

        {/* Google Business Profile link status */}
        <CardSection title="Google Business Profile" icon={Building2}>
          {(client.gbpAccountId && client.gbpLocationId) ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-[#16A34A] flex-shrink-0" />
              <span className="text-[13px] text-[#15803D] font-medium">GBP Location Linked</span>
              <span className="text-[11px] text-[#9CA3AF] ml-auto">ID: {client.gbpLocationId}</span>
            </div>
          ) : (
            <p className="text-[13px] text-[#9CA3AF] italic">
              No GBP location linked — edit to select a profile
            </p>
          )}
        </CardSection>
      </div>
    );
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────
  return (
    <div className="card">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E7EB]">
        <h3 className="text-[15px] font-semibold text-[#111827]">Edit Client Details</h3>
        <button onClick={cancelEdit} className="text-[#9CA3AF] hover:text-[#374151] transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Section 1 — Business Identity */}
      <CardSection title="Business Identity">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <EditInput label="Business Name" value={form.businessName} onChange={set('businessName')} placeholder="e.g. Sharma Dental Clinic" required />
            <EditSelect label="Status" value={form.status} onChange={set('status')} options={STATUSES} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <EditSelect label="Category" value={form.category} onChange={set('category')} options={CATEGORIES} />
            <EditSelect label="Brand Tone" value={form.brandTone} onChange={set('brandTone')} options={TONES} />
          </div>
          <EditTextarea
            label="About the Business"
            value={form.aboutBusiness}
            onChange={set('aboutBusiness')}
            rows={4}
            placeholder="Describe the business, what makes it unique, target customers, specializations..."
            helpText="Used by AI to generate better content and GBP descriptions"
          />
        </div>
      </CardSection>

      {/* Section 2 — Business Profile */}
      <CardSection title="Business Profile (AI Context)" icon={Star}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <EditInput label="Owner / Practitioner" value={form.ownerName} onChange={set('ownerName')} placeholder="Dr. Rahul Sharma" />
            <EditInput label="Year Established" value={form.yearEstablished} onChange={set('yearEstablished')} placeholder="2009" />
            <EditSelect label="Price Range" value={form.priceRange} onChange={set('priceRange')} options={PRICE_RANGES} />
          </div>
          <EditInput label="Opening Hours" value={form.openingHours} onChange={set('openingHours')} placeholder="Mon–Sat 9AM–8PM, Sun 10AM–4PM" />
          <EditTextarea
            label="Target Customers"
            value={form.targetCustomers}
            onChange={set('targetCustomers')}
            rows={3}
            placeholder="Who are the ideal customers? Age group, demographics, problems they're solving..."
            helpText="AI writes content that speaks directly to these people"
          />
          <EditTagInput
            label="Unique Selling Points"
            value={form.usps}
            onChange={set('usps')}
            placeholder="Type a USP and press Enter..."
            helpText='e.g. "Only NABH-accredited clinic in Indira Nagar", "Same-day appointments"'
          />
          <EditTagInput
            label="Certifications & Awards"
            value={form.certifications}
            onChange={set('certifications')}
            placeholder="Type a certification and press Enter..."
            helpText="e.g. ISO 9001, NABH Accredited, Times Best Award 2023"
          />
          <EditTagInput
            label="Nearby Landmarks"
            value={form.nearbyLandmarks}
            onChange={set('nearbyLandmarks')}
            placeholder="Type a landmark and press Enter..."
            helpText='e.g. "Near Fun Republic Mall", "Opposite HDFC Bank"'
          />
          <div className="grid grid-cols-2 gap-4">
            <EditInput label="Instagram" value={form.instagram} onChange={set('instagram')} placeholder="https://instagram.com/businessname" />
            <EditInput label="Facebook"  value={form.facebook}  onChange={set('facebook')}  placeholder="https://facebook.com/businessname" />
          </div>
        </div>
      </CardSection>

      {/* Section 3 — Location & Contact */}
      <CardSection title="Location & Contact" icon={MapPin}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <EditInput label="City"    value={form.city}    onChange={set('city')}    placeholder="e.g. Lucknow" />
            <EditInput label="Country" value={form.country} onChange={set('country')} placeholder="e.g. India" />
          </div>
          <EditInput label="Full Address" value={form.address} onChange={set('address')} placeholder="42, Indira Nagar, Lucknow, UP 226016" />
          <div className="grid grid-cols-3 gap-4">
            <EditInput label="Phone"         value={form.phone}        onChange={set('phone')}        placeholder="+91 9876543210" />
            <EditInput label="Business Email" value={form.email}       onChange={set('email')}        placeholder="business@email.com" type="email" />
            <EditInput label="Website"       value={form.website}      onChange={set('website')}      placeholder="https://businessname.in" />
          </div>
          <EditInput label="Report Email" value={form.contactEmail} onChange={set('contactEmail')} placeholder="Monthly reports sent here" type="email" />
        </div>
      </CardSection>

      {/* Section 4 — Services & Keywords */}
      <CardSection title="Services & Keywords" icon={Award}>
        <div className="space-y-4">
          <EditTagInput
            label="Services Offered"
            value={form.services}
            onChange={set('services')}
            placeholder="Type a service and press Enter..."
            helpText="e.g. Root Canal, Teeth Whitening, Orthodontics"
          />
          <EditTagInput
            label="Target Keywords"
            value={form.keywords}
            onChange={set('keywords')}
            placeholder="Type a keyword and press Enter..."
            helpText="Used for all AI-generated content and GBP optimization"
          />
        </div>
      </CardSection>

      {/* Section 5 — Google Business Profile */}
      <CardSection title="Google Business Profile" icon={Building2}>
        {!agencyConnected ? (
          <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-4 py-3">
            <span className="text-lg flex-shrink-0">⚠️</span>
            <div>
              <div className="text-[13px] font-semibold text-[#92400E]">Google account not connected</div>
              <div className="text-[12px] text-[#B45309] mt-0.5">
                Connect your agency Google account in Agency Settings first.
              </div>
              <a href="/api/auth/google/agency"
                className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-semibold text-[#2563EB] hover:underline">
                Connect Google →
              </a>
            </div>
          </div>
        ) : selectedLocation ? (
          <div className="flex items-center gap-4 bg-[#F0FDF4] border border-[#BBF7D0] rounded-lg px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-[#16A34A]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-[#111827] truncate">{selectedLocation.businessName}</div>
              {selectedLocation.address && (
                <div className="flex items-center gap-1 text-[12px] text-[#6B7280] mt-0.5">
                  <MapPin size={11} className="flex-shrink-0" />
                  <span className="truncate">{selectedLocation.address}</span>
                </div>
              )}
              {selectedLocation.category && (
                <div className="text-[11px] text-[#9CA3AF] mt-0.5">{selectedLocation.category}</div>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearLocation}
              className="flex-shrink-0 text-[12px] text-[#6B7280] hover:text-[#374151] border border-[#E5E7EB] rounded-md px-2.5 py-1 bg-white transition-colors"
            >
              Change
            </button>
          </div>
        ) : locLoading ? (
          <div className="flex items-center gap-2.5 py-4 text-[13px] text-[#6B7280]">
            <Loader2 size={15} className="animate-spin text-[#2563EB]" />
            Loading Google Business Profiles…
          </div>
        ) : locError ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
              <div className="text-[13px] text-[#DC2626]">{locError}</div>
              <button type="button" onClick={loadLocations}
                className="flex items-center gap-1 text-[12px] font-semibold text-[#DC2626] hover:underline ml-4">
                <RefreshCw size={11} /> Retry
              </button>
            </div>
            <GbpManualEntry form={form} setForm={setForm} />
          </div>
        ) : locations.length === 0 ? (
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-4 py-3">
              <Building2 size={16} className="text-[#9CA3AF] flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[13px] text-[#374151]">No Business Profiles found on your Google account.</div>
                <button type="button" onClick={loadLocations}
                  className="flex items-center gap-1 mt-2 text-[12px] font-semibold text-[#2563EB] hover:underline">
                  <RefreshCw size={11} /> Refresh list
                </button>
              </div>
            </div>
            <GbpManualEntry form={form} setForm={setForm} />
          </div>
        ) : (
          <div>
            <div className="text-[12px] text-[#6B7280] mb-2 flex items-center justify-between">
              <span>{locations.length} profile{locations.length !== 1 ? 's' : ''} found</span>
              <button type="button" onClick={loadLocations}
                className="flex items-center gap-1 text-[11px] text-[#9CA3AF] hover:text-[#6B7280]">
                <RefreshCw size={10} /> Refresh
              </button>
            </div>
            <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
              {locations.map((loc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectLocation(loc)}
                  className="w-full text-left px-4 py-3 hover:bg-[#F9FAFB] border-b border-[#F3F4F6] last:border-0 transition-colors flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0">
                    <Building2 size={14} className="text-[#2563EB]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#111827] truncate">{loc.businessName}</div>
                    <div className="text-[11px] text-[#6B7280] truncate mt-0.5">{loc.address}</div>
                  </div>
                  <span className="text-[11px] text-[#9CA3AF] flex-shrink-0">{loc.category}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardSection>

      {/* Save / Cancel footer */}
      <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
        <button onClick={cancelEdit} className="btn-secondary" disabled={saving}>
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary disabled:opacity-60"
        >
          {saving
            ? <><RefreshCw size={13} className="animate-spin" /> Saving…</>
            : <><Check size={13} /> Save Changes</>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ClientDetail() {
  const { clientId }  = useParams();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  // GBP sync banner state
  const [gbpSyncStatus, setGbpSyncStatus] = useState(null); // null | 'syncing' | 'done' | 'error'

  async function handleGbpSync() {
    setGbpSyncStatus('syncing');
    try {
      await api.post(`/clients/${clientId}/gbp/sync`);
      const refreshed = await api.get(`/clients/${clientId}`);
      setClient(refreshed.data);
      setGbpSyncStatus('done');
      setTimeout(() => setGbpSyncStatus(null), 5000);
    } catch {
      setGbpSyncStatus('error');
      setTimeout(() => setGbpSyncStatus(null), 6000);
    }
  }

  useEffect(() => {
    api.get(`/clients/${clientId}`)
      .then(r => { setClient(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!client) return <div className="p-8 text-[#6B7280]">Client not found.</div>;

  const p = client.performance || {};

  return (
    <ClientLayout client={client}>
      <div className="flex gap-6">
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4 min-w-0">

          {/* Page title */}
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[24px] font-bold text-[#111827]">
                {client.businessName || client.name}
              </h1>
              {(client.gbpAccountId && client.gbpLocationId) && (
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#16A34A] bg-[#F0FDF4] border border-[#BBF7D0] rounded-full px-3 py-1">
                  <CheckCircle2 size={12} />
                  GBP Linked
                </span>
              )}
            </div>
            <p className="text-[14px] text-[#6B7280] mt-0.5">
              {client.category}
              {client.city ? ` · ${client.colony ? `${client.colony}, ` : ''}${client.city}` : ''}
              {client.ownerName ? ` · ${client.ownerName}` : ''}
            </p>
          </div>

          {/* GBP sync banner */}
          {gbpSyncStatus && (
            <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-[13px] ${
              gbpSyncStatus === 'syncing' ? 'bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8]' :
              gbpSyncStatus === 'done'    ? 'bg-[#F0FDF4] border border-[#BBF7D0] text-[#15803D]' :
                                           'bg-[#FEF2F2] border border-[#FECACA] text-[#DC2626]'
            }`}>
              {gbpSyncStatus === 'syncing' && <RefreshCw size={14} className="animate-spin flex-shrink-0" />}
              {gbpSyncStatus === 'done'    && <CheckCircle2 size={14} className="flex-shrink-0" />}
              {gbpSyncStatus === 'syncing'
                ? 'Syncing GBP profile, reviews, and performance data…'
                : gbpSyncStatus === 'done'
                ? 'GBP data synced — profile, reviews, and performance updated.'
                : 'GBP sync failed. Check your Google connection and try again.'
              }
            </div>
          )}

          {/* Editable client info card */}
          <ClientInfoCard
            client={client}
            clientId={clientId}
            onUpdate={setClient}
            onGbpSync={handleGbpSync}
          />

          {/* GBP Optimization Panel */}
          <GbpOptimizationPanel clientId={clientId} clientData={client} />
        </div>

        {/* ── Right panel ─────────────────────────────────────────────────── */}
        <div className="w-[272px] space-y-4 flex-shrink-0">

          {/* GBP Profile link card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-[#111827]">GBP Profile</h3>
              {(client.gbpAccountId && client.gbpLocationId) && (
                <button
                  onClick={handleGbpSync}
                  disabled={gbpSyncStatus === 'syncing'}
                  className="flex items-center gap-1 text-[11px] text-[#6B7280] hover:text-[#374151] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={11} className={gbpSyncStatus === 'syncing' ? 'animate-spin' : ''} />
                  {gbpSyncStatus === 'syncing' ? 'Syncing…' : 'Sync Now'}
                </button>
              )}
            </div>

            {(client.gbpAccountId && client.gbpLocationId) ? (
              <>
                <div className="flex items-start gap-2.5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#EFF6FF] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Building2 size={14} className="text-[#2563EB]" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-[#111827] truncate">
                      {client.businessName || client.name}
                    </div>
                    {client.address && (
                      <div className="text-[11px] text-[#6B7280] mt-0.5 truncate">{client.address}</div>
                    )}
                    {client.category && (
                      <div className="text-[11px] text-[#9CA3AF] mt-0.5">{client.category}</div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-[12px]">
                  {client.gbpPlaceId && (
                    <a
                      href={`https://www.google.com/maps/place/?q=place_id:${client.gbpPlaceId}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-[#2563EB] hover:underline"
                    >
                      <ExternalLink size={11} className="flex-shrink-0" />
                      View on Google Maps
                    </a>
                  )}
                  <a
                    href={`https://business.google.com/u/0/location/${client.gbpLocationId}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-[#6B7280] hover:text-[#374151] hover:underline"
                  >
                    <ExternalLink size={11} className="flex-shrink-0" />
                    Manage in GBP
                  </a>
                </div>

                {client.performance?.lastSynced && (
                  <div className="text-[11px] text-[#9CA3AF] mt-3 pt-3 border-t border-[#F3F4F6]">
                    Last synced:{' '}
                    {new Date(client.performance.lastSynced).toLocaleString('en-IN', {
                      day: 'numeric', month: 'short',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-3">
                <Building2 size={20} className="text-[#D1D5DB] mx-auto mb-2" />
                <p className="text-[12px] text-[#9CA3AF]">No profile linked</p>
                <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                  Edit client details to link a GBP profile
                </p>
              </div>
            )}
          </div>

          {/* Performance */}
          <div className="card p-5">
            <h3 className="text-[15px] font-semibold text-[#111827] mb-0.5">Performance</h3>
            <p className="text-[12px] text-[#6B7280] mb-4">Last 30 days</p>
            <div className="space-y-3">
              {[
                { icon: '👁', label: 'Profile Views',       val: p.profileViews,       trend: p.profileViewsTrend       },
                { icon: '📞', label: 'Phone Calls',         val: p.phoneCalls,         trend: p.phoneCallsTrend         },
                { icon: '🗺', label: 'Direction Requests',  val: p.directionRequests,  trend: p.directionRequestsTrend  },
                { icon: '⭐', label: 'New Reviews',         val: p.newReviews,         trend: p.newReviewsTrend         },
                { icon: '🌐', label: 'Website Clicks',      val: p.websiteClicks,      trend: p.websiteClicksTrend      }
              ].map(({ icon, label, val, trend }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[17px] w-6 flex-shrink-0">{icon}</span>
                  <span className="text-[13px] text-[#374151] flex-1">{label}</span>
                  <div className="text-right">
                    <div className="text-[15px] font-semibold text-[#111827]">{(val || 0).toLocaleString()}</div>
                    <Trend value={trend || 0} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats summary */}
          {client.stats && (
            <div className="card p-5">
              <h3 className="text-[15px] font-semibold text-[#111827] mb-3">Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Posts',     val: client.stats.posts     },
                  { label: 'Reviews',   val: client.stats.reviews   },
                  { label: 'Citations', val: client.stats.citations },
                  { label: 'Avg Rating', val: client.stats.avgRating ? `${client.stats.avgRating}★` : '—' }
                ].map(({ label, val }) => (
                  <div key={label} className="bg-[#F9FAFB] rounded-lg p-3 text-center">
                    <div className="text-[18px] font-bold text-[#111827]">{val}</div>
                    <div className="text-[11px] text-[#6B7280] mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E5E7EB]">
              <h3 className="text-[14px] font-semibold text-[#111827]">Quick Actions</h3>
            </div>
            {[
              { label: 'Content Calendar',    to:   `/clients/${clientId}/content`   },
              { label: 'Manage Reviews',      to:   `/clients/${clientId}/reviews`   },
              { label: 'Citation Builder',    to:   `/clients/${clientId}/citations` },
              { label: 'Keyword Tracker',     to:   `/clients/${clientId}/keywords`  },
              { label: 'Monthly Reports',     to:   `/clients/${clientId}/reports`   },
              { label: 'View Website',        href: client.website                   }
            ].filter(a => a.href ? !!a.href : true).map(({ label, href, to }, i) => (
              <div key={i} className="border-b border-[#F3F4F6] last:border-0">
                {href ? (
                  <a href={href} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between px-5 py-3 hover:bg-[#F9FAFB] transition-colors">
                    <span className="text-[13px] text-[#374151]">{label}</span>
                    <ChevronRight size={13} className="text-[#9CA3AF]" />
                  </a>
                ) : (
                  <Link to={to}
                    className="flex items-center justify-between px-5 py-3 hover:bg-[#F9FAFB] transition-colors">
                    <span className="text-[13px] text-[#374151]">{label}</span>
                    <ChevronRight size={13} className="text-[#9CA3AF]" />
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* AI Context health indicator */}
          <div className="card p-4">
            <h3 className="text-[13px] font-semibold text-[#111827] mb-3">AI Context Quality</h3>
            <AiContextScore client={client} />
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}

// ─── AI context quality score ─────────────────────────────────────────────────
function AiContextScore({ client }) {
  const checks = [
    { label: 'About Business',     filled: !!client.aboutBusiness                     },
    { label: 'Target Customers',   filled: !!client.targetCustomers                   },
    { label: 'Owner Name',         filled: !!client.ownerName                         },
    { label: 'Opening Hours',      filled: !!client.openingHours                      },
    { label: 'Unique Selling Points', filled: (client.usps || []).length > 0          },
    { label: 'Certifications',     filled: (client.certifications || []).length > 0   },
    { label: 'Nearby Landmarks',   filled: (client.nearbyLandmarks || []).length > 0  },
    { label: 'Price Range',        filled: !!client.priceRange                        },
    { label: 'Services',           filled: (client.services || []).length > 0         },
    { label: 'Keywords',           filled: (client.keywords || []).length > 0         }
  ];

  const filled  = checks.filter(c => c.filled).length;
  const total   = checks.length;
  const pct     = Math.round((filled / total) * 100);
  const color   = pct >= 80 ? '#16A34A' : pct >= 50 ? '#D97706' : '#DC2626';
  const label   = pct >= 80 ? 'Excellent' : pct >= 50 ? 'Good' : 'Needs work';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-semibold" style={{ color }}>{label}</span>
        <span className="text-[12px] text-[#6B7280]">{filled}/{total} fields</span>
      </div>
      <div className="w-full h-1.5 bg-[#F3F4F6] rounded-full mb-3">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="space-y-1.5">
        {checks.filter(c => !c.filled).slice(0, 4).map(c => (
          <div key={c.label} className="flex items-center gap-2 text-[11px] text-[#9CA3AF]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#E5E7EB] flex-shrink-0" />
            {c.label}
          </div>
        ))}
        {checks.filter(c => !c.filled).length > 4 && (
          <div className="text-[11px] text-[#9CA3AF]">
            +{checks.filter(c => !c.filled).length - 4} more missing
          </div>
        )}
      </div>
    </div>
  );
}
