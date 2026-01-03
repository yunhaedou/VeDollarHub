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

async function getEggDetails(nestId, eggId) {
    try {
        const res = await api.get(`/api/application/nests/${nestId}/eggs/${eggId}`);
        return res.data.attributes;
    } catch (error) {
        throw new Error("Gagal fetch Egg: " + error.message);
    }
}

// FUNGSI CEK KETERSEDIAAN (Untuk Create Payment)
export async function checkPteroAvailability(username, email) {
    try {
        // Cek Username
        const userCheck = await api.get(`/api/application/users?filter[username]=${username}`);
        if (userCheck.data.data.length > 0) {
            return "Username sudah dipakai! Hapus user lama atau ganti nama.";
        }
        // Cek Email
        const emailCheck = await api.get(`/api/application/users?filter[email]=${email}`);
        if (emailCheck.data.data.length > 0) {
            return "Email sudah terdaftar! Gunakan email lain.";
        }
        return null; 
    } catch (error) {
        console.error("Skip Ptero Check (Error):", error.message);
        return null; // Skip cek jika error koneksi, lanjut bayar
    }
}

// FUNGSI BUAT USER (PERSIS INPUT, NO RANDOM)
export async function ensurePteroUser(userData) {
    // 1. Cek dulu (Safety)
    const search = await api.get(`/api/application/users?filter[email]=${userData.email}`);
    if (search.data.data.length > 0) {
        return search.data.data[0].attributes.id;
    }

    // 2. Bersihkan username dari spasi tapi JANGAN tambah angka
    const cleanUsername = userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const newUser = await api.post('/api/application/users', {
        email: userData.email,
        username: cleanUsername, 
        first_name: userData.username,
        last_name: "(Customer)",
        password: userData.password,
        root_admin: false,
        language: "en"
    });

    return newUser.data.attributes.id;
}

export async function createPteroServer(userId, productType, resources) {
    const config = PTERO_CONFIG.games[productType];
    if (!config) throw new Error("Tipe game tidak dikenali");

    const eggData = await getEggDetails(config.nestId, config.eggId);

    const payload = {
        name: `${productType.toUpperCase()} - User ${userId}`,
        user: userId,
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
        deploy: {
            locations: [PTERO_CONFIG.locationId],
            dedicated_ip: false,
            port_range: []
        }
    };

    const res = await api.post('/api/application/servers', payload);
    return res.data.attributes;
}
