const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { ExpressPeerServer } = require('peer');

const app = express();
app.use(cors());
app.use(express.json({ limit: '60mb' })); // Soporta fotos y notas de voz

// Carpeta local para almacenar respaldos por PIN
const BACKUP_DIR = path.join(__dirname, 'cloud_storage');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Registro en memoria de usuarios sintonizados en frecuencias públicas
const activeFrequencies = {
  'FREQ-GENERAL': new Set(),
  'FREQ-SOS': new Set(),
  'FREQ-GAMERS': new Set()
};

// 1. Guardar copia de seguridad vinculada al PIN
app.post('/api/backup/:pin', (req, res) => {
  const pin = req.params.pin.toUpperCase();
  const data = req.body;
  const filePath = path.join(BACKUP_DIR, `${pin}.json`);
  
  fs.writeFile(filePath, JSON.stringify(data), err => {
    if (err) return res.status(500).json({ error: 'Error al persistir copia' });
    res.json({ success: true, timestamp: Date.now() });
  });
});

// 2. Recuperar copia de seguridad al ingresar con el PIN
app.get('/api/backup/:pin', (req, res) => {
  const pin = req.params.pin.toUpperCase();
  const filePath = path.join(BACKUP_DIR, `${pin}.json`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Sin respaldo previo' });
  }

  fs.readFile(filePath, 'utf8', (err, raw) => {
    if (err) return res.status(500).json({ error: 'Error al leer respaldo' });
    try {
      res.json(JSON.parse(raw));
    } catch (e) {
      res.status(500).json({ error: 'Archivo de respaldo corrupto' });
    }
  });
});

// 3. Frecuencias públicas en vivo
app.post('/api/frequency/join', (req, res) => {
  const { freq, pin } = req.body;
  if (activeFrequencies[freq]) {
    activeFrequencies[freq].add(pin);
  }
  res.json({ success: true });
});

app.get('/api/frequency/:freq', (req, res) => {
  const freq = req.params.freq;
  const members = activeFrequencies[freq] ? Array.from(activeFrequencies[freq]) : [];
  res.json({ members });
});

app.get('/', (req, res) => {
  res.send('Servidor HELLO P2P y Nube Activo');
});

const port = process.env.PORT || 9000;
const server = app.listen(port, () => {
  console.log(`Servidor de HELLO activo en el puerto ${port}`);
});

// Servidor de señalización PeerJS montado en /myapp
const peerServer = ExpressPeerServer(server, {
  path: '/',
  allow_discovery: true
});

app.use('/myapp', peerServer);
