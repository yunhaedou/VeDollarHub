import axios from 'axios'; // <--- FIX: Huruf 'i' kecil
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

export async function ensurePteroUser(userData) {
    // Cek user berdasarkan email
    const search = await api.get(`/api/application/users?filter[email]=${userData.email}`);
    
    if (search.data.data.length > 0) {
        return search.data.data[0].attributes.id;
    }

    // Jika tidak ada, buat user baru
    const newUser = await api.post('/api/application/users', {
        email: userData.email,
        username: userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + Math.floor(Math.random()*100),
        first_name: userData.username,
        last_name: "(Customer)",
        password: userData.password
    });

    return newUser.data.attributes.id;
}

// FUNGSI UPDATE: MENERIMA OBJECT RESOURCES
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
            "NUKKIT_VERSION": "latest"
        },
        limits: {
            // GUNAKAN SPEK DARI DATABASE
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
        // FIX: Gunakan 'deploy' untuk auto-assign port/node
        deploy: {
            locations: [PTERO_CONFIG.locationId], // Menggunakan ID Lokasi dari config
            dedicated_ip: false,
            port_range: []
        }
    };

    const res = await api.post('/api/application/servers', payload);
    return res.data.attributes;
}
