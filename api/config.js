// Konfigurasi Mapping Produk ke Pterodactyl
export const PTERO_CONFIG = {
    domain: process.env.PTERO_URL, // Nanti diisi di Vercel Env
    apiKey: process.env.PTERO_API_KEY,
    locationId: 1, // Ganti sesuai ID Location di Panel
    nodeId: 1,     // Ganti sesuai ID Node di Panel

    // KAMUS MAPPING (Sesuaikan ID dengan Panel Kamu)
    games: {
        "mc": { 
            nestId: 1, // ID Nest Minecraft
            eggId: 5,  // ID Egg Minecraft Paper/Vanilla
            cpu: 100,  // Default CPU %
            disk: 5000 // Default Disk MB (5GB)
        },
        "samp": { 
            nestId: 2, 
            eggId: 10,
            cpu: 80,
            disk: 2000 
        },
        "botwa": { 
            nestId: 3, 
            eggId: 15,
            cpu: 50,
            disk: 1000 
        },
        "bottg": { 
            nestId: 3, 
            eggId: 16,
            cpu: 50,
            disk: 1000 
        }
    }
};
