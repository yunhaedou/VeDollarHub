import axios from 'axios';
import { PTERO_CONFIG } from '../config.js';

const api = axios.create({
    baseURL: PTERO_CONFIG.domain,
    headers: {
        'Authorization': `Bearer ${PTERO_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
});

// 1. Ambil Detail Egg (Untuk Startup Command & Docker Image)
async function getEggDetails(nestId, eggId) {
    try {
        const res = await api.get(`/api/application/nests/${nestId}/eggs/${eggId}`);
        return res.data.attributes;
    } catch (error) {
        console.error("Gagal fetch Egg:", error.response?.data || error.message);
        throw new Error("Gagal mengambil data Egg dari Panel");
    }
}

// 2. Cek User atau Buat Baru
export async function ensurePteroUser(userData) {
    // Cek apakah user sudah ada (berdasarkan email)
    const search = await api.get(`/api/application/users?filter[email]=${userData.email}`);
    
    if (search.data.data.length > 0) {
        return search.data.data[0].attributes.id; // Return ID user lama
    }

    // Jika tidak ada, buat baru
    const newUser = await api.post('/api/application/users', {
        email: userData.email,
        username: userData.username.replace(/\s/g, '').toLowerCase() + Math.floor(Math.random()*1000),
        first_name: userData.username,
        last_name: "(Customer)",
        password: userData.password
    });

    return newUser.data.attributes.id;
}

// 3. Create Server Otomatis
export async function createPteroServer(userId, productType, ramSize) {
    const config = PTERO_CONFIG.games[productType];
    if (!config) throw new Error("Tipe game tidak dikenali");

    // STEP PENTING: Fetch Default Egg Config
    const eggData = await getEggDetails(config.nestId, config.eggId);

    // Build Environment Variables (Ambil default dari Egg)
    let envVars = {};
    // eggData.relationships.variables.data (Logic ini tergantung respon API egg, 
    // biasanya kita ambil default dari panel jika tidak diset manual)
    
    // Construct Payload
    const payload = {
        name: `${productType.toUpperCase()} - User ${userId}`,
        user: userId,
        egg: config.eggId,
        docker_image: eggData.docker_image, // <--- AMBIL DARI HASIL FETCH
        startup: eggData.startup,           // <--- AMBIL DARI HASIL FETCH
        environment: {
            // Kita isi environment wajib standar. 
            // Sisanya akan pakai default value dari Panel karena Pterodactyl pintar.
            "BUNGEE_VERSION": "latest",
            "SERVER_VERSION": "latest",
            "MINECRAFT_VERSION": "latest"
        },
        limits: {
            memory: parseInt(ramSize), // Dari produk yg dibeli
            swap: 0,
            disk: config.disk,
            io: 500,
            cpu: config.cpu
        },
        feature_limits: {
            databases: 1,
            backups: 0,
            allocations: 1
        },
        allocation: {
            default: config.locationId 
        }
    };

    const res = await api.post('/api/application/servers', payload);
    return res.data.attributes;
}
