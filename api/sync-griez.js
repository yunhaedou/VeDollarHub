import { db } from './utils/firebase.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    const GRIEZ_API_ID = process.env.GRIEZ_API_ID;
    const GRIEZ_API_KEY = process.env.GRIEZ_API_KEY;
    const URL_SERVICE = "https://griezstore.id/api/service"; //

    if (!GRIEZ_API_ID || !GRIEZ_API_KEY) {
        return res.status(500).json({ error: "API Key Griez belum disetting di Vercel" });
    }

    try {
        const sign = crypto.createHash('md5').update(GRIEZ_API_ID + GRIEZ_API_KEY).digest('hex');
        
        const payload = new URLSearchParams();
        payload.append('api_id', GRIEZ_API_ID);
        payload.append('api_key', GRIEZ_API_KEY);
        payload.append('signature', sign); 
        payload.append('status', 'active');

        const reqGriez = await fetch(URL_SERVICE, { method: 'POST', body: payload });
        const resGriez = await reqGriez.json();

        if (!resGriez.status || !resGriez.data) {
            return res.status(500).json({ error: "Gagal ambil data Griez", detail: resGriez });
        }

        const batch = db.batch();
        let count = 0;
        let batchCount = 0;

        for (const item of resGriez.data) {
            // [FIX] Cek apakah ID ada? Jika tidak, skip agar tidak error 'toString'
            if (!item.id) {
                console.log("Item Griez tanpa ID dilewati:", item.nama_layanan);
                continue;
            }

            const name = (item.nama_layanan || "").toLowerCase();
            const categoryName = (item.kategori || "").toLowerCase();
            const priceAsli = parseInt(item.harga);
            const serviceId = item.id; // ID Integer

            let myCategory = "";

            // --- FILTER KATEGORI ---
            // 1. Weekly Diamond
            if (name.includes("weekly") || name.includes("mingguan")) {
                if (name.includes("brazil") || name.includes("br")) myCategory = "wd_br";
                else myCategory = "wd_id";
            }
            // 2. Mobile Legends
            else if (categoryName.includes("mobile legend") || name.includes("mobile legend")) {
                if (name.includes("brazil") || name.includes("br")) myCategory = "mlbb_br";
                else myCategory = "mlbb";
            }

            if (myCategory) {
                const sellingPrice = priceAsli + 1500; // Markup Rp 1.500
                
                // Gunakan ID Service sebagai ID Dokumen (dikonversi ke String dengan aman)
                const docRef = db.collection('products').doc(String(serviceId));
                
                batch.set(docRef, {
                    name: item.nama_layanan,
                    price: sellingPrice,
                    price_raw: sellingPrice,
                    category: myCategory,
                    service_code: serviceId, // Simpan ID integer ini untuk order nanti
                    provider: "griez",
                    description: "Proses Otomatis"
                });

                count++;
                batchCount++;
                if (batchCount >= 400) { await batch.commit(); batchCount = 0; }
            }
        }

        if (batchCount > 0) await batch.commit();

        return res.status(200).json({ 
            success: true, 
            message: `Sukses Sync! ${count} produk berhasil disimpan.` 
        });

    } catch (error) {
        console.error("Sync Error:", error);
        return res.status(500).json({ error: "Server Error: " + error.message });
    }
}
