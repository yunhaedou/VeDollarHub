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
        // Coba baca error message dari Ptero
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

// 1. CEK KETERSEDIAAN (Dipakai create-payment.js)
export async function checkPteroAvailability(username, email) {
    try {
        const userCheck = await pteroFetch(`/api/application/users?filter[username]=${username}`);
        if (userCheck.data.length > 0) return "Username sudah dipakai! Ganti yang lain.";

        const emailCheck = await pteroFetch(`/api/application/users?filter[email]=${email}`);
        if (emailCheck.data.length > 0) return "Email sudah terdaftar!";
        
        return null;
    } catch (error) {
        console.error("Skip Ptero Check:", error.message);
        return null; 
    }
}

// 2. BUAT USER (Persis Input)
export async function ensurePteroUser(userData) {
    // Cek dulu
    const search = await pteroFetch(`/api/application/users?filter[email]=${userData.email}`);
    if (search.data.length > 0) return search.data[0].attributes.id;

    // Bersihkan username (Hanya huruf angka, tanpa spasi, TANPA ANGKA ACAK)
    const cleanUsername = userData.username.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

    const newUser = await pteroFetch('/api/application/users', 'POST', {
        email: userData.email,
        username: cleanUsername,
        first_name: userData.username,
        last_name: "(Customer)",
        password: userData.password,
        root_admin: false,
        language: "en"
    });

    return newUser.attributes.id;
}

// 3. BUAT SERVER
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

    const res = await pteroFetch('/api/application/servers', 'POST', payload);
    return res.attributes;
}
