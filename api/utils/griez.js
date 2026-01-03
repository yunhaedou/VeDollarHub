import crypto from 'crypto'; // Bawaan Node.js

// CONFIG GRIEZ (Isi nanti di Vercel Env)
const GRIEZ_API_ID = process.env.GRIEZ_API_ID;
const GRIEZ_API_KEY = process.env.GRIEZ_API_KEY;
const GRIEZ_URL = "https://griezstore.id/api/order"; 

export async function orderGriez(serviceCode, target) {
    if (!GRIEZ_API_ID || !GRIEZ_API_KEY) {
        throw new Error("Griez API Config Missing");
    }

    try {
        // Format Payload GriezStore (Umum)
        // Sign = md5(api_id + api_key)
        const sign = crypto.createHash('md5').update(GRIEZ_API_ID + GRIEZ_API_KEY).digest('hex');

        const payload = new URLSearchParams();
        payload.append('api_id', GRIEZ_API_ID);
        payload.append('api_key', GRIEZ_API_KEY);
        payload.append('service', serviceCode); // Kode Produk (misal: ML86)
        payload.append('target', target);       // User ID + Zone ID
        
        const req = await fetch(GRIEZ_URL, {
            method: 'POST',
            body: payload
        });

        const res = await req.json();

        // Cek Respon
        if (res.status === false) {
            throw new Error(res.data || "Gagal Order Griez");
        }

        return res.data; // Berhasil

    } catch (error) {
        console.error("Griez Error:", error.message);
        throw error;
    }
}
