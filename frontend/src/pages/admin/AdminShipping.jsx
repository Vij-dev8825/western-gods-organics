import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';

export default function AdminShipping() {
  const { token } = useAuth();
  const [settings, setSettings] = useState({
    domesticFee: '', domesticFreeThreshold: '', domesticShippingEnabled: true,
    localPincodes: '', localFee: '', localFreeThreshold: '',
    pickupEnabled: false, pickupHours: '', refillDiscount: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.admin.getShippingSettings(token).then((d) => setSettings({
      domesticFee: String(d.shippingSettings.domesticFee),
      domesticFreeThreshold: String(d.shippingSettings.domesticFreeThreshold),
      domesticShippingEnabled: d.shippingSettings.domesticShippingEnabled,
      localPincodes: d.shippingSettings.localPincodes || '',
      localFee: String(d.shippingSettings.localFee ?? 0),
      localFreeThreshold: String(d.shippingSettings.localFreeThreshold ?? 0),
      pickupEnabled: !!d.shippingSettings.pickupEnabled,
      pickupHours: d.shippingSettings.pickupHours || '',
      refillDiscount: String(d.shippingSettings.refillDiscount ?? 0),
    })).catch(() => {});
  }, [token]);

  async function save() {
    const domesticFee = Number(settings.domesticFee);
    const domesticFreeThreshold = Number(settings.domesticFreeThreshold);
    if (!(domesticFee >= 0) || !(domesticFreeThreshold >= 0)) {
      setMessage({ type: 'error', text: 'Shipping fee and free-shipping threshold must be non-negative numbers.' });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const d = await api.admin.updateShippingSettings(token, {
        domesticFee,
        domesticFreeThreshold,
        domesticShippingEnabled: settings.domesticShippingEnabled,
        localPincodes: settings.localPincodes,
        localFee: Number(settings.localFee || 0),
        localFreeThreshold: Number(settings.localFreeThreshold || 0),
        pickupEnabled: settings.pickupEnabled,
        pickupHours: settings.pickupHours,
        refillDiscount: Number(settings.refillDiscount || 0),
      });
      setSettings({
        domesticFee: String(d.shippingSettings.domesticFee),
        domesticFreeThreshold: String(d.shippingSettings.domesticFreeThreshold),
        domesticShippingEnabled: d.shippingSettings.domesticShippingEnabled,
        localPincodes: d.shippingSettings.localPincodes || '',
        localFee: String(d.shippingSettings.localFee ?? 0),
        localFreeThreshold: String(d.shippingSettings.localFreeThreshold ?? 0),
      pickupEnabled: !!d.shippingSettings.pickupEnabled,
      pickupHours: d.shippingSettings.pickupHours || '',
      refillDiscount: String(d.shippingSettings.refillDiscount ?? 0),
      });
      setMessage({ type: 'success', text: 'Shipping settings updated.' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="admin-head">
        <h1>Domestic Shipping</h1>
      </div>
      <p className="muted">
        The flat fee charged when a customer chooses "Shipping" at checkout, on India orders below the
        free-shipping threshold. Customers can instead choose "To Pay" — a courier-collected charge with no
        fee set here, since the courier's own rate isn't known in advance. Silver and Gold loyalty members
        keep their own better-than-base free-shipping perks (₹699 / any order) regardless of what's set here —
        this only affects guests and Bronze-tier customers. International shipping fees are set separately, on
        the Currency Rates page.
      </p>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="admin-card">
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.domesticShippingEnabled}
            onChange={(e) => setSettings((s) => ({ ...s, domesticShippingEnabled: e.target.checked }))}
          />
          Charge shipping on India orders
        </label>
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Turn this off to make the "Shipping" option free for everyone, regardless of the fee/threshold below.
          "To Pay" is unaffected either way, since it was never a store-collected charge.
        </p>

        <div className="form-grid">
          <div className="field">
            <label>Shipping fee (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.domesticFee}
              onChange={(e) => setSettings((s) => ({ ...s, domesticFee: e.target.value }))}
              placeholder="e.g. 60"
            />
          </div>
          <div className="field">
            <label>Free shipping above (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.domesticFreeThreshold}
              onChange={(e) => setSettings((s) => ({ ...s, domesticFreeThreshold: e.target.value }))}
              placeholder="e.g. 999"
            />
          </div>
        </div>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid rgba(31,61,43,0.1)' }} />

        <h3 style={{ fontSize: '1rem', margin: '0 0 4px' }}>Nearby delivery</h3>
        <p className="muted" style={{ fontSize: '0.85rem', maxWidth: '60ch' }}>
          Addresses you can reach yourself — by bus parcel or bike — instead of handing to a national
          courier. Leave the pincodes blank to switch this off entirely; every order then pays the
          rate above, exactly as now.
        </p>

        <div className="field">
          <label>Pincodes you deliver to yourself</label>
          <textarea
            rows={3}
            value={settings.localPincodes}
            onChange={(e) => setSettings((s) => ({ ...s, localPincodes: e.target.value }))}
            placeholder="642126, 642154, 6414"
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Separate with commas or spaces. A short number matches everything starting with it —
            <b> 6421</b> covers the whole Udumalpet range, while <b>642126</b> matches only that one
            pincode.
          </p>
        </div>

        <div className="form-grid">
          <div className="field">
            <label>Nearby delivery fee (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.localFee}
              onChange={(e) => setSettings((s) => ({ ...s, localFee: e.target.value }))}
              placeholder="e.g. 20"
            />
          </div>
          <div className="field">
            <label>Free nearby delivery above (₹)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={settings.localFreeThreshold}
              onChange={(e) => setSettings((s) => ({ ...s, localFreeThreshold: e.target.value }))}
              placeholder="e.g. 400"
            />
          </div>
        </div>

        <hr style={{ margin: '24px 0', border: 0, borderTop: '1px solid rgba(31,61,43,0.1)' }} />

        <h3 style={{ fontSize: '1rem', margin: '0 0 4px' }}>Collection at the mill</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={settings.pickupEnabled}
            onChange={(e) => setSettings((s) => ({ ...s, pickupEnabled: e.target.checked }))}
          />
          Let customers collect their order from the mill
        </label>
        <p className="muted" style={{ fontSize: '0.85rem', maxWidth: '60ch' }}>
          Adds a third delivery choice at checkout, with no charge — nobody is delivering it.
          Only turn it on when someone is reliably there to hand orders over; a customer who
          drives to Udumalpet and finds the door shut does not come back. Collection orders are
          flagged in Orders so they don't get put on the courier run by mistake.
        </p>

        <div className="field">
          <label>When they can collect</label>
          <input
            maxLength={200}
            value={settings.pickupHours}
            onChange={(e) => setSettings((s) => ({ ...s, pickupHours: e.target.value }))}
            placeholder="e.g. Mon–Sat, 9am–6pm"
          />
        </div>

        <div className="field" style={{ maxWidth: 260 }}>
          <label>Off each bottle they bring (₹)</label>
          <input
            type="number"
            min="0"
            step="1"
            value={settings.refillDiscount}
            onChange={(e) => setSettings((s) => ({ ...s, refillDiscount: e.target.value }))}
            placeholder="e.g. 15"
          />
          <p className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>
            Shown at checkout as a promise and taken off <b>at the counter</b>, not from the
            online total — you can see whether a bottle actually arrived; a payment gateway
            can't. Leave at 0 to say nothing about refills.
          </p>
        </div>

        <button type="button" className="btn btn-gold btn-sm" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </>
  );
}
