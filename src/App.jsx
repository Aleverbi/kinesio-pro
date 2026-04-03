import { useState, useEffect, useReducer } from "react";
import { loadData, saveData } from "./firebase.js";

// ============================================================
// KINESIO PRO - Sistema de Gestión para Kinesiología
// ============================================================

const defaultData = {
  patients: [],
  appointments: [],
  clinicalNotes: [],
  blockedSlots: [],
  config: {
    professionalName: "",
    specialty: "Kinesiología",
    sessionDuration: 45,
    workingHours: { start: "08:00", end: "20:00" },
    workingDays: [1, 2, 3, 4, 5],
    obrasSociales: ["Particular", "OSDE", "Swiss Medical", "Galeno", "Medifé", "IOMA", "Otra"],
  },
};

// --- Data reducer ---
function dataReducer(state, action) {
  let newState;
  switch (action.type) {
    case "LOAD_DATA":
      return action.payload;
    case "ADD_PATIENT":
      newState = { ...state, patients: [...state.patients, { ...action.payload, id: action.payload.id || crypto.randomUUID(), createdAt: new Date().toISOString() }] };
      break;
    case "UPDATE_PATIENT":
      newState = { ...state, patients: state.patients.map((p) => (p.id === action.payload.id ? { ...p, ...action.payload } : p)) };
      break;
    case "DELETE_PATIENT":
      newState = { ...state, patients: state.patients.filter((p) => p.id !== action.payload) };
      break;
    case "ADD_APPOINTMENT":
      newState = { ...state, appointments: [...state.appointments, { ...action.payload, id: crypto.randomUUID(), createdAt: new Date().toISOString() }] };
      break;
    case "UPDATE_APPOINTMENT":
      newState = { ...state, appointments: state.appointments.map((a) => (a.id === action.payload.id ? { ...a, ...action.payload } : a)) };
      break;
    case "DELETE_APPOINTMENT":
      newState = { ...state, appointments: state.appointments.filter((a) => a.id !== action.payload) };
      break;
    case "ADD_CLINICAL_NOTE":
      newState = { ...state, clinicalNotes: [...state.clinicalNotes, { ...action.payload, id: crypto.randomUUID(), createdAt: new Date().toISOString() }] };
      break;
    case "UPDATE_CLINICAL_NOTE":
      newState = { ...state, clinicalNotes: state.clinicalNotes.map((n) => (n.id === action.payload.id ? { ...n, ...action.payload } : n)) };
      break;
    case "ADD_BLOCKED_SLOT":
      newState = { ...state, blockedSlots: [...state.blockedSlots, { ...action.payload, id: crypto.randomUUID() }] };
      break;
    case "DELETE_BLOCKED_SLOT":
      newState = { ...state, blockedSlots: state.blockedSlots.filter((b) => b.id !== action.payload) };
      break;
    case "UPDATE_CONFIG":
      newState = { ...state, config: { ...state.config, ...action.payload } };
      break;
    default:
      return state;
  }
  saveData(newState);
  return newState;
}

// --- Utility functions ---
const formatDate = (d) => {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const getToday = () => new Date().toISOString().split("T")[0];
const getDayName = (d) => new Date(d + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long" });

const STATUS_MAP = {
  scheduled: { label: "Agendado", color: "#3B82F6", bg: "#EFF6FF" },
  confirmed: { label: "Confirmado", color: "#8B5CF6", bg: "#F5F3FF" },
  attended: { label: "Asistió", color: "#10B981", bg: "#ECFDF5" },
  cancelled: { label: "Cancelado", color: "#EF4444", bg: "#FEF2F2" },
  noshow: { label: "No asistió", color: "#F59E0B", bg: "#FFFBEB" },
  postponed: { label: "Postergado", color: "#6B7280", bg: "#F3F4F6" },
};

const BODY_ZONES = [
  "Cervical", "Dorsal", "Lumbar", "Hombro Der.", "Hombro Izq.",
  "Codo Der.", "Codo Izq.", "Muñeca Der.", "Muñeca Izq.",
  "Cadera Der.", "Cadera Izq.", "Rodilla Der.", "Rodilla Izq.",
  "Tobillo Der.", "Tobillo Izq.", "ATM", "Otro",
];

const CLINICAL_TEMPLATES = {
  cervicalgia: { name: "Cervicalgia", diagnosis: "Cervicalgia mecánica", zones: ["Cervical"], notes: "Contractura paravertebral cervical. Limitación rotación.", treatment: "Termoterapia + masoterapia descontracturante + ejercicios de movilidad cervical" },
  lumbalgia: { name: "Lumbalgia", diagnosis: "Lumbalgia mecánica", zones: ["Lumbar"], notes: "Dolor lumbar con irradiación a glúteo. Contractura cuadrado lumbar.", treatment: "TENS + masoterapia + Williams + estabilización lumbar" },
  lca: { name: "Post-op LCA", diagnosis: "Post-quirúrgico reconstrucción LCA", zones: ["Rodilla Der.", "Rodilla Izq."], notes: "Paciente post-op LCA. Evaluar rango articular, edema, fuerza cuádriceps.", treatment: "Crioterapia + electroestimulación cuádriceps + movilidad progresiva + propiocepción" },
  hombro: { name: "Hombro doloroso", diagnosis: "Síndrome subacromial / Tendinopatía manguito rotador", zones: ["Hombro Der.", "Hombro Izq."], notes: "Dolor en arco doloroso. Test Neer/Hawkins. Evaluar movilidad pasiva/activa.", treatment: "US terapéutico + ejercicios pendulares + fortalecimiento manguito rotador progresivo" },
  esguince: { name: "Esguince tobillo", diagnosis: "Esguince lateral de tobillo grado I-II", zones: ["Tobillo Der.", "Tobillo Izq."], notes: "Edema perimaleolar lateral. Dolor a la palpación LPAA. Cajón anterior.", treatment: "RICE + vendaje funcional + movilidad precoz + propiocepción progresiva" },
};

function generateTimeSlots(start, end, duration) {
  const slots = [];
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current + duration <= endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    current += duration;
  }
  return slots;
}

function generateICS(appointments, professionalName) {
  let ics = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//KinesioPro//ES\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\nX-WR-CALNAME:${professionalName || "Kinesio"} - Turnos\n`;
  appointments.forEach((apt) => {
    if (apt.status === "cancelled") return;
    const start = apt.date.replace(/-/g, "") + "T" + apt.time.replace(/:/g, "") + "00";
    const endTime = new Date(`${apt.date}T${apt.time}`);
    endTime.setMinutes(endTime.getMinutes() + (apt.duration || 45));
    const end = endTime.toISOString().replace(/[-:]/g, "").split(".")[0];
    ics += `BEGIN:VEVENT\nDTSTART:${start}\nDTEND:${end}\nSUMMARY:Turno - ${apt.patientName || "Paciente"}\nDESCRIPTION:${apt.notes || ""}\nSTATUS:${apt.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}\nUID:${apt.id}@kinesiopro\nEND:VEVENT\n`;
  });
  ics += "END:VCALENDAR";
  return ics;
}

function downloadICS(appointments, professionalName) {
  const ics = generateICS(appointments, professionalName);
  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kinesio-turnos.ics";
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// SHARED UI COMPONENTS
// ============================================================
const Modal = ({ open, onClose, title, children, wide }) => {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: wide ? 700 : 500, maxHeight: "90vh", overflow: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #E5E7EB" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "#9CA3AF", lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151", letterSpacing: "0.02em" }}>{label}</label>}
    <input {...props} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s", fontFamily: "inherit", ...props.style }} onFocus={(e) => { e.target.style.borderColor = "#2563EB"; props.onFocus?.(e); }} onBlur={(e) => { e.target.style.borderColor = "#D1D5DB"; props.onBlur?.(e); }} />
  </div>
);

const TextArea = ({ label, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151", letterSpacing: "0.02em" }}>{label}</label>}
    <textarea {...props} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", minHeight: 80, resize: "vertical", ...props.style }} onFocus={(e) => { e.target.style.borderColor = "#2563EB"; }} onBlur={(e) => { e.target.style.borderColor = "#D1D5DB"; }} />
  </div>
);

const Select = ({ label, options, ...props }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151", letterSpacing: "0.02em" }}>{label}</label>}
    <select {...props} style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #D1D5DB", borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff", ...props.style }}>
      {options.map((o) => <option key={typeof o === "string" ? o : o.value} value={typeof o === "string" ? o : o.value}>{typeof o === "string" ? o : o.label}</option>)}
    </select>
  </div>
);

const Badge = ({ status }) => {
  const s = STATUS_MAP[status] || STATUS_MAP.scheduled;
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, color: s.color, background: s.bg }}>{s.label}</span>;
};

const Btn = ({ children, variant = "primary", size = "md", ...props }) => {
  const styles = {
    primary: { background: "#2563EB", color: "#fff", border: "none" },
    secondary: { background: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB" },
    danger: { background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA" },
    success: { background: "#ECFDF5", color: "#059669", border: "1px solid #A7F3D0" },
    ghost: { background: "transparent", color: "#6B7280", border: "none" },
  };
  const sizes = { sm: { padding: "6px 12px", fontSize: 12 }, md: { padding: "10px 18px", fontSize: 14 }, lg: { padding: "12px 24px", fontSize: 15 } };
  return <button {...props} style={{ ...styles[variant], ...sizes[size], borderRadius: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.01em", transition: "all 0.15s", display: "inline-flex", alignItems: "center", gap: 6, ...props.style }}>{children}</button>;
};

const Card = ({ children, style, ...props }) => (
  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: 20, ...style }} {...props}>{children}</div>
);

const EmptyState = ({ icon, title, subtitle }) => (
  <div style={{ textAlign: "center", padding: "48px 24px", color: "#9CA3AF" }}>
    <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 16, fontWeight: 600, color: "#6B7280", marginBottom: 4 }}>{title}</div>
    <div style={{ fontSize: 14 }}>{subtitle}</div>
  </div>
);

const StatCard = ({ label, value, icon, color }) => (
  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #E5E7EB", padding: "18px 20px", flex: "1 1 140px", minWidth: 140 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 800, color: color || "#111827" }}>{value}</div>
      </div>
      <div style={{ fontSize: 24 }}>{icon}</div>
    </div>
  </div>
);

// ============================================================
// DASHBOARD
// ============================================================
const Dashboard = ({ data, dispatch, setPage }) => {
  const today = getToday();
  const todayAppts = data.appointments.filter((a) => a.date === today && a.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const ws = weekStart.toISOString().split("T")[0];
  const we = weekEnd.toISOString().split("T")[0];
  const weekAppts = data.appointments.filter((a) => a.date >= ws && a.date <= we);
  const attended = weekAppts.filter((a) => a.status === "attended").length;
  const cancelled = weekAppts.filter((a) => a.status === "cancelled").length;
  const noshow = weekAppts.filter((a) => a.status === "noshow").length;
  const upcoming = data.appointments.filter((a) => (a.date > today || (a.date === today && a.status === "scheduled")) && a.status !== "cancelled").sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)).slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>Dashboard</h2>
        <p style={{ margin: "4px 0 0", color: "#6B7280", fontSize: 14 }}>{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Hoy" value={todayAppts.length} icon="📅" color="#2563EB" />
        <StatCard label="Semana" value={weekAppts.length} icon="📊" />
        <StatCard label="Asistieron" value={attended} icon="✅" color="#10B981" />
        <StatCard label="Pacientes" value={data.patients.length} icon="👥" color="#8B5CF6" />
      </div>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Turnos de hoy</h3>
          <Btn variant="ghost" size="sm" onClick={() => setPage("calendar")}>Ver agenda →</Btn>
        </div>
        {todayAppts.length === 0 ? <EmptyState icon="☀️" title="Sin turnos hoy" subtitle="Día libre o sin turnos agendados" /> : todayAppts.map((apt) => (
          <div key={apt.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ width: 50, textAlign: "center", fontWeight: 700, color: "#2563EB", fontSize: 15 }}>{apt.time}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{apt.patientName || "Sin paciente"}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>{apt.notes || ""}</div>
            </div>
            <Badge status={apt.status} />
            {apt.status === "scheduled" && (
              <div style={{ display: "flex", gap: 4 }}>
                <Btn variant="success" size="sm" onClick={() => dispatch({ type: "UPDATE_APPOINTMENT", payload: { id: apt.id, status: "attended" } })}>✓</Btn>
                <Btn variant="danger" size="sm" onClick={() => dispatch({ type: "UPDATE_APPOINTMENT", payload: { id: apt.id, status: "noshow" } })}>✗</Btn>
              </div>
            )}
          </div>
        ))}
      </Card>
      <Card>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Próximos turnos</h3>
        {upcoming.length === 0 ? <EmptyState icon="📭" title="Sin turnos próximos" subtitle="" /> : upcoming.map((apt) => (
          <div key={apt.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #F3F4F6" }}>
            <div style={{ minWidth: 70, fontSize: 12, color: "#6B7280", fontWeight: 500 }}>{formatDate(apt.date)}</div>
            <div style={{ fontWeight: 700, color: "#2563EB", minWidth: 45, fontSize: 14 }}>{apt.time}</div>
            <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{apt.patientName}</div>
            <Badge status={apt.status} />
          </div>
        ))}
      </Card>
      {cancelled + noshow > 0 && (
        <Card style={{ background: "#FFFBEB", borderColor: "#FDE68A", marginTop: 20 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700, color: "#92400E" }}>⚠️ Atención esta semana</h3>
          <p style={{ margin: 0, fontSize: 14, color: "#92400E" }}>{cancelled} cancelaciones y {noshow} ausencias sin aviso.</p>
        </Card>
      )}
    </div>
  );
};

// ============================================================
// PATIENTS
// ============================================================
const Patients = ({ data, dispatch, setPage, setSelectedPatient }) => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const emptyForm = { name: "", phone: "", email: "", dni: "", obraSocial: "Particular", obraSocialNum: "", birthDate: "", address: "", emergencyContact: "", emergencyPhone: "", medicalHistory: "", currentMedication: "" };
  const [form, setForm] = useState(emptyForm);
  const filtered = data.patients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.dni && p.dni.includes(search)));

  const handleSave = () => {
    if (!form.name.trim()) return;
    if (editing) dispatch({ type: "UPDATE_PATIENT", payload: { ...form, id: editing } });
    else dispatch({ type: "ADD_PATIENT", payload: form });
    setShowForm(false); setEditing(null); setForm(emptyForm);
  };

  const getPatientStats = (pid) => {
    const apts = data.appointments.filter((a) => a.patientId === pid);
    return {
      total: apts.length, attended: apts.filter((a) => a.status === "attended").length,
      lastVisit: apts.filter((a) => a.status === "attended").sort((a, b) => b.date.localeCompare(a.date))[0]?.date,
    };
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Pacientes ({data.patients.length})</h2>
        <Btn onClick={() => { setForm(emptyForm); setEditing(null); setShowForm(true); }}>+ Nuevo paciente</Btn>
      </div>
      <Input placeholder="Buscar por nombre o DNI..." value={search} onChange={(e) => setSearch(e.target.value)} />
      {filtered.length === 0 ? <EmptyState icon="👥" title="Sin pacientes" subtitle={search ? "No se encontraron resultados" : "Agregá tu primer paciente"} /> : filtered.map((p) => {
        const stats = getPatientStats(p.id);
        return (
          <Card key={p.id} style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => { setSelectedPatient(p.id); setPage("patient-detail"); }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", marginBottom: 2 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "#6B7280" }}>{p.obraSocial}{p.phone ? ` · ${p.phone}` : ""}</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#9CA3AF" }}>{stats.total} turnos · {stats.attended} asistencias</span>
                <Btn variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setForm(p); setEditing(p.id); setShowForm(true); }}>✏️</Btn>
              </div>
            </div>
            {stats.lastVisit && <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Última visita: {formatDate(stats.lastVisit)}</div>}
          </Card>
        );
      })}
      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null); }} title={editing ? "Editar paciente" : "Nuevo paciente"} wide>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
          <Input label="Nombre completo *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="DNI" value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" />
          <Input label="Fecha de nacimiento" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} type="date" />
          <Select label="Obra Social" options={data.config.obrasSociales} value={form.obraSocial} onChange={(e) => setForm({ ...form, obraSocial: e.target.value })} />
          <Input label="N° Afiliado" value={form.obraSocialNum} onChange={(e) => setForm({ ...form, obraSocialNum: e.target.value })} />
          <Input label="Dirección" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <Input label="Contacto de emergencia" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
          <Input label="Tel. emergencia" value={form.emergencyPhone} onChange={(e) => setForm({ ...form, emergencyPhone: e.target.value })} />
        </div>
        <TextArea label="Antecedentes médicos" value={form.medicalHistory} onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })} />
        <TextArea label="Medicación actual" value={form.currentMedication} onChange={(e) => setForm({ ...form, currentMedication: e.target.value })} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</Btn>
          <Btn onClick={handleSave}>{editing ? "Guardar cambios" : "Crear paciente"}</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ============================================================
// PATIENT DETAIL
// ============================================================
const PatientDetail = ({ data, dispatch, patientId, setPage }) => {
  const patient = data.patients.find((p) => p.id === patientId);
  const [tab, setTab] = useState("history");
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteForm, setNoteForm] = useState({ diagnosis: "", zones: [], painLevel: 5, rom: "", notes: "", treatment: "", objectives: "", evolution: "" });
  const [template, setTemplate] = useState("");

  if (!patient) return <EmptyState icon="❌" title="Paciente no encontrado" subtitle="" />;
  const appointments = data.appointments.filter((a) => a.patientId === patientId).sort((a, b) => b.date.localeCompare(a.date));
  const notes = data.clinicalNotes.filter((n) => n.patientId === patientId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const applyTemplate = (key) => {
    const t = CLINICAL_TEMPLATES[key];
    if (t) setNoteForm({ ...noteForm, diagnosis: t.diagnosis, zones: t.zones, notes: t.notes, treatment: t.treatment });
    setTemplate(key);
  };
  const saveNote = () => {
    dispatch({ type: "ADD_CLINICAL_NOTE", payload: { ...noteForm, patientId, date: getToday() } });
    setShowNoteForm(false);
    setNoteForm({ diagnosis: "", zones: [], painLevel: 5, rom: "", notes: "", treatment: "", objectives: "", evolution: "" });
  };
  const tabStyle = (t2) => ({ padding: "8px 16px", borderRadius: 8, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: tab === t2 ? "#2563EB" : "#F3F4F6", color: tab === t2 ? "#fff" : "#6B7280", fontFamily: "inherit" });

  return (
    <div>
      <Btn variant="ghost" size="sm" onClick={() => setPage("patients")} style={{ marginBottom: 16 }}>← Volver</Btn>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 800 }}>{patient.name}</h2>
            <div style={{ fontSize: 14, color: "#6B7280" }}>{patient.obraSocial}{patient.obraSocialNum ? ` #${patient.obraSocialNum}` : ""}{patient.phone ? ` · ${patient.phone}` : ""}</div>
            {patient.birthDate && <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 2 }}>Nac: {formatDate(patient.birthDate)}</div>}
          </div>
          <Btn onClick={() => setShowNoteForm(true)}>+ Nota clínica</Btn>
        </div>
        {(patient.medicalHistory || patient.currentMedication) && (
          <div style={{ marginTop: 16, padding: 14, background: "#FEF3C7", borderRadius: 10, fontSize: 13 }}>
            {patient.medicalHistory && <div><strong>Antecedentes:</strong> {patient.medicalHistory}</div>}
            {patient.currentMedication && <div style={{ marginTop: 4 }}><strong>Medicación:</strong> {patient.currentMedication}</div>}
          </div>
        )}
      </Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <button style={tabStyle("history")} onClick={() => setTab("history")}>Historial turnos ({appointments.length})</button>
        <button style={tabStyle("clinical")} onClick={() => setTab("clinical")}>Historia clínica ({notes.length})</button>
      </div>
      {tab === "history" && (appointments.length === 0 ? <EmptyState icon="📋" title="Sin turnos" subtitle="" /> : appointments.map((a) => (
        <Card key={a.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><span style={{ fontWeight: 700 }}>{formatDate(a.date)}</span><span style={{ color: "#6B7280", marginLeft: 8 }}>{a.time}</span></div>
            <Badge status={a.status} />
          </div>
          {a.notes && <div style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>{a.notes}</div>}
        </Card>
      )))}
      {tab === "clinical" && (notes.length === 0 ? <EmptyState icon="🩺" title="Sin notas clínicas" subtitle="" /> : notes.map((n) => (
        <Card key={n.id} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{n.diagnosis || "Sin diagnóstico"}</div>
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>{formatDate(n.date)}</span>
          </div>
          {n.zones?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>{n.zones.map((z) => <span key={z} style={{ padding: "2px 8px", background: "#EFF6FF", color: "#2563EB", borderRadius: 6, fontSize: 11, fontWeight: 600 }}>{z}</span>)}</div>}
          {n.painLevel && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Dolor:</strong> {n.painLevel}/10</div>}
          {n.notes && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Evaluación:</strong> {n.notes}</div>}
          {n.treatment && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Tratamiento:</strong> {n.treatment}</div>}
          {n.objectives && <div style={{ fontSize: 13, marginBottom: 4 }}><strong>Objetivos:</strong> {n.objectives}</div>}
          {n.evolution && <div style={{ fontSize: 13, color: "#059669" }}><strong>Evolución:</strong> {n.evolution}</div>}
        </Card>
      )))}
      <Modal open={showNoteForm} onClose={() => setShowNoteForm(false)} title="Nueva nota clínica" wide>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>Template rápido</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{Object.entries(CLINICAL_TEMPLATES).map(([k, v]) => <Btn key={k} variant={template === k ? "primary" : "secondary"} size="sm" onClick={() => applyTemplate(k)}>{v.name}</Btn>)}</div>
        </div>
        <Input label="Diagnóstico" value={noteForm.diagnosis} onChange={(e) => setNoteForm({ ...noteForm, diagnosis: e.target.value })} />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>Zonas afectadas</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {BODY_ZONES.map((z) => <button key={z} onClick={() => { const zones = noteForm.zones.includes(z) ? noteForm.zones.filter((x) => x !== z) : [...noteForm.zones, z]; setNoteForm({ ...noteForm, zones }); }} style={{ padding: "4px 10px", borderRadius: 6, border: noteForm.zones.includes(z) ? "2px solid #2563EB" : "1px solid #D1D5DB", background: noteForm.zones.includes(z) ? "#EFF6FF" : "#fff", color: noteForm.zones.includes(z) ? "#2563EB" : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{z}</button>)}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>Nivel de dolor: {noteForm.painLevel}/10</label>
          <input type="range" min="0" max="10" value={noteForm.painLevel} onChange={(e) => setNoteForm({ ...noteForm, painLevel: Number(e.target.value) })} style={{ width: "100%" }} />
        </div>
        <Input label="Rango de movimiento" value={noteForm.rom} onChange={(e) => setNoteForm({ ...noteForm, rom: e.target.value })} placeholder="Ej: Flexión 120°, ABD 90°" />
        <TextArea label="Evaluación / Observaciones" value={noteForm.notes} onChange={(e) => setNoteForm({ ...noteForm, notes: e.target.value })} />
        <TextArea label="Tratamiento realizado" value={noteForm.treatment} onChange={(e) => setNoteForm({ ...noteForm, treatment: e.target.value })} />
        <TextArea label="Objetivos" value={noteForm.objectives} onChange={(e) => setNoteForm({ ...noteForm, objectives: e.target.value })} />
        <TextArea label="Evolución" value={noteForm.evolution} onChange={(e) => setNoteForm({ ...noteForm, evolution: e.target.value })} />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => setShowNoteForm(false)}>Cancelar</Btn>
          <Btn onClick={saveNote}>Guardar nota</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ============================================================
// CALENDAR
// ============================================================
const Calendar = ({ data, dispatch }) => {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [showForm, setShowForm] = useState(false);
  const [aptForm, setAptForm] = useState({ patientId: "", time: "", notes: "", duration: 45 });
  const [viewMode, setViewMode] = useState("day");

  const dayAppts = data.appointments.filter((a) => a.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const slots = generateTimeSlots(data.config.workingHours.start, data.config.workingHours.end, data.config.sessionDuration);
  const bookedTimes = dayAppts.filter((a) => a.status !== "cancelled").map((a) => a.time);
  const blockedTimes = data.blockedSlots.filter((b) => b.date === selectedDate).map((b) => b.time);
  const availableSlots = slots.filter((s) => !bookedTimes.includes(s) && !blockedTimes.includes(s));

  const saveApt = () => {
    if (!aptForm.patientId || !aptForm.time) return;
    const patient = data.patients.find((p) => p.id === aptForm.patientId);
    dispatch({ type: "ADD_APPOINTMENT", payload: { ...aptForm, date: selectedDate, status: "scheduled", patientName: patient?.name || "", duration: data.config.sessionDuration } });
    setShowForm(false); setAptForm({ patientId: "", time: "", notes: "", duration: 45 });
  };

  const getWeekDates = () => {
    const d = new Date(selectedDate + "T12:00:00");
    const day = d.getDay();
    const monday = new Date(d); monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => { const date = new Date(monday); date.setDate(monday.getDate() + i); return date.toISOString().split("T")[0]; });
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Agenda</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn variant="secondary" size="sm" onClick={() => downloadICS(data.appointments, data.config.professionalName)}>📅 Exportar .ics</Btn>
          <Btn onClick={() => setShowForm(true)}>+ Nuevo turno</Btn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ marginBottom: 0, maxWidth: 180 }} />
        <Btn variant={viewMode === "day" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("day")}>Día</Btn>
        <Btn variant={viewMode === "week" ? "primary" : "secondary"} size="sm" onClick={() => setViewMode("week")}>Semana</Btn>
        <Btn variant="ghost" size="sm" onClick={() => setSelectedDate(getToday())}>Hoy</Btn>
      </div>
      {viewMode === "day" ? (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#6B7280", marginBottom: 12, textTransform: "capitalize" }}>{getDayName(selectedDate)} {formatDate(selectedDate)}</div>
          {slots.map((slot) => {
            const apt = dayAppts.find((a) => a.time === slot && a.status !== "cancelled");
            const isBlocked = blockedTimes.includes(slot);
            return (
              <div key={slot} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #F3F4F6", minHeight: 48 }}>
                <div style={{ width: 50, fontWeight: 600, fontSize: 14, color: apt ? "#2563EB" : isBlocked ? "#EF4444" : "#D1D5DB" }}>{slot}</div>
                {apt ? (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: STATUS_MAP[apt.status]?.bg, padding: "8px 12px", borderRadius: 10, borderLeft: `3px solid ${STATUS_MAP[apt.status]?.color}` }}>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{apt.patientName}</div>{apt.notes && <div style={{ fontSize: 12, color: "#6B7280" }}>{apt.notes}</div>}</div>
                    <Badge status={apt.status} />
                    {(apt.status === "scheduled" || apt.status === "confirmed") && (
                      <div style={{ display: "flex", gap: 4 }}>
                        <Btn variant="success" size="sm" onClick={() => dispatch({ type: "UPDATE_APPOINTMENT", payload: { id: apt.id, status: "attended" } })}>✓</Btn>
                        <Btn variant="danger" size="sm" onClick={() => dispatch({ type: "UPDATE_APPOINTMENT", payload: { id: apt.id, status: "noshow" } })}>✗</Btn>
                        <Btn variant="secondary" size="sm" onClick={() => dispatch({ type: "UPDATE_APPOINTMENT", payload: { id: apt.id, status: "cancelled" } })}>🚫</Btn>
                      </div>
                    )}
                  </div>
                ) : isBlocked ? (
                  <div style={{ flex: 1, padding: "8px 12px", background: "#FEF2F2", borderRadius: 10, color: "#EF4444", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>🔒 Bloqueado</span>
                    <Btn variant="ghost" size="sm" onClick={() => { const bs = data.blockedSlots.find((b) => b.date === selectedDate && b.time === slot); if (bs) dispatch({ type: "DELETE_BLOCKED_SLOT", payload: bs.id }); }}>Desbloquear</Btn>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: "flex", gap: 6 }}>
                    <Btn variant="ghost" size="sm" onClick={() => { setAptForm({ ...aptForm, time: slot }); setShowForm(true); }}>+ Turno</Btn>
                    <Btn variant="ghost" size="sm" style={{ color: "#EF4444" }} onClick={() => dispatch({ type: "ADD_BLOCKED_SLOT", payload: { date: selectedDate, time: slot } })}>🔒 Bloquear</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(100px, 1fr))", gap: 8 }}>
            {getWeekDates().map((date) => {
              const apts = data.appointments.filter((a) => a.date === date && a.status !== "cancelled").sort((a, b) => a.time.localeCompare(b.time));
              const isToday = date === getToday();
              return (
                <div key={date} style={{ background: isToday ? "#EFF6FF" : "#fff", borderRadius: 10, border: isToday ? "2px solid #2563EB" : "1px solid #E5E7EB", padding: 10, cursor: "pointer" }} onClick={() => { setSelectedDate(date); setViewMode("day"); }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF", textTransform: "capitalize" }}>{getDayName(date).slice(0, 3)}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: isToday ? "#2563EB" : "#111827", marginBottom: 8 }}>{new Date(date + "T12:00:00").getDate()}</div>
                  {apts.slice(0, 4).map((a) => <div key={a.id} style={{ fontSize: 11, padding: "2px 6px", marginBottom: 3, borderRadius: 4, background: STATUS_MAP[a.status]?.bg, color: STATUS_MAP[a.status]?.color, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.time} {a.patientName?.split(" ")[0]}</div>)}
                  {apts.length > 4 && <div style={{ fontSize: 11, color: "#9CA3AF" }}>+{apts.length - 4} más</div>}
                  {apts.length === 0 && <div style={{ fontSize: 11, color: "#D1D5DB" }}>—</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Nuevo turno">
        <Select label="Paciente *" options={[{ value: "", label: "Seleccionar..." }, ...data.patients.map((p) => ({ value: p.id, label: p.name }))]} value={aptForm.patientId} onChange={(e) => setAptForm({ ...aptForm, patientId: e.target.value })} />
        <Select label="Horario *" options={[{ value: "", label: "Seleccionar..." }, ...availableSlots.map((s) => ({ value: s, label: s }))]} value={aptForm.time} onChange={(e) => setAptForm({ ...aptForm, time: e.target.value })} />
        <TextArea label="Notas" value={aptForm.notes} onChange={(e) => setAptForm({ ...aptForm, notes: e.target.value })} placeholder="Motivo de consulta, observaciones..." />
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 12 }}>
          <Btn variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Btn>
          <Btn onClick={saveApt}>Agendar turno</Btn>
        </div>
      </Modal>
    </div>
  );
};

// ============================================================
// PUBLIC BOOKING
// ============================================================
const PublicBooking = ({ data, dispatch }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", phone: "", email: "", date: "", time: "" });
  const [booked, setBooked] = useState(false);

  const availableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      if (data.config.workingDays.includes(d.getDay())) dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };
  const availableTimesForDate = (date) => {
    if (!date) return [];
    const slots = generateTimeSlots(data.config.workingHours.start, data.config.workingHours.end, data.config.sessionDuration);
    const bkd = data.appointments.filter((a) => a.date === date && a.status !== "cancelled").map((a) => a.time);
    const blk = data.blockedSlots.filter((b) => b.date === date).map((b) => b.time);
    return slots.filter((s) => !bkd.includes(s) && !blk.includes(s));
  };
  const handleBook = () => {
    let patient = data.patients.find((p) => p.phone === form.phone || p.email === form.email);
    let patientId;
    if (!patient) { patientId = crypto.randomUUID(); dispatch({ type: "ADD_PATIENT", payload: { id: patientId, name: form.name, phone: form.phone, email: form.email, obraSocial: "Particular", createdAt: new Date().toISOString() } }); }
    else patientId = patient.id;
    dispatch({ type: "ADD_APPOINTMENT", payload: { patientId, patientName: form.name, date: form.date, time: form.time, status: "scheduled", duration: data.config.sessionDuration, notes: "Reserva online" } });
    setBooked(true);
  };

  if (booked) return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>¡Turno reservado!</h2>
      <p style={{ color: "#6B7280", fontSize: 16 }}>{formatDate(form.date)} a las {form.time}</p>
      <p style={{ color: "#9CA3AF", fontSize: 14, marginTop: 8 }}>Te enviaremos un recordatorio antes de tu turno.</p>
      <Btn style={{ marginTop: 20 }} onClick={() => { setBooked(false); setStep(1); setForm({ name: "", phone: "", email: "", date: "", time: "" }); }}>Reservar otro turno</Btn>
    </div>
  );

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Reservá tu turno</h2>
        <p style={{ color: "#6B7280", margin: "8px 0 0", fontSize: 14 }}>{data.config.professionalName ? `${data.config.professionalName} - ` : ""}{data.config.specialty}</p>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 28 }}>
        {[1, 2, 3].map((s) => <div key={s} style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, background: step >= s ? "#2563EB" : "#E5E7EB", color: step >= s ? "#fff" : "#9CA3AF" }}>{s}</div>)}
      </div>
      {step === 1 && <Card><h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>Tus datos</h3><Input label="Nombre completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><Input label="Teléfono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /><Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Btn onClick={() => { if (form.name && form.phone) setStep(2); }} style={{ width: "100%" }}>Siguiente</Btn></Card>}
      {step === 2 && <Card><h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>Elegí día y horario</h3><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>{availableDates().map((d) => <button key={d} onClick={() => setForm({ ...form, date: d, time: "" })} style={{ padding: "10px 14px", borderRadius: 10, border: form.date === d ? "2px solid #2563EB" : "1px solid #D1D5DB", background: form.date === d ? "#EFF6FF" : "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: form.date === d ? "#2563EB" : "#374151" }}><div style={{ textTransform: "capitalize", fontSize: 11 }}>{getDayName(d).slice(0, 3)}</div><div>{new Date(d + "T12:00:00").getDate()}/{new Date(d + "T12:00:00").getMonth() + 1}</div></button>)}</div>{form.date && <><div style={{ fontSize: 13, fontWeight: 600, color: "#6B7280", marginBottom: 10 }}>Horarios disponibles:</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>{availableTimesForDate(form.date).map((t) => <button key={t} onClick={() => setForm({ ...form, time: t })} style={{ padding: "8px 16px", borderRadius: 8, border: form.time === t ? "2px solid #2563EB" : "1px solid #D1D5DB", background: form.time === t ? "#2563EB" : "#fff", color: form.time === t ? "#fff" : "#374151", fontWeight: 600, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>{t}</button>)}{availableTimesForDate(form.date).length === 0 && <span style={{ color: "#EF4444", fontSize: 13 }}>Sin horarios disponibles</span>}</div></>}<div style={{ display: "flex", gap: 10 }}><Btn variant="secondary" onClick={() => setStep(1)}>← Atrás</Btn><Btn onClick={() => { if (form.date && form.time) setStep(3); }} style={{ flex: 1 }}>Siguiente</Btn></div></Card>}
      {step === 3 && <Card><h3 style={{ margin: "0 0 16px", fontWeight: 700 }}>Confirmá tu turno</h3><div style={{ background: "#F9FAFB", borderRadius: 10, padding: 16, marginBottom: 20 }}><div style={{ marginBottom: 8 }}><strong>Paciente:</strong> {form.name}</div><div style={{ marginBottom: 8 }}><strong>Fecha:</strong> <span style={{ textTransform: "capitalize" }}>{getDayName(form.date)}</span> {formatDate(form.date)}</div><div style={{ marginBottom: 8 }}><strong>Horario:</strong> {form.time}</div><div><strong>Duración:</strong> {data.config.sessionDuration} min</div></div><div style={{ display: "flex", gap: 10 }}><Btn variant="secondary" onClick={() => setStep(2)}>← Atrás</Btn><Btn onClick={handleBook} style={{ flex: 1 }}>✅ Confirmar turno</Btn></div></Card>}
    </div>
  );
};

// ============================================================
// REPORTS
// ============================================================
const Reports = ({ data }) => {
  const [period, setPeriod] = useState("month");
  const getFilteredAppts = () => {
    const today = getToday();
    if (period === "week") { const d = new Date(); d.setDate(d.getDate() - 7); return data.appointments.filter(a => a.date >= d.toISOString().split("T")[0] && a.date <= today); }
    if (period === "month") { const d = new Date(); d.setMonth(d.getMonth() - 1); return data.appointments.filter(a => a.date >= d.toISOString().split("T")[0] && a.date <= today); }
    return data.appointments;
  };
  const appts = getFilteredAppts();
  const attended = appts.filter(a => a.status === "attended").length;
  const cancelled = appts.filter(a => a.status === "cancelled").length;
  const noshow = appts.filter(a => a.status === "noshow").length;
  const total = appts.length;
  const attendRate = total > 0 ? Math.round((attended / total) * 100) : 0;
  const patientCounts = {};
  appts.filter(a => a.status === "attended").forEach(a => { patientCounts[a.patientId] = (patientCounts[a.patientId] || 0) + 1; });
  const topPatients = Object.entries(patientCounts).map(([id, count]) => ({ patient: data.patients.find(p => p.id === id), count })).filter(x => x.patient).sort((a, b) => b.count - a.count).slice(0, 5);
  const osCounts = {};
  appts.filter(a => a.status === "attended").forEach(a => { const p = data.patients.find(p2 => p2.id === a.patientId); osCounts[p?.obraSocial || "Sin dato"] = (osCounts[p?.obraSocial || "Sin dato"] || 0) + 1; });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Reportes</h2>
        <div style={{ display: "flex", gap: 6 }}>{[{ k: "week", l: "Semana" }, { k: "month", l: "Mes" }, { k: "all", l: "Todo" }].map(({ k, l }) => <Btn key={k} variant={period === k ? "primary" : "secondary"} size="sm" onClick={() => setPeriod(k)}>{l}</Btn>)}</div>
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Total" value={total} icon="📊" />
        <StatCard label="Asistencias" value={attended} icon="✅" color="#10B981" />
        <StatCard label="Cancelaciones" value={cancelled} icon="🚫" color="#EF4444" />
        <StatCard label="Ausencias" value={noshow} icon="⚠️" color="#F59E0B" />
      </div>
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Tasa de asistencia</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: attendRate >= 80 ? "#10B981" : attendRate >= 60 ? "#F59E0B" : "#EF4444" }}>{attendRate}%</div>
          <div style={{ flex: 1, background: "#F3F4F6", borderRadius: 10, height: 20, overflow: "hidden" }}><div style={{ width: `${attendRate}%`, height: "100%", background: attendRate >= 80 ? "#10B981" : attendRate >= 60 ? "#F59E0B" : "#EF4444", borderRadius: 10, transition: "width 0.5s" }} /></div>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Top pacientes</h3>
          {topPatients.length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>Sin datos</p> : topPatients.map((tp, i) => <div key={tp.patient.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F3F4F6", fontSize: 14 }}><span>{i + 1}. {tp.patient.name}</span><span style={{ fontWeight: 700, color: "#2563EB" }}>{tp.count}</span></div>)}
        </Card>
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 700 }}>Por obra social</h3>
          {Object.keys(osCounts).length === 0 ? <p style={{ color: "#9CA3AF", fontSize: 13 }}>Sin datos</p> : Object.entries(osCounts).sort((a, b) => b[1] - a[1]).map(([os, count]) => <div key={os} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F3F4F6", fontSize: 14 }}><span>{os}</span><span style={{ fontWeight: 700, color: "#8B5CF6" }}>{count}</span></div>)}
        </Card>
      </div>
    </div>
  );
};

// ============================================================
// SETTINGS
// ============================================================
const Settings = ({ data, dispatch }) => {
  const [config, setConfig] = useState(data.config);
  const [saved, setSaved] = useState(false);
  const save = () => { dispatch({ type: "UPDATE_CONFIG", payload: config }); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div>
      <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 800 }}>Configuración</h2>
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Datos del profesional</h3>
        <Input label="Nombre completo" value={config.professionalName} onChange={(e) => setConfig({ ...config, professionalName: e.target.value })} />
        <Input label="Especialidad" value={config.specialty} onChange={(e) => setConfig({ ...config, specialty: e.target.value })} />
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Horarios de atención</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Input label="Inicio" type="time" value={config.workingHours.start} onChange={(e) => setConfig({ ...config, workingHours: { ...config.workingHours, start: e.target.value } })} />
          <Input label="Fin" type="time" value={config.workingHours.end} onChange={(e) => setConfig({ ...config, workingHours: { ...config.workingHours, end: e.target.value } })} />
        </div>
        <Input label="Duración de sesión (minutos)" type="number" value={config.sessionDuration} onChange={(e) => setConfig({ ...config, sessionDuration: Number(e.target.value) })} />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 8, fontSize: 13, fontWeight: 600, color: "#374151" }}>Días laborales</label>
          <div style={{ display: "flex", gap: 6 }}>
            {dayNames.map((d, i) => <button key={i} onClick={() => { const days = config.workingDays.includes(i) ? config.workingDays.filter((x) => x !== i) : [...config.workingDays, i]; setConfig({ ...config, workingDays: days }); }} style={{ width: 40, height: 40, borderRadius: "50%", border: config.workingDays.includes(i) ? "2px solid #2563EB" : "1px solid #D1D5DB", background: config.workingDays.includes(i) ? "#2563EB" : "#fff", color: config.workingDays.includes(i) ? "#fff" : "#6B7280", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{d}</button>)}
          </div>
        </div>
      </Card>
      <Card style={{ marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 700 }}>Apple Calendar</h3>
        <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 12 }}>Exportá tus turnos como archivo .ics para importar a Apple Calendar, Google Calendar o Outlook.</p>
        <Btn variant="secondary" onClick={() => downloadICS(data.appointments, config.professionalName)}>📅 Descargar archivo .ics</Btn>
      </Card>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <Btn onClick={save}>Guardar configuración</Btn>
        {saved && <span style={{ color: "#10B981", fontWeight: 600, fontSize: 14 }}>✓ Guardado</span>}
      </div>
    </div>
  );
};

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [data, dispatch] = useReducer(dataReducer, defaultData);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("dashboard");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { loadData(defaultData).then((d) => { dispatch({ type: "LOAD_DATA", payload: d }); setLoading(false); }); }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🏥</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#2563EB" }}>KinesioPro</div>
        <div style={{ fontSize: 13, color: "#9CA3AF", marginTop: 4 }}>Cargando...</div>
      </div>
    </div>
  );

  const NAV = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "calendar", icon: "📅", label: "Agenda" },
    { id: "patients", icon: "👥", label: "Pacientes" },
    { id: "booking", icon: "🔗", label: "Booking" },
    { id: "reports", icon: "📈", label: "Reportes" },
    { id: "settings", icon: "⚙️", label: "Config" },
  ];

  const renderPage = () => {
    switch (page) {
      case "dashboard": return <Dashboard data={data} dispatch={dispatch} setPage={setPage} />;
      case "calendar": return <Calendar data={data} dispatch={dispatch} />;
      case "patients": return <Patients data={data} dispatch={dispatch} setPage={setPage} setSelectedPatient={setSelectedPatient} />;
      case "patient-detail": return <PatientDetail data={data} dispatch={dispatch} patientId={selectedPatient} setPage={setPage} />;
      case "booking": return <PublicBooking data={data} dispatch={dispatch} />;
      case "reports": return <Reports data={data} />;
      case "settings": return <Settings data={data} dispatch={dispatch} />;
      default: return <Dashboard data={data} dispatch={dispatch} setPage={setPage} />;
    }
  };

  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: "#F9FAFB", minHeight: "100vh", color: "#111827" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 24 }}>🏥</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#2563EB", letterSpacing: "-0.02em" }}>KinesioPro</span>
        </div>
        <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", padding: 4 }}>☰</button>
      </div>
      {menuOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setMenuOpen(false)}>
          <div style={{ position: "absolute", top: 56, right: 0, background: "#fff", borderRadius: "0 0 0 16px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", padding: 8, minWidth: 200 }} onClick={(e) => e.stopPropagation()}>
            {NAV.map((n) => <button key={n.id} onClick={() => { setPage(n.id); setMenuOpen(false); }} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 16px", border: "none", background: page === n.id ? "#EFF6FF" : "transparent", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: page === n.id ? 700 : 500, color: page === n.id ? "#2563EB" : "#374151" }}><span>{n.icon}</span> {n.label}</button>)}
          </div>
        </div>
      )}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #E5E7EB", display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 6px)", zIndex: 100 }}>
        {NAV.slice(0, 5).map((n) => <button key={n.id} onClick={() => setPage(n.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", padding: "4px 8px", fontSize: 20, color: page === n.id ? "#2563EB" : "#9CA3AF", fontFamily: "inherit" }}><span>{n.icon}</span><span style={{ fontSize: 10, fontWeight: 600 }}>{n.label}</span></button>)}
      </div>
      <div style={{ padding: "20px 16px 80px", maxWidth: 900, margin: "0 auto" }}>{renderPage()}</div>
    </div>
  );
}
