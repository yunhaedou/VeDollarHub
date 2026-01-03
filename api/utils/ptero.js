import { PTERO_CONFIG } from '../config.js';

// Helper Fetch Wrapper
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
        // Log Error Detail dari Ptero agar ketahuan salahnya dimana
        console.error("PTERO API ERROR:", JSON.stringify(res));
        const errMsg = res.errors ? res.errors[0].detail : "Unknown Ptero Error";
        throw new Error(errMsg);
    }
    return res;
}

// Helper Get Egg
async function getEggDetails(nestId, eggId) {
    const res = await pteroFetch(`/api/application/nests/${nestId}/eggs/${eggId}`);
    return res.attributes;
}

// [BARU] Helper Generator Environment Variable
function getEnvironment(type) {
    const base = { "VERSION": "latest" };

    // 1. MINECRAFT (Paper/Spigot)
    if (type === 'mc') {
        return { 
            ...base, 
            "SERVER_JARFILE": "server.jar", 
            "MINECRAFT_VERSION": "latest",
            "BUILD_NUMBER": "latest",
            "DL_PATH": "" 
        };
    }
    
    // 2. SAMP (GTA San Andreas)
    if (type === 'samp') {
        return { 
            ...base, 
            "MAX_PLAYERS": "50", 
            "RCON_PASSWORD": "changeme123", // Password RCON Default
            "PORT": "7777"
        };
    }

    // 3. BOT (WhatsApp / Telegram - NodeJS)
    if (type === 'botwa' || type === 'bottg') {
        return { 
            ...base, 
            "MAIN_FILE": "index.js", 
            "USR_UPLOAD": "0", 
            "AUTO_UPDATE": "0" 
        };
    }

    return base;
}

// 1. CEK KETERSEDIAAN (Hanya Cek Email)
export async function checkPteroAvailability(username, email) {
    try {
        const emailCheck = await pteroFetch(`/api/application/users?filter[email]=${email}`);
        if (emailCheck.data.length > 0) return "Email sudah terdaftar! Gunakan email lain.";
        return null; 
    } catch (error) {
        return null; 
    }
}

// 2. BUAT USER (Return Username Final)
export async function ensurePteroUser(userData) {
    // Cek User Lama
    const search = await pteroFetch(`/api/application/users?filter[email]=${userData.email}`);
    if (search.data.length > 0) {
        return {
            id: search.data[0].attributes.id,
            username: search.data[0].attributes.username
        };
    }

    // Buat User Baru (Dengan Randomizer jika perlu)
    const randomSuffix = Math.floor(Math.random() * 100);
    const finalUsername = userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() + randomSuffix;

    const newUser = await pteroFetch('/api/application/users', 'POST', {
        email: userData.email,
        username: finalUsername,
        first_name: userData.username,
        last_name: "(Customer)",
        password: userData.password,
        root_admin: false,
        language: "en"
    });

    return {
        id: newUser.attributes.id,
        username: newUser.attributes.username
    };
}

// 3. BUAT SERVER (FIX ENVIRONMENT)
export async function createPteroServer(userId, productType, resources) {
    // Pastikan CONFIG user benar
    const config = PTERO_CONFIG.games[productType];
    if (!config) throw new Error(`Game Type '${productType}' tidak ditemukan di api/config.js`);

    const eggData = await getEggDetails(config.nestId, config.eggId);

    // Ambil Environment yang sesuai kategori
    const envVars = getEnvironment(productType);

    const payload = {
        name: `${productType.toUpperCase()} - User ${userId}`,
        user: userId,
        egg: config.eggId,
        docker_image: eggData.docker_image,
        startup: eggData.startup,
        environment: envVars, // <--- INI PERBAIKANNYA
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
    return res.attributes;
}
