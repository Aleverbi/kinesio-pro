# KinesioPro - Sistema de Gestión para Kinesiología

## Setup rápido (15 minutos)

### Paso 1: Crear proyecto en Firebase (5 min)

1. Andá a [console.firebase.google.com](https://console.firebase.google.com)
2. Click en **"Agregar proyecto"** (o "Add project")
3. Poné de nombre: `kinesio-pro` → Siguiente → Siguiente → Crear proyecto
4. Una vez creado, en el dashboard del proyecto:
   - Click en el ícono **</>** (Web) para agregar una app web
   - Nombre: `kinesio-pro` → Registrar app
   - Te va a mostrar un bloque de config. **Copiá los valores** (apiKey, authDomain, projectId, etc.)
5. En el menú lateral, andá a **Firestore Database** → **Crear base de datos**
   - Elegí **"Modo de prueba"** (Start in test mode)
   - Ubicación: `southamerica-east1` (São Paulo, la más cercana)
   - Click en **Habilitar**

### Paso 2: Configurar el código (2 min)

1. Abrí el archivo `src/firebase.js`
2. Reemplazá los valores placeholder con tu config real:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",           // tu apiKey
  authDomain: "kinesio-pro.firebaseapp.com",
  projectId: "kinesio-pro",
  storageBucket: "kinesio-pro.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Paso 3: Subir a GitHub (3 min)

1. Andá a [github.com/new](https://github.com/new)
2. Nombre del repo: `kinesio-pro` → Create repository
3. En tu terminal (PowerShell):

```bash
cd kinesio-pro
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/kinesio-pro.git
git push -u origin main
```

### Paso 4: Deploy en Vercel (3 min)

1. Andá a [vercel.com](https://vercel.com) → Sign up con GitHub
2. Click en **"Add New Project"**
3. Importá el repo `kinesio-pro`
4. Framework preset: **Vite** (se detecta solo)
5. Click en **Deploy**
6. En 1-2 minutos tenés tu URL: `https://kinesio-pro.vercel.app`

### Paso 5: Compartir con tu amiga

Mandále la URL de Vercel. Listo, puede usarla desde el celu o la compu.

---

## Estructura del proyecto

```
kinesio-pro/
├── index.html          # Entry point
├── package.json        # Dependencias
├── vite.config.js      # Config de Vite
├── src/
│   ├── main.jsx        # React entry
│   ├── App.jsx         # App completa (todos los módulos)
│   └── firebase.js     # Config y funciones de Firebase
└── README.md
```

## Módulos incluidos

- **Dashboard**: Vista rápida del día, stats semanales, alertas
- **Agenda**: Vista diaria/semanal, bloqueo de horarios, export .ics
- **Pacientes**: Alta completa, DNI, obra social, antecedentes
- **Historia clínica**: Notas por sesión, templates, zonas corporales, dolor
- **Booking público**: Flujo de 3 pasos para que pacientes reserven solos
- **Reportes**: Tasa de asistencia, top pacientes, distribución por OS
- **Configuración**: Horarios, días laborales, duración de sesión

## Notas importantes

- **Firebase free tier**: Alcanza de sobra para una práctica individual (50K lecturas/día, 20K escrituras/día)
- **Vercel free tier**: Deployments ilimitados, SSL incluido, dominio custom disponible
- Los datos de **Firestore en modo test** expiran a los 30 días. Antes de eso, configurá las reglas de seguridad (podemos hacerlo cuando estés listo)
- Para agregar un **dominio propio** (ej: turnos.kinesiologiajuanita.com), se configura desde Vercel → Settings → Domains
