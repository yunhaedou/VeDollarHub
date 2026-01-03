import { db } from './utils/firebase.js';
import crypto from 'crypto';

export default async function handler(req, res) {
    const GRIEZ_API_ID = process.env.GRIEZ_API_ID;
    const GRIEZ_API_KEY = process.env.GRIEZ_API_KEY;
    const URL_SERVICE = "https://griezstore.id/api/service"; // Sesuai Screenshot

    if (!GRIEZ_API_ID || !GRIEZ_API_KEY) {
        return res.status(500).json({ error: "API Key Griez belum disetting" });
    }

    try {
        const sign = crypto.createHash('md5').update(GRIEZ_API_ID + GRIEZ_API_KEY).digest('hex');
        
        // Payload Sesuai Screenshot Dokumentasi
        const payload = new URLSearchParams();
        payload.append('api_id', GRIEZ_API_ID);
        payload.append('api_key', GRIEZ_API_KEY);
        payload.append('signature', sign); // Screenshot pake 'signature' bukan 'sign'
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
            // Mapping Field Sesuai Screenshot: id, nama_layanan, harga, kategori
            const name = (item.nama_layanan || "").toLowerCase();
            const categoryName = (item.kategori || "").toLowerCase();
            const priceAsli = parseInt(item.harga);
            const serviceId = item.id; // Ini ID Integer (penting untuk order)

            let myCategory = "";

            // FILTER KATEGORI (Mobile Legend & Weekly)
            if (name.includes("weekly") || name.includes("mingguan")) {
                if (name.includes("brazil") || name.includes("br")) myCategory = "wd_br";
                else myCategory = "wd_id";
            }
            else if (categoryName.includes("mobile legend") || name.includes("mobile legend")) {
                if (name.includes("brazil") || name.includes("br")) myCategory = "mlbb_br";
                else myCategory = "mlbb";
            }

            if (myCategory) {
                // MARKUP Rp 1.500
                const sellingPrice = priceAsli + 1500; 
                
                // Gunakan ID Service sebagai ID Dokumen Firebase agar unik
                const docRef = db.collection('products').doc(serviceId.toString());
                
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
            message: `Sukses! ${count} produk masuk database.` 
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
