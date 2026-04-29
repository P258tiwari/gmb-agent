import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Check, Loader2, Sparkles, X, Building2, MapPin, RefreshCw } from 'lucide-react';
import Layout from '../components/Layout';
import TagInput from '../components/TagInput';
import api from '../lib/api';

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

const STATUSES = [
  { value: 'active',   label: 'Active'   },
  { value: 'pending',  label: 'Pending'  },
  { value: 'inactive', label: 'Inactive' }
];

const PRICE_RANGES = [
  { value: 'Budget-friendly', label: 'Budget-friendly (₹)' },
  { value: 'Mid-range',       label: 'Mid-range (₹₹)'      },
  { value: 'Premium',         label: 'Premium (₹₹₹)'       },
  { value: 'Luxury',          label: 'Luxury (₹₹₹₹)'       }
];

const INITIAL_FORM = {
  // Section 1 — Business Identity
  businessName:  '',
  status:        'active',
  aboutBusiness: '',
  category:      '',
  brandTone:     '',

  // Section 2 — Business Profile (AI context)
  ownerName:       '',
  yearEstablished: '',
  openingHours:    '',
  priceRange:      '',
  targetCustomers: '',
  usps:            [],
  certifications:  [],
  nearbyLandmarks: [],
  instagram:       '',
  facebook:        '',

  // Section 3 — GBP
  gbpPlaceId:    '',
  gbpAccountId:  '',
  gbpLocationId: '',

  // Section 4 — Location & Contact
  city:          '',
  country:       'India',
  address:       '',
  email:         '',
  phone:         '',
  website:       '',

  // Section 5 — Services & Keywords
  services:      [],
  keywords:      [],

  // Section 6 — Reporting
  contactEmail:  ''
};

export default function AddClient() {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(null);
  const [error, setError]       = useState('');

  // GBP location picker state
  const [locations,        setLocations]        = useState([]);
  const [locLoading,       setLocLoading]       = useState(false);
  const [locError,         setLocError]         = useState('');
  const [agencyConnected,  setAgencyConnected]  = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Auto-load GBP locations when form opens
  useEffect(() => {
    api.get('/gbp/agency/status').then(r => {
      setAgencyConnected(r.data.connected);
      if (r.data.connected) loadLocations();
    }).catch(() => {});
  }, []);

  async function loadLocations() {
    setLocLoading(true);
    setLocError('');
    try {
      const res = await api.get('/gbp/locations');
      setLocations(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLocError('Failed to load locations. Please try again.');
    } finally {
      setLocLoading(false);
    }
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

  // Keyword suggestions state
  const [suggestedKws, setSuggestedKws]         = useState([]);
  const [kwLoading, setKwLoading]               = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  // ── Keyword suggestions ───────────────────────────────────────────────────────
  async function handleSuggestKeywords() {
    setKwLoading(true);
    try {
      const res = await api.post('/clients/temp/keywords', {
        businessName: form.businessName,
        category:     form.category,
        city:         form.city,
        services:     form.services
      });
      setSuggestedKws(res.data || []);
    } catch { setSuggestedKws([]); }
    finally { setKwLoading(false); }
  }

  function addSuggestedKw(kw) {
    if (!form.keywords.includes(kw)) {
      setForm(f => ({ ...f, keywords: [...f.keywords, kw] }));
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.businessName.trim()) { setError('Business Name is required.'); return; }
    if (!form.category)            { setError('Please select a Business Category.'); return; }
    if (!form.city.trim())         { setError('City is required.'); return; }
    if (!form.contactEmail.trim()) { setError('Client Contact Email is required.'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/clients', form);
      setSuccess(res.data);
      setTimeout(() => navigate(`/clients/${res.data.id}`), 1500);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create client. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Success overlay ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="card p-10 text-center max-w-sm w-full">
            <div className="w-14 h-14 rounded-full bg-[#F0FDF4] flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-[#16A34A]" />
            </div>
            <h2 className="text-[18px] font-bold text-[#111827] mb-1">Client Added!</h2>
            <p className="text-[13px] text-[#6B7280] mb-1">
              <span className="font-semibold text-[#111827]">{success.businessName}</span> has been created.
            </p>
            <p className="text-[12px] text-[#9CA3AF]">
              Setting up keywords, citations & initial posts in the background…
            </p>
            <div className="mt-5 flex items-center justify-center gap-1.5 text-[12px] text-[#6B7280]">
              <Loader2 size={13} className="animate-spin" />
              Redirecting to client page…
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/dashboard" className="text-[#6B7280] hover:text-[#374151] transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-[24px] font-bold text-[#111827]">Add New Client</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card">

          {/* ── Section 1 — Business Identity ──────────────────────────────── */}
          <Section number="1" title="Business Identity" subtitle="Core information about the client's business">

            {/* Row 1: Name + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Business Name *</label>
                <input
                  type="text"
                  value={form.businessName}
                  onChange={set('businessName')}
                  className="form-input"
                  placeholder="e.g. Sharma Dental Clinic"
                  required
                />
              </div>
              <div>
                <label className="form-label">Status</label>
                <select value={form.status} onChange={set('status')} className="form-select">
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {/* Row 2: About (full width) */}
            <div className="mt-4">
              <label className="form-label">About the Business *</label>
              <textarea
                rows={4}
                value={form.aboutBusiness}
                onChange={set('aboutBusiness')}
                className="form-textarea"
                placeholder="Describe the business, what makes it unique, target customers, specializations..."
                required
              />
              <p className="text-[11px] text-[#6B7280] mt-1.5">
                This is used to generate better content and GBP descriptions
              </p>
            </div>

            {/* Row 3: Category + Brand Tone */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="form-label">Category *</label>
                <select value={form.category} onChange={set('category')} className="form-select" required>
                  <option value="">Select Business Category</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Brand Tone</label>
                <select value={form.brandTone} onChange={set('brandTone')} className="form-select">
                  <option value="">Select Brand Tone</option>
                  {TONES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </Section>

          <div className="border-t border-[#E5E7EB]" />

          {/* ── Section 2 — Business Profile ───────────────────────────────── */}
          <Section number="2" title="Business Profile" subtitle="Key details that give AI a complete picture of this business">

            {/* Owner name + Year + Price range */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="form-label">Owner / Practitioner Name</label>
                <input
                  type="text"
                  value={form.ownerName}
                  onChange={set('ownerName')}
                  className="form-input"
                  placeholder="e.g. Dr. Rahul Sharma"
                />
              </div>
              <div>
                <label className="form-label">Year Established</label>
                <input
                  type="text"
                  value={form.yearEstablished}
                  onChange={set('yearEstablished')}
                  className="form-input"
                  placeholder="e.g. 2009"
                />
              </div>
              <div>
                <label className="form-label">Price Range</label>
                <select value={form.priceRange} onChange={set('priceRange')} className="form-select">
                  <option value="">Select Price Range</option>
                  {PRICE_RANGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Opening hours */}
            <div className="mt-4">
              <label className="form-label">Opening Hours</label>
              <input
                type="text"
                value={form.openingHours}
                onChange={set('openingHours')}
                className="form-input"
                placeholder="e.g. Mon–Sat 9AM–8PM, Sunday 10AM–4PM"
              />
              <p className="text-[11px] text-[#6B7280] mt-1.5">
                Used in posts and GBP descriptions
              </p>
            </div>

            {/* Target customers */}
            <div className="mt-4">
              <label className="form-label">Target Customers</label>
              <textarea
                rows={3}
                value={form.targetCustomers}
                onChange={set('targetCustomers')}
                className="form-textarea"
                placeholder="Who are the ideal customers? e.g. Families with young children, working professionals aged 25–45, senior citizens needing chronic care management..."
              />
              <p className="text-[11px] text-[#6B7280] mt-1.5">
                AI uses this to write content that speaks directly to the right audience
              </p>
            </div>

            {/* USPs */}
            <div className="mt-4">
              <label className="form-label">Unique Selling Points</label>
              <TagInput
                value={form.usps}
                onChange={v => setForm(f => ({ ...f, usps: v }))}
                placeholder="Type a USP and press Enter..."
                helpText='e.g. "Only NABH-accredited clinic in Indira Nagar", "15+ years Dr. Sharma experience", "Same-day appointments available"'
              />
            </div>

            {/* Certifications */}
            <div className="mt-4">
              <label className="form-label">Certifications & Awards</label>
              <TagInput
                value={form.certifications}
                onChange={v => setForm(f => ({ ...f, certifications: v }))}
                placeholder="Type a certification and press Enter..."
                helpText="e.g. ISO 9001:2015, NABH Accredited, Times Best Dentist Award 2023"
              />
            </div>

            {/* Nearby landmarks */}
            <div className="mt-4">
              <label className="form-label">Nearby Landmarks</label>
              <TagInput
                value={form.nearbyLandmarks}
                onChange={v => setForm(f => ({ ...f, nearbyLandmarks: v }))}
                placeholder="Type a landmark and press Enter..."
                helpText='e.g. "Near Fun Republic Mall", "Opposite HDFC Bank Indira Nagar", "2 min from Lekhraj Metro"'
              />
              <p className="text-[11px] text-[#6B7280] mt-1.5">
                Boosts hyper-local SEO — Google Maps ranks businesses that mention nearby landmarks
              </p>
            </div>

            {/* Social media */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="form-label">Instagram</label>
                <input
                  type="text"
                  value={form.instagram}
                  onChange={set('instagram')}
                  className="form-input"
                  placeholder="https://instagram.com/businessname"
                />
              </div>
              <div>
                <label className="form-label">Facebook</label>
                <input
                  type="text"
                  value={form.facebook}
                  onChange={set('facebook')}
                  className="form-input"
                  placeholder="https://facebook.com/businessname"
                />
              </div>
            </div>
          </Section>

          <div className="border-t border-[#E5E7EB]" />

          {/* ── Section 3 — Google Business Profile ────────────────────────── */}
          <Section number="3" title="Google Business Profile" subtitle="Select the client's listing from your connected Google account">

            {!agencyConnected ? (
              /* Not connected */
              <div className="flex items-start gap-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg px-4 py-3">
                <span className="text-lg flex-shrink-0">⚠️</span>
                <div>
                  <div className="text-[13px] font-semibold text-[#92400E]">Google account not connected</div>
                  <div className="text-[12px] text-[#B45309] mt-0.5">
                    Connect your agency Google account in the top-right header first, then come back to select a profile.
                  </div>
                  <a
                    href="/api/auth/google/agency"
                    className="inline-flex items-center gap-1.5 mt-2 text-[12px] font-semibold text-[#2563EB] hover:underline"
                  >
                    Connect Google →
                  </a>
                </div>
              </div>
            ) : selectedLocation ? (
              /* Location selected — show confirmation card */
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
              /* Loading */
              <div className="flex items-center gap-2.5 py-4 text-[13px] text-[#6B7280]">
                <Loader2 size={15} className="animate-spin text-[#2563EB]" />
                Loading your Google Business Profiles…
              </div>
            ) : locError ? (
              /* Error */
              <div className="flex items-center justify-between bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">
                <div className="text-[13px] text-[#DC2626]">{locError}</div>
                <button type="button" onClick={loadLocations}
                  className="flex items-center gap-1 text-[12px] font-semibold text-[#DC2626] hover:underline ml-4">
                  <RefreshCw size={11} /> Retry
                </button>
              </div>
            ) : locations.length === 0 ? (
              /* No locations */
              <div className="flex items-start gap-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-4 py-3">
                <Building2 size={16} className="text-[#9CA3AF] flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-[13px] text-[#374151]">No Business Profiles found on your Google account.</div>
                  <div className="text-[12px] text-[#9CA3AF] mt-0.5">
                    Make sure the Google account you connected has access to the Business Profile.
                  </div>
                  <button type="button" onClick={loadLocations}
                    className="flex items-center gap-1 mt-2 text-[12px] font-semibold text-[#2563EB] hover:underline">
                    <RefreshCw size={11} /> Refresh list
                  </button>
                </div>
              </div>
            ) : (
              /* Location list */
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
                <p className="text-[11px] text-[#9CA3AF] mt-2">
                  Can't find a profile? Make sure that Google account has manager access to the Business Profile.
                </p>
              </div>
            )}
          </Section>

          <div className="border-t border-[#E5E7EB]" />

          {/* ── Section 4 — Location & Contact ─────────────────────────────── */}
          <Section number="4" title="Location & Contact" subtitle="Business address and contact information">

            {/* City + Country */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">City *</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={set('city')}
                  className="form-input"
                  placeholder="e.g. Lucknow"
                  required
                />
              </div>
              <div>
                <label className="form-label">Country *</label>
                <input
                  type="text"
                  value={form.country}
                  onChange={set('country')}
                  className="form-input"
                  placeholder="e.g. India"
                />
              </div>
            </div>

            {/* Full Address */}
            <div className="mt-4">
              <label className="form-label">Full Address *</label>
              <input
                type="text"
                value={form.address}
                onChange={set('address')}
                className="form-input"
                placeholder="e.g. 42, Indira Nagar, Lucknow, Uttar Pradesh 226016"
                required
              />
            </div>

            {/* Email + Phone + Website */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  className="form-input"
                  placeholder="business@email.com"
                  required
                />
              </div>
              <div>
                <label className="form-label">Phone *</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={set('phone')}
                  className="form-input"
                  placeholder="+91 9876543210"
                  required
                />
              </div>
              <div>
                <label className="form-label">Website</label>
                <input
                  type="text"
                  value={form.website}
                  onChange={set('website')}
                  className="form-input"
                  placeholder="https://businessname.in"
                />
              </div>
            </div>
          </Section>

          <div className="border-t border-[#E5E7EB]" />

          {/* ── Section 5 — Services & Keywords ────────────────────────────── */}
          <Section number="5" title="Services & Keywords" subtitle="What the business offers and how customers find it">

            {/* Services */}
            <div>
              <label className="form-label">Services Offered</label>
              <TagInput
                value={form.services}
                onChange={v => setForm(f => ({ ...f, services: v }))}
                placeholder="Type a service and press Enter..."
                helpText="e.g. Root Canal, Teeth Whitening, Orthodontics, Dental Implants"
              />
            </div>

            {/* Keywords */}
            <div className="mt-4">
              <label className="form-label">Target Keywords</label>
              <TagInput
                value={form.keywords}
                onChange={v => setForm(f => ({ ...f, keywords: v }))}
                placeholder="Type a keyword and press Enter..."
              />
              <p className="text-[11px] text-[#6B7280] mt-1.5">
                Or leave empty — 40 keywords will be auto-generated on save
              </p>

              {/* Auto-suggest button */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleSuggestKeywords}
                  disabled={kwLoading}
                  className="btn-secondary text-[12px] disabled:opacity-50 flex items-center gap-1.5"
                >
                  {kwLoading
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Sparkles size={12} />
                  }
                  Auto-generate keywords
                </button>
              </div>

              {/* Suggested keyword pills */}
              {suggestedKws.length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-medium text-[#6B7280] mb-2">Suggested:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedKws.map(kw => {
                      const already = form.keywords.includes(kw);
                      return (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => addSuggestedKw(kw)}
                          disabled={already}
                          className="text-[12px] rounded-full px-3 py-1 transition-colors disabled:opacity-50"
                          style={{
                            background: already ? '#EFF6FF' : '#F3F4F6',
                            color:      already ? '#2563EB' : '#374151',
                            border:     `1px solid ${already ? '#BFDBFE' : '#E5E7EB'}`
                          }}
                        >
                          {kw}
                          {already && <span className="ml-1 text-[#2563EB]">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Section>

          <div className="border-t border-[#E5E7EB]" />

          {/* ── Section 6 — Reporting & Contact ────────────────────────────── */}
          <Section number="6" title="Reporting & Contact" subtitle="Where results and reports will be sent">

            {/* Contact email */}
            <div>
              <label className="form-label">Client Contact Email *</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="email"
                  value={form.contactEmail}
                  onChange={set('contactEmail')}
                  className="form-input pl-8"
                  placeholder="client@example.com"
                  required
                />
              </div>
              <p className="text-[11px] text-[#6B7280] mt-1.5">
                Monthly performance reports will be sent to this address
              </p>
            </div>

            {/* Info box */}
            <div
              className="mt-4 rounded-lg p-4"
              style={{ background: '#EFF6FF', borderLeft: '3px solid #2563EB' }}
            >
              <div className="text-[13px] font-semibold text-[#2563EB] mb-2">
                ✨ After saving, system will:
              </div>
              <ul className="space-y-1.5">
                {[
                  'Fetch current GBP profile data',
                  'Generate 40 local SEO keywords',
                  'Find 5 citation opportunities',
                  'Reply to all unanswered reviews',
                  'Generate this month\'s content calendar',
                  'Prepare GBP optimization suggestions'
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 text-[13px] text-[#374151]">
                    <Check size={13} className="text-[#2563EB] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Section>

          {/* ── Footer ─────────────────────────────────────────────────────── */}
          <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-end gap-3">
            {error && (
              <span className="text-[13px] text-[#DC2626] mr-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] flex-shrink-0" />
                {error}
              </span>
            )}
            <Link to="/dashboard" className="btn-secondary">Cancel</Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-60"
            >
              {loading
                ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                : 'Save Client →'
              }
            </button>
          </div>
        </div>
      </form>
    </Layout>
  );
}

function Section({ number, title, subtitle, children }) {
  return (
    <div className="px-6 py-6">
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-5 h-5 rounded-full bg-[#2563EB] text-white text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
            {number}
          </span>
          <h3 className="text-[16px] font-semibold text-[#111827]">{title}</h3>
        </div>
        <p className="text-[13px] text-[#6B7280] pl-7">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
