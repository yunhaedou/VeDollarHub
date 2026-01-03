import axios from 'axios';
import { PTERO_CONFIG } from '../config.js';

// Setup Koneksi
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

// [BARU] FUNGSI CEK KETERSEDIAAN (Dipakai sebelum Checkout)
export async function checkPteroAvailability(username, email) {
    try {
        // Cek Username
        const userCheck = await api.get(`/api/application/users?filter[username]=${username}`);
        if (userCheck.data.data.length > 0) {
            return "Username sudah dipakai orang lain!";
        }

        // Cek Email
        const emailCheck = await api.get(`/api/application/users?filter[email]=${email}`);
        if (emailCheck.data.data.length > 0) {
            return "Email sudah terdaftar di panel!";
        }

        return null; // Aman (Available)
    } catch (error) {
        console.error("Gagal Cek Ptero:", error.message);
        return null; // Lanjut saja jika error koneksi, biar webhook yang handle
    }
}

// FUNGSI CREATE USER (Tanpa Random Number)
export async function ensurePteroUser(userData) {
    // Cek user by email (jika lolos cek di atas, berarti ini aman)
    const search = await api.get(`/api/application/users?filter[email]=${userData.email}`);
    
    if (search.data.data.length > 0) {
        return search.data.data[0].attributes.id;
    }

    // Buat User Baru (Username PERSIS sesuai input)
    const cleanUsername = userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const newUser = await api.post('/api/application/users', {
        email: userData.email,
        username: cleanUsername, 
        first_name: userData.username,
        last_name: "(BuyerVeDollar)",
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
