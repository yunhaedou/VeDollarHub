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
            return res.status(500).json({ error: "Gagal Login Griez", detail: resGriez });
        }

        const batch = db.batch();
        let count = 0;
        let batchCount = 0;
        
        // Simpan semua kategori yang ditemukan untuk laporan jika 0 produk tersimpan
        const categoriesFound = new Set();

        for (const item of resGriez.data) {
            if (!item.id) continue; // Skip item rusak

            // Data Asli
            const name = (item.nama_layanan || "").toLowerCase();
            const categoryName = (item.kategori || "").toLowerCase();
            const priceAsli = parseInt(item.harga);
            const serviceId = item.id;

            // Catat kategori untuk debug (Biar ketahuan namanya apa)
            if(item.kategori) categoriesFound.add(item.kategori);

            let myCategory = "";

            // --- FILTER YANG LEBIH LUAS ---
            
            // 1. Weekly Diamond (Cek berbagai kemungkinan nama)
            if (name.includes("weekly") || name.includes("mingguan") || name.includes("wdp")) {
                if (name.includes("brazil") || name.includes("br")) myCategory = "wd_br";
                else myCategory = "wd_id";
            }
            // 2. Mobile Legends (Cek MLBB, Mobile Legend, Legends, dll)
            else if (categoryName.includes("mobile") || categoryName.includes("mlbb") || categoryName.includes("legend") || name.includes("mobile legend")) {
                // Filter lagi: Jangan ambil game lain yg ada kata 'mobile' (misal COD Mobile)
                if (name.includes("call of duty") || categoryName.includes("cod")) {
                    // Skip CODM
                } else {
                    if (name.includes("brazil") || name.includes("br")) myCategory = "mlbb_br";
                    else myCategory = "mlbb";
                }
            }

            // Jika Kategori Cocok -> Simpan
            if (myCategory) {
                const sellingPrice = priceAsli + 1500; // Markup
                const docRef = db.collection('products').doc(String(serviceId));
                
                batch.set(docRef, {
                    name: item.nama_layanan,
                    price: sellingPrice,
                    price_raw: sellingPrice,
                    category: myCategory,
                    service_code: serviceId,
                    provider: "griez",
                    description: "Proses Otomatis"
                });

                count++;
                batchCount++;
                if (batchCount >= 400) { await batch.commit(); batchCount = 0; }
            }
        }

        if (batchCount > 0) await batch.commit();

        // --- RESPON PINTAR ---
        // Jika 0 produk, kita kirim daftar kategori di pesan Error agar muncul di HP Anda
        if (count === 0) {
            const listCat = Array.from(categoriesFound).join(", ");
            return res.status(200).json({ 
                success: false, // Bikin false biar muncul toast merah
                error: `0 Produk tersimpan. Kategori yang terbaca di Griez: [${listCat}]. Silakan infokan kategori ini ke saya.` 
            });
        }

        return res.status(200).json({ 
            success: true, 
            message: `Sukses! ${count} produk Mobile Legends & Weekly berhasil diambil.` 
        });

    } catch (error) {
        return res.status(500).json({ error: "Server Error: " + error.message });
    }
                    }
