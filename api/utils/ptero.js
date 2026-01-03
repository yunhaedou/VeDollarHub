import { PTERO_CONFIG } from '../config.js';

// Helper Fetch
async function pteroFetch(endpoint, method = 'GET', body = null) {
    const url = `${PTERO_CONFIG.domain}${endpoint}`;
    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${PTERO_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    };
    if (body) options.body = JSON.stringify(body);

    const req = await fetch(url, options);
    const res = await req.json();

    if (!req.ok) {
        const detail = res.errors ? res.errors[0].detail : JSON.stringify(res);
        console.error("PTERO API ERROR:", detail);
        // Jangan throw error agar logic lain tetap jalan, return null saja
        return null; 
    }
    return res;
}

async function getEggDetails(nestId, eggId) {
    const res = await pteroFetch(`/api/application/nests/${nestId}/eggs/${eggId}`);
    return res ? res.attributes : null;
}

// 1. BUAT/CEK USER
export async function ensurePteroUser(userData) {
    // Cek User Lama
    const search = await pteroFetch(`/api/application/users?filter[email]=${userData.email}`);
    if (search && search.data.length > 0) {
        return {
            id: search.data[0].attributes.id,
            username: search.data[0].attributes.username,
            exists: true // Penanda user lama
        };
    }

    // Buat User Baru
    const cleanUser = userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 10);
    const randomSuffix = Math.floor(Math.random() * 1000);
    const finalUsername = `${cleanUser}${randomSuffix}`;

    const newUser = await pteroFetch('/api/application/users', 'POST', {
        email: userData.email,
        username: finalUsername,
        first_name: userData.username,
        last_name: "(Customer)",
        password: userData.password,
        root_admin: false,
        language: "en"
    });

    if(!newUser) throw new Error("Gagal membuat user Ptero.");

    return {
        id: newUser.attributes.id,
        username: newUser.attributes.username,
        exists: false
    };
}

// 2. CEK APAKAH USER SUDAH PUNYA SERVER? (Untuk Renew)
export async function getUserServer(userId) {
    // Ambil daftar server milik user ini
    const res = await pteroFetch(`/api/application/users/${userId}?include=servers`);
    if(res && res.attributes.relationships.servers.data.length > 0) {
        // Ambil server pertama
        return res.attributes.relationships.servers.data[0].attributes;
    }
    return null;
}

// 3. SUSPEND / UNSUSPEND SERVER
export async function setServerStatus(serverId, action) {
    // action: 'suspend' atau 'unsuspend'
    await pteroFetch(`/api/application/servers/${serverId}/${action}`, 'POST');
}

// 4. BUAT SERVER BARU
export async function createPteroServer(userId, productType, resources) {
    const config = PTERO_CONFIG.games[productType];
    if (!config) throw new Error(`Tipe '${productType}' tidak ditemukan di Config.`);

    const eggData = await getEggDetails(config.nestId, config.eggId);
    if(!eggData) throw new Error("Gagal mengambil data Egg Pterodactyl.");

    const envVars = {
        "MATCH": "git", 
        "USER_UPLOAD": "0",
        "AUTO_UPDATE": "0",
        "MAIN_FILE": "index.js", 
        "BOT_JS_FILE": "index.js", 
        "STARTUP": eggData.startup
    };

    const payload = {
        name: `${productType.toUpperCase()} - User ${userId}`,
        user: userId,
        egg: config.eggId,
        docker_image: eggData.docker_image,
        startup: eggData.startup,
        environment: envVars, 
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

    const res = await pteroFetch('/api/application/servers', 'POST', payload);
    if(!res) throw new Error("Gagal request create server ke Ptero.");
    return res.attributes;
}
