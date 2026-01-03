import axios from 'axios';
import { PTERO_CONFIG } from '../config.js';

// Setup Koneksi Axios
const api = axios.create({
    baseURL: PTERO_CONFIG.domain,
    headers: {
        'Authorization': `Bearer ${PTERO_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// Fungsi Internal: Ambil Detail Egg (Docker Image & Startup Command)
async function getEggDetails(nestId, eggId) {
    try {
        const res = await api.get(`/api/application/nests/${nestId}/eggs/${eggId}`);
        return res.data.attributes;
    } catch (error) {
        throw new Error("Gagal fetch Egg: " + error.message);
    }
}

// 1. FUNGSI PASTIKAN USER ADA (User Biasa, Bukan Admin)
export async function ensurePteroUser(userData) {
    try {
        // Cek user berdasarkan email
        const search = await api.get(`/api/application/users?filter[email]=${userData.email}`);
        
        if (search.data.data.length > 0) {
            // Jika user sudah ada, kembalikan ID-nya
            return search.data.data[0].attributes.id;
        }

        // Jika tidak ada, buat user baru
        const newUser = await api.post('/api/application/users', {
            email: userData.email,
            // Username dibersihkan dari spasi/simbol dan ditambah angka acak agar unik
            username: userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + Math.floor(Math.random()*100),
            first_name: userData.username,
            last_name: "(Customer)",
            password: userData.password,
            root_admin: false, // <--- WAJIB FALSE: Agar user tidak punya akses admin panel
            language: "en"
        });

        return newUser.data.attributes.id;

    } catch (error) {
        // Log error untuk debugging di Vercel Logs
        console.error("Gagal Create User Ptero:", error.response?.data || error.message);
        throw error;
    }
}

// 2. FUNGSI BUAT SERVER (Menggunakan Resource dari Database)
export async function createPteroServer(userId, productType, resources) {
    try {
        const config = PTERO_CONFIG.games[productType];
        if (!config) throw new Error("Tipe game tidak dikenali di config.js");

        // Ambil detail startup command & docker image terbaru dari Panel
        const eggData = await getEggDetails(config.nestId, config.eggId);

        const payload = {
            name: `${productType.toUpperCase()} - User ${userId}`,
            user: userId, // ID User yang baru dibuat/diambil
            egg: config.eggId,
            docker_image: eggData.docker_image,
            startup: eggData.startup,
            environment: {
                "BUNGEE_VERSION": "latest",
                "SERVER_VERSION": "latest",
                "MINECRAFT_VERSION": "latest",
                "PMMP_VERSION": "latest",
                "NUKKIT_VERSION": "latest",
                "VERSION": "latest"
            },
            limits: {
                // Konversi string ke integer untuk memastikan format benar
                memory: parseInt(resources.ram),
                swap: 0,
                disk: parseInt(resources.disk),
                io: 500,
                cpu: parseInt(resources.cpu)
            },
            feature_limits: {
                databases: 1,
                backups: 0,
                allocations: 1
            },
            // Deploy otomatis ke Node yang tersedia di Location ID tersebut
            deploy: {
                locations: [PTERO_CONFIG.locationId],
                dedicated_ip: false,
                port_range: []
            }
        };

        const res = await api.post('/api/application/servers', payload);
        return res.data.attributes;

    } catch (error) {
        console.error("Gagal Create Server Ptero:", error.response?.data || error.message);
        throw error;
    }
}
