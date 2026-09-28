import { useEffect, useState } from "react";
import {
  createDeliveryZone,
  deleteDeliveryZone,
  listDeliveryZones,
  updateDeliveryZone,
} from "../../lib/deliveryZones";

export default function AdminDeliveryCharges() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  // Add-city form
  const [newCity, setNewCity] = useState("");
  const [newCharge, setNewCharge] = useState("");

  // Edit-in-place for an existing city rate
  const [editingId, setEditingId] = useState(null);
  const [editCity, setEditCity] = useState("");
  const [editCharge, setEditCharge] = useState("");

  function refresh() {
    setLoading(true);
    listDeliveryZones()
      .then((list) => setZones(list || []))
      .catch((err) => setError(err.message || "Could not load delivery charges"))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function flashSuccess(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2500);
  }

  async function handleAddCity(e) {
    e.preventDefault();
    setError("");
    if (!newCity.trim()) return setError("Please enter a city name.");
    if (newCharge === "" || Number.isNaN(Number(newCharge)) || Number(newCharge) < 0) {
      return setError("Please enter a valid delivery charge (0 or more).");
    }
    setBusy(true);
    try {
      await createDeliveryZone({ city: newCity.trim(), charge: Number(newCharge) });
      setNewCity("");
      setNewCharge("");
      flashSuccess(`✓ Delivery rate added for ${newCity.trim()}`);
      refresh();
    } catch (err) {
      setError(err.message || "Could not add delivery rate");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(z) {
    setEditingId(z.id);
    setEditCity(z.city);
    setEditCharge(String(z.charge ?? 0));
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(z) {
    setError("");
    if (!editCity.trim()) return setError("City name is required.");
    if (editCharge === "" || Number.isNaN(Number(editCharge)) || Number(editCharge) < 0) {
      return setError("Please enter a valid delivery charge (0 or more).");
    }
    setBusy(true);
    try {
      await updateDeliveryZone(z.id, { city: editCity.trim(), charge: Number(editCharge) });
      setEditingId(null);
      flashSuccess("✓ Delivery rate updated");
      refresh();
    } catch (err) {
      setError(err.message || "Could not update delivery rate");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(z) {
    if (!confirm(`Delete the delivery rate for "${z.city}"?`)) return;
    setBusy(true);
    try {
      await deleteDeliveryZone(z.id);
      flashSuccess("✓ Delivery rate deleted");
      refresh();
    } catch (err) {
      setError(err.message || "Could not delete delivery rate");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: 40, textAlign: "center" }}>
        <div>⏳ Loading delivery charges…</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700 }}>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>🚚 Delivery Charges</h1>
      <p style={{ color: "var(--ink-soft)", marginBottom: 20, fontSize: 13.5 }}>
        Set a delivery charge per city. Customers see this automatically the moment they pick their city at checkout.
      </p>

      {error && <div style={{ background: "#ffe6e6", color: "var(--danger)", padding: 12, borderRadius: 10, marginBottom: 16 }}>❌ {error}</div>}
      {success && <div style={{ background: "#e6f9f7", color: "var(--teal)", padding: 12, borderRadius: 10, marginBottom: 16 }}>{success}</div>}

      <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 20 }}>
        Any city that isn't added below automatically gets <strong>Rs 0 (free)</strong> delivery at checkout.
      </p>

      {/* ADD A CITY RATE */}
      <form onSubmit={handleAddCity} className="card" style={{ padding: 18, marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="field" style={{ margin: 0, flex: 2, minWidth: 160 }}>
          <label style={{ fontSize: 12 }}>City name</label>
          <input
            value={newCity}
            onChange={(e) => setNewCity(e.target.value)}
            placeholder="e.g., Karachi"
            style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--line)", width: "100%" }}
          />
        </div>
        <div className="field" style={{ margin: 0, flex: 1, minWidth: 120 }}>
          <label style={{ fontSize: 12 }}>Delivery charge (Rs)</label>
          <input
            type="number"
            min="0"
            value={newCharge}
            onChange={(e) => setNewCharge(e.target.value)}
            placeholder="e.g., 150"
            style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid var(--line)", width: "100%" }}
          />
        </div>
        <button className="btn btn-accent" disabled={busy}>{busy ? "Adding…" : "➕ Add city rate"}</button>
      </form>

      {/* CITY RATE LIST */}
      <div className="card" style={{ overflow: "hidden" }}>
        {zones.length === 0 && <div className="empty-state">No city delivery rates yet — add one above.</div>}
        {zones.map((z) => (
          <div key={z.id} style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
            {editingId === z.id ? (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  style={{ flex: 2, minWidth: 140, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--line)" }}
                />
                <input
                  type="number"
                  min="0"
                  value={editCharge}
                  onChange={(e) => setEditCharge(e.target.value)}
                  style={{ flex: 1, minWidth: 100, padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--line)" }}
                />
                <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => saveEdit(z)}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</button>
              </div>
            ) : (
              <div className="admin-row-stack" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>{z.city}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 800, color: "var(--teal)" }}>Rs {Number(z.charge).toLocaleString()}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => startEdit(z)}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(z)}>Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}