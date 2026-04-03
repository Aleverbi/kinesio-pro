import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS or service account)
if (!getApps().length) {
  // For Vercel, we use the project ID and let it use Application Default Credentials
  // Or you can set up a service account via environment variables
  initializeApp({
    projectId: "kinesio-pro",
  });
}

const db = getFirestore();

function generateICS(appointments, config) {
  const name = config?.professionalName || "Kinesio";
  const duration = config?.sessionDuration || 45;

  let ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//KinesioPro//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${name} - Turnos`,
    "X-WR-TIMEZONE:America/Argentina/Buenos_Aires",
  ];

  appointments.forEach((apt) => {
    if (apt.status === "cancelled") return;
    if (!apt.date || !apt.time) return;

    const start = apt.date.replace(/-/g, "") + "T" + apt.time.replace(/:/g, "") + "00";
    const endTime = new Date(`${apt.date}T${apt.time}:00`);
    endTime.setMinutes(endTime.getMinutes() + (apt.duration || duration));
    const end =
      endTime.getFullYear().toString() +
      String(endTime.getMonth() + 1).padStart(2, "0") +
      String(endTime.getDate()).padStart(2, "0") +
      "T" +
      String(endTime.getHours()).padStart(2, "0") +
      String(endTime.getMinutes()).padStart(2, "0") +
      "00";

    const statusMap = {
      confirmed: "CONFIRMED",
      attended: "CONFIRMED",
      scheduled: "TENTATIVE",
    };

    ics.push("BEGIN:VEVENT");
    ics.push(`DTSTART;TZID=America/Argentina/Buenos_Aires:${start}`);
    ics.push(`DTEND;TZID=America/Argentina/Buenos_Aires:${end}`);
    ics.push(`SUMMARY:Turno - ${apt.patientName || "Paciente"}`);
    if (apt.notes) ics.push(`DESCRIPTION:${apt.notes.replace(/\n/g, "\\n")}`);
    ics.push(`STATUS:${statusMap[apt.status] || "TENTATIVE"}`);
    ics.push(`UID:${apt.id || Date.now()}@kinesiopro`);
    ics.push("END:VEVENT");
  });

  ics.push("END:VCALENDAR");
  return ics.join("\r\n");
}

export default async function handler(req, res) {
  try {
    const docRef = db.collection("kinesio-data").doc("kinesio-main");
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'inline; filename="kinesio-turnos.ics"');
      return res.status(200).send(
        "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//KinesioPro//ES\r\nEND:VCALENDAR"
      );
    }

    const data = docSnap.data();
    const appointments = data.appointments || [];
    const config = data.config || {};
    const ics = generateICS(appointments, config);

    // Cache for 5 minutes so Apple Calendar gets fresh data reasonably fast
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="kinesio-turnos.ics"');
    return res.status(200).send(ics);
  } catch (error) {
    console.error("Error generating ICS feed:", error);
    return res.status(500).json({ error: "Error generating calendar feed" });
  }
}
