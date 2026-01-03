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

// FUNGSI CEK KETERSEDIAAN (Hanya Cek Email, Username biar dihandle randomizer)
export async function checkPteroAvailability(username, email) {
    try {
        // Kita hanya cek email, karena username nanti akan di-random kalau duplikat
        const emailCheck = await api.get(`/api/application/users?filter[email]=${email}`);
        if (emailCheck.data.data.length > 0) {
            return "Email sudah terdaftar! Gunakan email lain.";
        }
        return null; 
    } catch (error) {
        return null; 
    }
}

// FUNGSI BUAT USER (DENGAN RANDOMIZER & RETURN USERNAME FINAL)
export async function ensurePteroUser(userData) {
    // 1. Cek User by Email
    const search = await api.get(`/api/application/users?filter[email]=${userData.email}`);
    
    if (search.data.data.length > 0) {
        // Jika user lama ketemu, kembalikan ID dan Username lamanya
        return {
            id: search.data.data[0].attributes.id,
            username: search.data.data[0].attributes.username
        };
    }

    // 2. Buat User Baru (LOGIKA: Tambah Angka Acak agar Unik)
    // Contoh: 'caspertes' -> 'caspertes88'
    const randomSuffix = Math.floor(Math.random() * 100);
    const finalUsername = userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + randomSuffix;

    const newUser = await api.post('/api/application/users', {
        email: userData.email,
        username: finalUsername, // Pakai username yang ada angkanya
        first_name: userData.username,
        last_name: "(BuyVeDollarr)",
        password: userData.password,
        root_admin: false,
        language: "en"
    });

    // Kembalikan Object: ID dan Username Final
    return {
        id: newUser.data.attributes.id,
        username: newUser.data.attributes.username // Ini nanti disimpan ke Firebase
    };
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
        feature_limits: { databases: 1, backups: 0, allocations: 1 },
        deploy: {
            locations: [PTERO_CONFIG.locationId],
            dedicated_ip: false,
            port_range: []
        }
    };

    const res = await api.post('/api/application/servers', payload);
    return res.data.attributes;
}
